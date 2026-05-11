import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { audio } = (await req.json()) as { audio: string };

    if (!audio || typeof audio !== "string") {
      return NextResponse.json(
        { error: "Audio data (base64) is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GROQ_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Clean up base64 if it has a data URI prefix
    const base64Audio = audio.includes(",") ? audio.split(",")[1] : audio;

    // Decode base64 to binary
    const binaryStr = Buffer.from(base64Audio, "base64");

    // Create a Blob and FormData for the Groq API
    const blob = new Blob([binaryStr], { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-large-v3-turbo");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq transcription error:", response.status, errText);
      return NextResponse.json(
        {
          success: false,
          error: `Transcription failed: ${response.status}`,
          text: "",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transcription = data.text || "";

    if (!transcription.trim()) {
      return NextResponse.json({
        success: false,
        error: "Could not detect any speech in the audio",
        text: "",
      });
    }

    return NextResponse.json({
      success: true,
      text: transcription.trim(),
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Transcription failed",
        text: "",
      },
      { status: 500 }
    );
  }
}
