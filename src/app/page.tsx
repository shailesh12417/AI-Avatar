"use client";

import dynamic from "next/dynamic";
import { useAvatarStore } from "@/lib/stores/avatar-store";
import ChatPanel from "@/components/ai-avatar/ChatPanel";
import VoiceControl from "@/components/ai-avatar/VoiceControl";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Brain,
  Volume2,
  Radio,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

// Dynamic import for VRM scene (no SSR)
const VRMScene = dynamic(() => import("@/components/ai-avatar/VRMScene"), {
  ssr: false,
  loading: () => <AvatarLoadingState />,
});

function AvatarLoadingState() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-amber-400/30" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-amber-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Loading Avatar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Preparing ARIA...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AIAvatarPage() {
  const {
    isListening,
    isThinking,
    isSpeaking,
    expression,
    messages,
    clearMessages,
    autoListen,
    error,
    setError,
  } = useAvatarStore();

  const statusConfig = {
    listening: {
      label: "Listening",
      color: "bg-red-500",
      icon: Mic,
    },
    thinking: {
      label: "Thinking",
      color: "bg-amber-500",
      icon: Brain,
    },
    speaking: {
      label: "Speaking",
      color: "bg-emerald-500",
      icon: Volume2,
    },
    idle: {
      label: "Online",
      color: "bg-green-500",
      icon: Radio,
    },
  };

  const currentStatus = isListening
    ? statusConfig.listening
    : isThinking
      ? statusConfig.thinking
      : isSpeaking
        ? statusConfig.speaking
        : statusConfig.idle;

  const StatusIcon = currentStatus.icon;

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Avatar Section */}
      <div className="relative lg:w-[58%] w-full lg:h-full h-[45vh] min-h-[300px] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950" />

        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Platform glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent blur-sm" />

        {/* VRM Avatar */}
        <div className="relative flex-1">
          <VRMScene />
        </div>

        {/* Status overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${currentStatus.color} ${isListening || isThinking || isSpeaking ? "animate-pulse" : ""}`}
              />
              <div
                className={`absolute inset-0 w-2 h-2 rounded-full ${currentStatus.color} animate-ping opacity-75`}
              />
            </div>
            <StatusIcon className="w-3 h-3 text-white/70" />
            <span className="text-xs font-medium text-white/80">
              {currentStatus.label}
            </span>
          </div>

          {/* Expression badge */}
          <AnimatePresence mode="wait">
            {expression !== "neutral" && (
              <motion.div
                key={expression}
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Badge
                  variant="secondary"
                  className="bg-black/50 backdrop-blur-sm border border-white/10 text-white/80 text-xs capitalize"
                >
                  {expression}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top-right controls */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                  onClick={clearMessages}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear conversation</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Top-left branding */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white/90">ARIA</span>
            <span className="text-[10px] text-white/40">AI Avatar</span>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className="lg:w-[42%] w-full lg:h-full flex-1 flex flex-col bg-background border-l border-border/50">
        <ChatPanel />
        <VoiceControl />
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm shadow-lg">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-2 opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
