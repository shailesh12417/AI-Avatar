"use client";

import { useEffect, useRef } from "react";
import { useAvatarStore } from "@/lib/stores/avatar-store";
import type { AvatarExpression } from "@/lib/types";

export default function FallbackAvatar() {
  const expressionRef = useRef(useAvatarStore.getState().expression);
  const mouthRef = useRef(useAvatarStore.getState().mouthOpenness);

  useEffect(() => {
    const unsub = useAvatarStore.subscribe((s) => {
      expressionRef.current = s.expression;
      mouthRef.current = s.mouthOpenness;
    });
    return unsub;
  }, []);

  // Blinking logic
  const blinkRef = useRef(false);
  useEffect(() => {
    function doBlink() {
      blinkRef.current = true;
      setTimeout(() => {
        blinkRef.current = false;
      }, 150);
      setTimeout(doBlink, 2000 + Math.random() * 4000);
    }
    const timeout = setTimeout(doBlink, 1000 + Math.random() * 2000);
    return () => clearTimeout(timeout);
  }, []);

  // Expression-dependent styles
  const getEyeTransform = (expr: AvatarExpression) => {
    switch (expr) {
      case "happy":
        return "scaleY(0.85)";
      case "surprised":
        return "scaleY(1.15)";
      case "angry":
        return "scaleY(0.9)";
      case "sad":
        return "scaleY(0.85)";
      default:
        return "scaleY(1)";
    }
  };

  const getEyebrowY = (expr: AvatarExpression) => {
    switch (expr) {
      case "surprised":
        return "-8px";
      case "sad":
        return "2px";
      case "angry":
        return "0px";
      case "thinking":
        return "-2px";
      default:
        return "-3px";
    }
  };

  const getMouthColor = (expr: AvatarExpression) => {
    switch (expr) {
      case "happy":
        return "bg-rose-400";
      case "angry":
        return "bg-rose-500";
      case "sad":
        return "bg-rose-300";
      default:
        return "bg-rose-400";
    }
  };

  const expr = expressionRef.current;
  const getMouthShape = () => {
    switch (expr) {
      case "happy":
        return "w-10 h-3 rounded-full";
      case "surprised":
        return "w-5 h-7 rounded-full";
      case "angry":
        return "w-8 h-2 rounded-sm";
      case "sad":
        return "w-7 h-2 rounded-full mt-1";
      case "thinking":
        return "w-4 h-4 rounded-full";
      default:
        return "w-7 h-[3px] rounded-full";
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-80 h-80 rounded-full bg-amber-500/5 blur-3xl animate-pulse" />
      <div className="absolute w-60 h-60 rounded-full bg-orange-500/5 blur-2xl" />

      {/* Avatar container */}
      <div className="relative" style={{ perspective: "800px" }}>
        {/* Head */}
        <div
          className="relative w-56 h-64 rounded-[50%] overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, #fef3c7, #fde68a, #fcd34d)",
            boxShadow:
              "0 0 60px rgba(251, 191, 36, 0.15), 0 0 120px rgba(251, 191, 36, 0.05), inset 0 -20px 40px rgba(0,0,0,0.05)",
          }}
        >
          {/* Hair */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-b-[50%] z-10"
            style={{
              background:
                "linear-gradient(180deg, #1c1917, #292524, #44403c)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          />

          {/* Hair side left */}
          <div
            className="absolute top-12 -left-4 w-14 h-28 rounded-r-[50%] z-10"
            style={{ background: "linear-gradient(180deg, #1c1917, #292524)" }}
          />

          {/* Hair side right */}
          <div
            className="absolute top-12 -right-4 w-14 h-28 rounded-l-[50%] z-10"
            style={{ background: "linear-gradient(180deg, #1c1917, #292524)" }}
          />

          {/* Face area */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
            {/* Eyebrows */}
            <div className="flex items-center gap-10 mb-3">
              <div
                className="w-7 h-[3px] bg-stone-800/70 rounded-full transition-all duration-300 origin-right -rotate-6"
                style={{
                  transform: `translateY(${getEyebrowY(expr)}) rotate(-6deg)`,
                }}
              />
              <div
                className="w-7 h-[3px] bg-stone-800/70 rounded-full transition-all duration-300 origin-left rotate-6"
                style={{
                  transform: `translateY(${getEyebrowY(expr)}) rotate(6deg)`,
                }}
              />
            </div>

            {/* Eyes */}
            <div className="flex items-center gap-10 mb-4">
              {/* Left eye */}
              <div
                className="relative w-9 h-9 rounded-full bg-white overflow-hidden transition-transform duration-200"
                style={{
                  transform: blinkRef.current
                    ? "scaleY(0.1)"
                    : getEyeTransform(expr),
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  className="absolute w-5 h-5 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 40% 40%, #7c3aed, #4c1d95)",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                />
                {/* Highlight */}
                <div className="absolute w-2 h-2 bg-white rounded-full top-2.5 left-3 opacity-90" />
                <div className="absolute w-1 h-1 bg-white rounded-full top-5 left-5.5 opacity-60" />
              </div>

              {/* Right eye */}
              <div
                className="relative w-9 h-9 rounded-full bg-white overflow-hidden transition-transform duration-200"
                style={{
                  transform: blinkRef.current
                    ? "scaleY(0.1)"
                    : getEyeTransform(expr),
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  className="absolute w-5 h-5 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 40% 40%, #7c3aed, #4c1d95)",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                />
                {/* Highlight */}
                <div className="absolute w-2 h-2 bg-white rounded-full top-2.5 left-3 opacity-90" />
                <div className="absolute w-1 h-1 bg-white rounded-full top-5 left-5.5 opacity-60" />
              </div>
            </div>

            {/* Blush */}
            <div className="flex items-center gap-16 mb-2">
              <div className="w-8 h-3 rounded-full bg-pink-300/40" />
              <div className="w-8 h-3 rounded-full bg-pink-300/40" />
            </div>

            {/* Nose */}
            <div className="w-2 h-2 rounded-full bg-amber-700/30 mb-3" />

            {/* Mouth */}
            <div
              className={`transition-all duration-150 ease-out ${getMouthColor()} ${getMouthShape()}`}
              style={{
                height: expr === "happy"
                  ? "12px"
                  : expr === "surprised"
                    ? "28px"
                    : expr === "sad"
                      ? "8px"
                      : `${Math.max(3, mouthRef.current * 20)}px`,
                width: expr === "happy"
                  ? "40px"
                  : expr === "surprised"
                    ? "20px"
                    : expr === "angry"
                      ? "32px"
                      : `${Math.max(28, mouthRef.current * 40)}px`,
              }}
            />
          </div>
        </div>

        {/* Neck */}
        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-14 h-8 rounded-b-xl"
          style={{ background: "linear-gradient(180deg, #fde68a, #fcd34d)" }}
        />
      </div>
    </div>
  );
}
