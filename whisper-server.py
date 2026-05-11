#!/usr/bin/env python3
"""OpenAI-compatible Whisper transcription server using faster-whisper."""

import os
import io
import sys
import argparse
from flask import Flask, request, jsonify

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from faster_whisper import WhisperModel

app = Flask(__name__)
model = None


def load_model(model_size: str, device: str, compute_type: str):
    global model
    print(f"Loading faster-whisper model '{model_size}' on {device} ({compute_type})...")
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    print("Model loaded.")


@app.route("/v1/audio/transcriptions", methods=["POST"])
def transcribe():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    audio_bytes = file.read()

    if not audio_bytes:
        return jsonify({"error": "Empty audio data"}), 400

    try:
        segments, info = model.transcribe(
            io.BytesIO(audio_bytes),
            beam_size=5,
            language="en",
            condition_on_previous_text=False,
        )
        text = " ".join(seg.text for seg in segments).strip()

        if not text:
            return jsonify({
                "success": False,
                "error": "Could not detect any speech in the audio",
                "text": "",
            })

        return jsonify({"success": True, "text": text})
    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify({"success": False, "error": str(e), "text": ""}), 500


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="base", help="Whisper model size (tiny/base/small/medium/large-v3)")
    parser.add_argument("--device", default="cpu", help="Device: cpu or cuda")
    parser.add_argument("--compute-type", default="int8", help="Compute type: float16/int8/float32")
    parser.add_argument("--port", type=int, default=9090, help="Server port")
    args = parser.parse_args()

    load_model(args.model, args.device, args.compute_type)
    print(f"Server starting on http://0.0.0.0:{args.port}")
    app.run(host="0.0.0.0", port=args.port, debug=False)
