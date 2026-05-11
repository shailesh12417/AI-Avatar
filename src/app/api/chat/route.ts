import { NextRequest, NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import type { ConversationHistory } from "@/lib/types";

function buildSystemPrompt(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `You are ARIA (Advanced Responsive Interactive Avatar), a friendly, helpful, and expressive AI assistant. You speak naturally and concisely — like a real person in conversation, not like a textbook.

Current date and time: ${dateStr}, ${timeStr}

You have the ability to search the web for current information. Here's how it works:
- If you need current/recent information to answer the question, respond with ONLY: SEARCH: <your search query>
- If you can answer confidently without needing current info, respond normally with an emotion tag.
- Your entire response should be just "SEARCH: <query>" when you need to search — no extra text before or after.

RESPONSE FORMAT when answering directly:
- Begin with exactly one emotion tag: [happy], [sad], [angry], [surprised], [thinking], [neutral], [talking]
- Keep responses conversational, warm, and concise (2-4 sentences unless more detail is needed)
- Be natural and personable

EXAMPLES:
SEARCH: current president of the united states 2026
SEARCH: bitcoin price today
[happy] That's a great question! I'd be happy to help you with that.
[thinking] Based on what I know, the speed of light is approximately 299,792 kilometers per second.

IMPORTANT: When search results are provided in a follow-up message, answer the user's question using those results. Do NOT request another search after results have been given.`;
}

async function runSearch(query: string): Promise<string> {
  try {
    const body = new URLSearchParams({ q: query });
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ARIA-Avatar/1.0; +https://aria-avatar.local)",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error("DuckDuckGo search failed:", res.status);
      return "";
    }

    const html = await res.text();

    const titles: string[] = [];
    const snippets: string[] = [];

    const titleRegex = /class="result__a"[^>]*>(.*?)<\/a>/gi;
    let tMatch;
    while ((tMatch = titleRegex.exec(html)) !== null) {
      const t = tMatch[1].replace(/<[^>]*>/g, "").trim();
      if (t) titles.push(t);
    }

    const snippetRegex = /class="result__snippet"[^>]*>(.*?)<\/a>/gi;
    let sMatch;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      const s = sMatch[1].replace(/<[^>]*>/g, "").trim();
      if (s) snippets.push(s);
    }

    const count = Math.min(titles.length, snippets.length, 5);
    if (count === 0) return "";

    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      results.push(`${i + 1}. ${titles[i]}\n   ${snippets[i]}`);
    }

    return results.join("\n\n");
  } catch (err) {
    console.error("DuckDuckGo search error:", err);
    return "";
  }
}

let graphApp: Awaited<ReturnType<typeof buildGraph>> | null = null;

function buildGraph() {
  const llm = new ChatGroq({
    model: "openai/gpt-oss-120b",
    temperature: 0.7,
    maxTokens: 512,
  });

  async function agentNode(state: typeof MessagesAnnotation.State) {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  }

  async function searchNode(state: typeof MessagesAnnotation.State) {
    const lastMsg = state.messages[state.messages.length - 1];
    const content = lastMsg?.content?.toString() || "";
    const searchMatch = content.match(/SEARCH:\s*(.+)/i);
    const query = searchMatch ? searchMatch[1].trim() : "";

    if (!query) {
      return {
        messages: [
          new AIMessage(
            "[sad] I'm sorry, I couldn't determine what to search for."
          ),
        ],
      };
    }

    const results = await runSearch(query);
    if (!results) {
      return {
        messages: [
          new AIMessage(
            "[sad] I searched for that but couldn't find any results. Could you try asking differently?"
          ),
        ],
      };
    }

    return {
      messages: [
        new HumanMessage(
          `Web search results for "${query}":\n${results}\n\nNow answer the user's original question using these results.`
        ),
      ],
    };
  }

  function router(state: typeof MessagesAnnotation.State) {
    const lastMsg = state.messages[state.messages.length - 1];
    const content = lastMsg?.content?.toString() || "";
    if (content.includes("SEARCH:") || content.includes("search:")) {
      return "search";
    }
    return END;
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", agentNode)
    .addNode("search", searchNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", router)
    .addEdge("search", "agent");

  return workflow.compile();
}

async function getGraph() {
  if (!graphApp) {
    graphApp = await buildGraph();
  }
  return graphApp;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = (await req.json()) as {
      message: string;
      history?: ConversationHistory[];
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const messages = [new SystemMessage(buildSystemPrompt())];

    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      const cleanContent = msg.content.replace(/^\[(\w+)\]\s*/, "");
      if (msg.role === "user") {
        messages.push(new HumanMessage(cleanContent));
      } else {
        messages.push(new AIMessage(cleanContent));
      }
    }

    messages.push(new HumanMessage(message));

    const app = await getGraph();
    const result = await app.invoke({ messages });

    const lastMessage = result.messages[result.messages.length - 1];
    const rawResponse =
      lastMessage?.content?.toString() ||
      "I'm sorry, I couldn't generate a response.";

    const emotionMatch = rawResponse.match(/^\[(\w+)\]\s*/);
    const emotion = emotionMatch ? emotionMatch[1] : "neutral";
    const cleanResponse = rawResponse.replace(/^\[\w+\]\s*/, "");

    return NextResponse.json({
      success: true,
      text: cleanResponse,
      emotion: emotion,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        text: "I'm having trouble right now. Please try again in a moment.",
        emotion: "sad",
      },
      { status: 500 }
    );
  }
}
