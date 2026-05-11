"use client";

import { useEffect, useRef } from "react";
import { useAvatarStore } from "@/lib/stores/avatar-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPanel() {
  const messages = useAvatarStore((s) => s.messages);
  const isThinking = useAvatarStore((s) => s.isThinking);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full" ref={scrollRef}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">ARIA</h2>
          <p className="text-xs text-muted-foreground">
            {isThinking
              ? "Thinking..."
              : messages.length === 0
                ? "Ready to chat"
                : "Online"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 opacity-60">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Start a conversation
            </p>
            <p className="text-xs text-muted-foreground">
              Click the microphone to speak, or type a message below.
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {/* Thinking indicator */}
            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2.5"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
