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

    const whisperUrl =
      process.env.WHISPER_API_URL || "http://127.0.0.1:9090/v1/audio/transcriptions";

    // Clean up base64 if it has a data URI prefix
    const base64Audio = audio.includes(",") ? audio.split(",")[1] : audio;

    // Decode base64 to binary
    const binaryStr = Buffer.from(base64Audio, "base64");

    const blob = new Blob([binaryStr], { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");

    const response = await fetch(whisperUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Whisper transcription error:", response.status, errText);
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
