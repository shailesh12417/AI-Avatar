"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAvatarStore } from "@/lib/stores/avatar-store";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, PhoneCall, PhoneOff, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import type { AvatarExpression } from "@/lib/types";

function useLipSyncWhileSpeaking() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(0);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      phaseRef.current += 0.3;
      const value =
        (Math.sin(phaseRef.current * 3.5) * 0.3 +
          Math.sin(phaseRef.current * 7) * 0.15 +
          Math.sin(phaseRef.current * 1.2) * 0.25 +
          0.3) *
        (0.6 + Math.random() * 0.4);
      useAvatarStore
        .getState()
        .setMouthOpenness(Math.max(0, Math.min(1, value)));
    }, 50);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    phaseRef.current = 0;
    useAvatarStore.getState().setMouthOpenness(0);
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
}

export default function VoiceControl() {
  const [conversationActive, setConversationActive] = useState(false);

  const conversationActiveRef = useRef(false);
  const sessionRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const {
    isListening,
    setListening,
    isThinking,
    setThinking,
    isSpeaking,
    setSpeaking,
    addMessage,
    clearMessages,
    setExpression,
    setError,
  } = useAvatarStore();

  const { start: startLipSync, stop: stopLipSync } =
    useLipSyncWhileSpeaking();

  const startListeningRef = useRef<() => void>();
  const processMessageRef = useRef<(text: string, session: number) => void>();

  const detectExpression = useCallback((text: string, emotion: string) => {
    const validEmotions: AvatarExpression[] = [
      "neutral", "happy", "angry", "sad", "surprised", "thinking", "talking",
    ];
    if (emotion && validEmotions.includes(emotion as AvatarExpression)) {
      return emotion as AvatarExpression;
    }

    const lower = text.toLowerCase();
    if (
      lower.includes("great") || lower.includes("wonderful") ||
      lower.includes("happy") || lower.includes("love") ||
      lower.includes("excited") || lower.includes("glad")
    ) {
      return "happy";
    }
    if (
      lower.includes("unfortunately") || lower.includes("sorry") ||
      lower.includes("sad") || lower.includes("regret")
    ) {
      return "sad";
    }
    if (
      lower.includes("wow") || lower.includes("amazing") ||
      lower.includes("incredible") || lower.includes("surprising")
    ) {
      return "surprised";
    }
    return "neutral";
  }, []);

  const scheduleNextListen = useCallback((session: number, delay = 700) => {
    window.setTimeout(() => {
      if (conversationActiveRef.current && sessionRef.current === session) {
        startListeningRef.current?.();
      }
    }, delay);
  }, []);

  const speakText = useCallback(
    (text: string, emotion: AvatarExpression, session: number) => {
      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        !conversationActiveRef.current ||
        sessionRef.current !== session
      ) {
        setSpeaking(false);
        setExpression(emotion || "neutral");
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;

      const preferredVoice = window.speechSynthesis
        .getVoices()
        .find(
          (voice) =>
            voice.lang.startsWith("en") &&
            (voice.name.includes("Samantha") ||
              voice.name.includes("Google") ||
              voice.name.includes("Female") ||
              voice.name.includes("Natural"))
        );
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        if (!conversationActiveRef.current || sessionRef.current !== session) {
          window.speechSynthesis.cancel();
          return;
        }
        setSpeaking(true);
        startLipSync();
        setExpression("talking");
      };

      utterance.onend = () => {
        stopLipSync();
        setSpeaking(false);
        setExpression(emotion || "neutral");
        scheduleNextListen(session);
      };

      utterance.onerror = () => {
        stopLipSync();
        setSpeaking(false);
        setExpression(emotion || "neutral");
        scheduleNextListen(session);
      };

      window.speechSynthesis.speak(utterance);
    },
    [scheduleNextListen, setExpression, setSpeaking, startLipSync, stopLipSync]
  );

  const processMessage = useCallback(
    async (text: string, session: number) => {
      if (
        !text.trim() ||
        !conversationActiveRef.current ||
        sessionRef.current !== session
      ) {
        return;
      }

      addMessage("user", text);
      setThinking(true);
      setExpression("thinking");

      try {
        const history = useAvatarStore
          .getState()
          .messages.slice(-10)
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content.replace(/^\[\w+\]\s*/, ""),
          }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });
        const data = await res.json();

        if (
          !conversationActiveRef.current ||
          sessionRef.current !== session
        ) {
          return;
        }

        setThinking(false);

        if (data.success) {
          const emotion = detectExpression(data.text, data.emotion);
          addMessage("assistant", data.text);
          setSpeaking(true);
          speakText(data.text, emotion, session);
          return;
        }

        setError(data.error || "Failed to get response");
        setExpression("sad");
        scheduleNextListen(session, 600);
      } catch (err) {
        console.error("Chat error:", err);
        if (
          conversationActiveRef.current &&
          sessionRef.current === session
        ) {
          setThinking(false);
          setError("Network error. Please try again.");
          setExpression("sad");
          scheduleNextListen(session, 600);
        }
      }
    },
    [
      addMessage, detectExpression, scheduleNextListen,
      setError, setExpression, setSpeaking, setThinking, speakText,
    ]
  );

  processMessageRef.current = processMessage;

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const session = sessionRef.current;
    if (!conversationActiveRef.current || sessionRef.current !== session) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        const text = last[0].transcript.trim();
        if (text) {
          try { recognition.stop(); } catch {}
          processMessageRef.current?.(text, session);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
      if (conversationActiveRef.current && sessionRef.current === session) {
        setError(`Speech recognition: ${event.error}`);
        scheduleNextListen(session, 1000);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setListening(false);
      const state = useAvatarStore.getState();
      if (
        conversationActiveRef.current &&
        sessionRef.current === session &&
        !state.isThinking &&
        !state.isSpeaking
      ) {
        scheduleNextListen(session, 300);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      setExpression("neutral");
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
      setError("Failed to start speech recognition.");
    }
  }, [scheduleNextListen, setError, setExpression, setListening]);

  startListeningRef.current = startListening;

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
  }, [setListening]);

  const startConversation = useCallback(() => {
    sessionRef.current += 1;
    conversationActiveRef.current = true;
    setConversationActive(true);
    clearMessages();
    setError(null);
    setThinking(false);
    setSpeaking(false);
    setExpression("neutral");
    stopLipSync();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    startListeningRef.current?.();
  }, [
    clearMessages, setError, setExpression, setSpeaking, setThinking, stopLipSync,
  ]);

  const stopConversation = useCallback(() => {
    sessionRef.current += 1;
    conversationActiveRef.current = false;
    setConversationActive(false);

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    stopLipSync();
    stopSpeechRecognition();
    setThinking(false);
    setSpeaking(false);
    setExpression("neutral");
  }, [
    stopLipSync, stopSpeechRecognition, setExpression,
    setListening, setSpeaking, setThinking,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      conversationActiveRef.current = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopLipSync();
      stopSpeechRecognition();
    };
  }, [stopLipSync, stopSpeechRecognition]);

  const statusLabel = isListening
    ? "Listening..."
    : isThinking
      ? "Thinking..."
      : isSpeaking
        ? "Speaking..."
        : conversationActive
          ? "Ready for your voice"
          : "Conversation stopped";

  return (
    <div className="absolute inset-x-0 bottom-0 z-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-5 pb-7 pt-8 sm:pb-9">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full flex-col items-center gap-4 rounded-lg border border-white/10 bg-black/45 p-4 shadow-2xl backdrop-blur-md sm:flex-row sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                conversationActive
                  ? "bg-amber-400 text-stone-950"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {isThinking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isSpeaking ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{statusLabel}</p>
              <p className="text-xs text-white/55">
                {conversationActive
                  ? "Speak naturally. ARIA will reply and listen again."
                  : "Press start to begin a voice conversation."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isListening && (
              <div className="flex h-8 items-end gap-1" aria-hidden="true">
                {[0.55, 0.8, 1, 0.7, 0.45].map((scale, index) => (
                  <span
                    key={scale}
                    className="w-1.5 rounded-full bg-amber-300 animate-pulse"
                    style={{
                      height: `${8 + scale * 12}px`,
                      opacity: 0.55 + index * 0.08,
                      animationDelay: `${index * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            )}

            <Button
              size="lg"
              variant={conversationActive ? "destructive" : "default"}
              className="h-12 min-w-44 rounded-full px-6 text-sm font-semibold"
              onClick={
                conversationActive ? stopConversation : startConversation
              }
            >
              {conversationActive ? (
                <>
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Stop Conversation
                </>
              ) : (
                <>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Start Conversation
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
