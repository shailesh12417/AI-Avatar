export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type AvatarExpression =
  | "neutral"
  | "happy"
  | "angry"
  | "sad"
  | "surprised"
  | "thinking"
  | "talking";

export interface ConversationHistory {
  role: "user" | "assistant";
  content: string;
}
