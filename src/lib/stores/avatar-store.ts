import { create } from "zustand";
import type { ChatMessage, AvatarExpression } from "../types";

interface AvatarAppStore {
  // Conversation messages
  messages: ChatMessage[];
  addMessage: (role: "user" | "assistant", content: string) => void;
  clearMessages: () => void;

  // Processing states
  isListening: boolean;
  setListening: (v: boolean) => void;
  isThinking: boolean;
  setThinking: (v: boolean) => void;
  isSpeaking: boolean;
  setSpeaking: (v: boolean) => void;

  // Avatar state
  expression: AvatarExpression;
  setExpression: (expr: AvatarExpression) => void;
  mouthOpenness: number;
  setMouthOpenness: (v: number) => void;

  // Error
  error: string | null;
  setError: (e: string | null) => void;

  // VRM loaded state
  vrmLoaded: boolean;
  setVrmLoaded: (v: boolean) => void;
}

export const useAvatarStore = create<AvatarAppStore>((set) => ({
  // Messages
  messages: [],
  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: Date.now(),
        },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  // States
  isListening: false,
  setListening: (v) => set({ isListening: v }),
  isThinking: false,
  setThinking: (v) => set({ isThinking: v }),
  isSpeaking: false,
  setSpeaking: (v) => set({ isSpeaking: v }),

  // Avatar
  expression: "neutral" as AvatarExpression,
  setExpression: (expr) => set({ expression: expr }),
  mouthOpenness: 0,
  setMouthOpenness: (v) => set({ mouthOpenness: v }),

  // Error
  error: null,
  setError: (e) => set({ error: e }),

  // VRM state
  vrmLoaded: false,
  setVrmLoaded: (v) => set({ vrmLoaded: v }),
}));
