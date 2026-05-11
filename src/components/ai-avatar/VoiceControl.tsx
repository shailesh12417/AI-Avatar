"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAvatarStore } from "@/lib/stores/avatar-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Volume2, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Lip sync animation: oscillates mouth while speaking
function useLipSyncWhileSpeaking() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      phaseRef.current += 0.3;
      const val =
        (Math.sin(phaseRef.current * 3.5) * 0.3 +
          Math.sin(phaseRef.current * 7) * 0.15 +
          Math.sin(phaseRef.current * 1.2) * 0.25 +
          0.3) *
        (0.6 + Math.random() * 0.4);
      useAvatarStore
        .getState()
        .setMouthOpenness(Math.max(0, Math.min(1, val)));
    }, 50);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    useAvatarStore.getState().setMouthOpenness(0);
    phaseRef.current = 0;
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop };
}

export default function VoiceControl() {
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const volumeAnimRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceCountRef = useRef(0);
  const hasSpeechRef = useRef(false);
  const maxRecordingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);

  const {
    isListening,
    setListening,
    isThinking,
    setThinking,
    isSpeaking,
    setSpeaking,
    addMessage,
    setExpression,
    setError,
    autoListen,
    toggleAutoListen,
  } = useAvatarStore();

  const { start: startLipSync, stop: stopLipSync } =
    useLipSyncWhileSpeaking();

  // Refs for cross-callback access
  const processMessageRef = useRef<(text: string) => void>();
  const startRecordingRef = useRef<() => void>();

  // ── 1. detectExpression (no deps) ──
  const detectExpression = useCallback(
    (text: string, emotion: string) => {
      const validEmotions = [
        "neutral",
        "happy",
        "angry",
        "sad",
        "surprised",
        "thinking",
        "talking",
      ];
      if (emotion && validEmotions.includes(emotion)) return emotion;

      const lower = text.toLowerCase();
      if (
        lower.includes("great") ||
        lower.includes("wonderful") ||
        lower.includes("happy") ||
        lower.includes("love") ||
        lower.includes("excited") ||
        lower.includes("glad")
      )
        return "happy";
      if (
        lower.includes("unfortunately") ||
        lower.includes("sorry") ||
        lower.includes("sad") ||
        lower.includes("regret")
      )
        return "sad";
      if (
        lower.includes("wow") ||
        lower.includes("amazing") ||
        lower.includes("incredible") ||
        lower.includes("surprising")
      )
        return "surprised";
      return "neutral";
    },
    []
  );

  // ── 2. speakText (declared before processMessage) ──
  const speakText = useCallback(
    (text: string, emotion: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setSpeaking(false);
        setExpression(emotion || "neutral");
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Samantha") ||
            v.name.includes("Google") ||
            v.name.includes("Female") ||
            v.name.includes("Natural"))
      );
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        startLipSync();
        setExpression("talking");
      };

      utterance.onend = () => {
        stopLipSync();
        setExpression(emotion || "neutral");
        setSpeaking(false);

        if (useAvatarStore.getState().autoListen) {
          setTimeout(() => startRecordingRef.current?.(), 800);
        }
      };

      utterance.onerror = () => {
        stopLipSync();
        setSpeaking(false);
        setExpression(emotion || "neutral");
      };

      window.speechSynthesis.speak(utterance);
    },
    [startLipSync, stopLipSync, setExpression, setSpeaking]
  );

  // ── 3. processMessage (uses speakText) ──
  const processMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isThinking) return;

      addMessage("user", text);
      setThinking(true);
      setExpression("thinking");

      try {
        const state = useAvatarStore.getState();
        const history = state.messages
          .slice(-10)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content.replace(/^\[\w+\]\s*/, ""),
          }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });

        const data = await res.json();

        if (data.success) {
          const emotion = detectExpression(data.text, data.emotion);
          addMessage("assistant", data.text);
          setThinking(false);

          setSpeaking(true);
          speakText(data.text, emotion);
        } else {
          setThinking(false);
          setError(data.error || "Failed to get response");
          addMessage(
            "assistant",
            data.text || "I'm sorry, something went wrong."
          );
          setExpression("sad");
          if (useAvatarStore.getState().autoListen) {
            setTimeout(() => startRecordingRef.current?.(), 500);
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setThinking(false);
        setError("Network error. Please try again.");
        addMessage(
          "assistant",
          "I'm having connection issues. Please try again."
        );
        setExpression("sad");
        if (useAvatarStore.getState().autoListen) {
          setTimeout(() => startRecordingRef.current?.(), 500);
        }
      }
    },
    [
      isThinking,
      addMessage,
      setThinking,
      setExpression,
      setSpeaking,
      setError,
      detectExpression,
      speakText,
    ]
  );

  processMessageRef.current = processMessage;

  // Load voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Cleanup recording resources
  const cleanupRecording = useCallback(() => {
    cancelAnimationFrame(volumeAnimRef.current);
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (maxRecordingRef.current) {
      clearTimeout(maxRecordingRef.current);
      maxRecordingRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolumeLevel(0);
    silenceCountRef.current = 0;
    hasSpeechRef.current = false;
    isStoppingRef.current = false;
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    const state = useAvatarStore.getState();
    if (state.isThinking || state.isSpeaking) return;

    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        stopLipSync();
      }
      setSpeaking(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Volume visualization loop
      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolumeLevel(Math.min(100, (avg / 128) * 100));
        volumeAnimRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      // MediaRecorder setup
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        cleanupRecording();

        if (isStoppingRef.current) return;
        if (audioChunksRef.current.length === 0) {
          setIsRecording(false);
          setListening(false);
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setIsRecording(false);
          setListening(false);

          try {
            const res = await fetch("/api/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64Audio }),
            });
            const data = await res.json();

            if (data.success && data.text) {
              processMessageRef.current?.(data.text);
            } else {
              setError(data.error || "Could not understand audio");
              if (useAvatarStore.getState().autoListen) {
                setTimeout(() => startRecordingRef.current?.(), 500);
              }
            }
          } catch (err) {
            console.error("Transcription error:", err);
            setError("Transcription failed");
            if (useAvatarStore.getState().autoListen) {
              setTimeout(() => startRecordingRef.current?.(), 500);
            }
          }
        };
        reader.readAsDataURL(blob);
      };

      // Voice Activity Detection
      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (avg > 10) {
          hasSpeechRef.current = true;
          silenceCountRef.current = 0;
        } else if (hasSpeechRef.current) {
          silenceCountRef.current++;
          if (silenceCountRef.current >= 3) {
            mediaRecorder.stop();
            if (vadIntervalRef.current) {
              clearInterval(vadIntervalRef.current);
              vadIntervalRef.current = null;
            }
          }
        }
      }, 500);

      // Safety: max 30s recording
      maxRecordingRef.current = setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      }, 30000);

      mediaRecorder.start(100);
      setIsRecording(true);
      setListening(true);
      setExpression("neutral");
    } catch (err) {
      console.error("Microphone error:", err);
      setError(
        "Could not access microphone. Please grant microphone permission."
      );
    }
  }, [setListening, setExpression, setError, setSpeaking, stopLipSync, cleanupRecording]);

  startRecordingRef.current = startRecording;

  // Stop recording
  const stopRecording = useCallback(() => {
    isStoppingRef.current = true;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setListening(false);
    cleanupRecording();
  }, [setListening, cleanupRecording]);

  // Send text message
  const handleSendText = useCallback(() => {
    if (!textInput.trim() || isThinking) return;
    processMessage(textInput);
    setTextInput("");
  }, [textInput, isThinking, processMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  const isBusy = isThinking || isSpeaking;

  return (
    <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 p-3">
        {/* Mic button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "default"}
              className={`h-10 w-10 rounded-full transition-all duration-200 shrink-0 ${
                isRecording
                  ? "animate-pulse shadow-lg shadow-red-500/25"
                  : isBusy
                    ? "opacity-50"
                    : "hover:shadow-lg hover:shadow-amber-500/20"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isBusy && !isRecording}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : isThinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRecording
              ? "Stop recording"
              : isBusy
                ? isThinking
                  ? "Processing..."
                  : "Speaking..."
                : "Start voice input"}
          </TooltipContent>
        </Tooltip>

        {/* Volume indicator */}
        {isRecording && (
          <div className="flex items-center gap-0.5 shrink-0">
            <div className="flex gap-[2px] items-end h-5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-red-400 rounded-full transition-all duration-100"
                  style={{
                    height: `${Math.max(2, (volumeLevel / 100) * 20 * (0.5 + Math.random() * 0.5))}px`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Text input */}
        <div className="flex-1 flex gap-2 min-w-0">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isThinking ? "ARIA is thinking..." : "Type a message..."}
            disabled={isThinking}
            className="h-10 text-sm"
          />
          <Button
            size="icon"
            variant="default"
            className="h-10 w-10 rounded-full shrink-0"
            onClick={handleSendText}
            disabled={!textInput.trim() || isThinking}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Auto-listen toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={autoListen ? "default" : "ghost"}
              className={`h-10 w-10 rounded-full shrink-0 ${autoListen ? "text-amber-500" : "text-muted-foreground"}`}
              onClick={toggleAutoListen}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Auto-listen {autoListen ? "on" : "off"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 pb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isRecording
                ? "bg-red-500 animate-pulse"
                : isThinking
                  ? "bg-amber-500 animate-pulse"
                  : isSpeaking
                    ? "bg-green-500 animate-pulse"
                    : "bg-muted-foreground/50"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isRecording
              ? "Listening..."
              : isThinking
                ? "Thinking..."
                : isSpeaking
                  ? "Speaking..."
                  : "Ready"}
          </span>
        </div>
        {autoListen && (
          <span className="text-xs text-muted-foreground/70">
            Auto-listen enabled
          </span>
        )}
      </div>
    </div>
  );
}
