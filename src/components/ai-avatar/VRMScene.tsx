"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useAvatarStore } from "@/lib/stores/avatar-store";
import FallbackAvatar from "./FallbackAvatar";

const VRM_URL = "/avatar.vrm";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

export default function VRMScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const vrmRef = useRef<any>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const animFrameRef = useRef(0);

  // Blink state
  const blinkRef = useRef({
    value: 0,
    timer: 0,
    nextBlink: 2 + Math.random() * 4,
  });

  // Wave greeting state
  const waveRef = useRef({
    active: false,
    startTime: 0,
    type: "hi", // "hi" | "knock"
  });

  // Idle wave state
  const idleWaveRef = useRef(35);
  const conversationActiveRef = useRef(useAvatarStore.getState().isConversationActive);
  const prevConversationActiveRef = useRef(useAvatarStore.getState().isConversationActive);

  // Store refs for animation loop (avoids stale closures)
  const expressionRef = useRef(useAvatarStore.getState().expression);
  const mouthRef = useRef(useAvatarStore.getState().mouthOpenness);
  const setVrmLoaded = useAvatarStore((s) => s.setVrmLoaded);

  // Subscribe to store changes
  useEffect(() => {
    const unsub1 = useAvatarStore.subscribe((s) => {
      expressionRef.current = s.expression;
      mouthRef.current = s.mouthOpenness;
      conversationActiveRef.current = s.isConversationActive;
    });
    return unsub1;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera — upper body portrait view
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.50, 1.9);
    camera.lookAt(0, 1.5, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    const container = containerRef.current;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(1, 2, 3).normalize();
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-1, 1, 2).normalize();
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.5);
    rimLight.position.set(0, 1, -2).normalize();
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Ground plane for subtle shadow
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Load VRM
    const loader = new GLTFLoader();
    loader.register((parser) => {
    // @ts-expect-error - VRMLoaderPlugin type mismatch
      return new VRMLoaderPlugin(parser);
    });

    // Timeout for loading (30s for large custom VRM files)
    const loadTimeout = setTimeout(() => {
      if (isLoading && !cancelled) {
        console.warn("VRM load timed out, using fallback");
        setLoadError(true);
      }
    }, 30000);

    loader.load(
      VRM_URL,
      (gltf) => {
        if (cancelled) return;
        clearTimeout(loadTimeout);

        try {
          const vrm = (gltf as any).userData.vrm;
          if (!vrm) {
            console.error("No VRM data in loaded model");
            setLoadError(true);
            return;
          }

          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);

          // No extra rotation — VRM models face +Z by default, camera is at +Z
          vrm.scene.rotation.y = 0;

          scene.add(vrm.scene);
          vrmRef.current = vrm;
          setVrmLoaded(true);
          setIsLoading(false);

          // Set lookAt target
          if (vrm.lookAt) {
            vrm.lookAt.target = camera;
          }

          // Start render loop
          const clock = new THREE.Clock();
          clockRef.current = clock;

          // Start wave greeting (clock is now ready)
          waveRef.current.active = true;
          waveRef.current.type = "hi";
          waveRef.current.startTime = clockRef.current.getElapsedTime();

          renderLoop();
        } catch (err) {
          console.error("VRM setup error:", err);
          setLoadError(true);
        }
      },
      (progress) => {
        // Loading progress
      },
      (error) => {
        if (cancelled) return;
        clearTimeout(loadTimeout);
        console.error("VRM load error:", error);
        setLoadError(true);
      }
    );

    // Render loop
    function renderLoop() {
      if (cancelled) return;
      animFrameRef.current = requestAnimationFrame(renderLoop);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();
      const vrm = vrmRef.current;

      if (vrm) {
        vrm.update(delta);

        // ---- Blinking ----
        const blink = blinkRef.current;
        blink.timer += delta;
        if (!blink.nextBlink || blink.timer >= blink.nextBlink) {
          blink.value = 1;
          blink.timer = 0;
          blink.nextBlink = 2 + Math.random() * 5;
        }
        if (blink.value > 0) {
          blink.value -= delta * 8;
          if (blink.value < 0) blink.value = 0;
        }

        // ---- Wave greeting animation ----
        const WAVE_DURATION = 3.5;
        const wave = waveRef.current;
        const waveT = wave.active
          ? (elapsed - wave.startTime) / WAVE_DURATION
          : 1;

        if (wave.active && waveT >= 1) {
          wave.active = false;
          if (!conversationActiveRef.current) {
            idleWaveRef.current = elapsed + 10;
          }
        }

        // Reset idle timer when conversation stops
        if (prevConversationActiveRef.current && !conversationActiveRef.current) {
          idleWaveRef.current = elapsed + 10;
        }
        prevConversationActiveRef.current = conversationActiveRef.current;

        // Idle wave trigger — every 10s when conversation is stopped
        if (!wave.active && !conversationActiveRef.current && elapsed >= idleWaveRef.current) {
          wave.active = true;
          wave.startTime = elapsed;
          idleWaveRef.current = elapsed + 10;
        }

        const waveAnimating = wave.active && waveT < 1;

        // Interpolation factors across raise→wave→lower phases
        let armBlend = 0;
        let headTiltBlend = 0;
        let smileBlend = 0;
        let handWaveOsc = 0;

        if (waveAnimating) {
          if (waveT < 0.25) {
            const p = smoothstep(waveT / 0.25);
            armBlend = p;
            headTiltBlend = p;
            smileBlend = p;
          } else if (waveT < 0.8) {
            armBlend = 1;
            headTiltBlend = 1;
            smileBlend = 1;
            const cycle = (waveT - 0.25) / 0.55;
            const raw = Math.sin(cycle * Math.PI * 2 * 4);
            const easeInOut = Math.min(cycle * 4, 1) * Math.min((1 - cycle) * 4, 1);
            handWaveOsc = raw * 0.5 * easeInOut;
          } else {
            const p = smoothstep((waveT - 0.8) / 0.2);
            armBlend = 1 - p;
            headTiltBlend = 1 - p;
            smileBlend = 1 - p;
          }
        }

        // ---- Expression & Lip sync ----
        if (vrm.expressionManager) {
          try {
            if (vrm.expressionManager.setValue) {
              vrm.expressionManager.setValue("blink", blink.value);
              vrm.expressionManager.setValue("blinkLeft", blink.value);
              vrm.expressionManager.setValue("blinkRight", blink.value);
            }

            // Lip sync
            const m = mouthRef.current;
            if (vrm.expressionManager.setValue) {
              vrm.expressionManager.setValue("aa", m * 0.8);
              vrm.expressionManager.setValue("oh", m * 0.2);
              vrm.expressionManager.setValue("ee", m * 0.1);
            }

            // Expression presets — smile during wave greeting
            const expr = smileBlend > 0.5 ? "happy" : expressionRef.current;
            const expressionPresets = [
              "neutral",
              "happy",
              "angry",
              "sad",
              "surprised",
              "relaxed",
            ] as const;
            for (const preset of expressionPresets) {
              if (vrm.expressionManager.setValue) {
                vrm.expressionManager.setValue(preset, preset === expr ? 1 : 0);
              }
            }
          } catch {
            // Silently handle expression errors for VRM compatibility
          }
        }

        // ---- Wave arm positioning (lerp between idle and wave pose) ----
        if (vrm.humanoid) {
          const lUpper = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
          const rUpper = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");

          const lLower = vrm.humanoid.getNormalizedBoneNode("leftLowerArm");
          const rLower = vrm.humanoid.getNormalizedBoneNode("rightLowerArm");

          const lHand = vrm.humanoid.getNormalizedBoneNode("leftHand");
          const rHand = vrm.humanoid.getNormalizedBoneNode("rightHand");

          // LEFT ARM IDLE POSITION
          if (lUpper) {
            lUpper.rotation.set(0.2, 0, -1.5);
          }

          if (lLower) {
            lLower.rotation.set(0, 0, 0);
          }

          if (lHand) {
            lHand.rotation.set(0, 0, 0);
          }

        // RIGHT ARM WAVE ANIMATION
          if (rUpper) {
            rUpper.rotation.set(
              lerp(0.2, -0.9, armBlend),
              lerp(0, 0.2, armBlend),
              lerp(1.5, 1.2, armBlend),
            );
          }

  // ELBOW BEND
          if (rLower) {
            rLower.rotation.set(
              lerp(0, 1.7, armBlend),
              0,
              lerp(0, -1.8, armBlend),
            );
          }

  // HAND WAVE
          if (rHand) {
            rHand.rotation.set(
              0,
              handWaveOsc * 0.8,
              0.3,
            );
          }
        }

        // ---- Head motion with wave tilt ----
        if (vrm.humanoid) {
          const head = vrm.humanoid.getNormalizedBoneNode("head");
          if (head) {
            head.rotation.set(
              Math.sin(elapsed * 0.5) * 0.015 + headTiltBlend * 0.04,
              Math.sin(elapsed * 0.3) * 0.025 + headTiltBlend * -0.08,
              Math.sin(elapsed * 0.7) * 0.008 + headTiltBlend * 0.06,
            );
          }
        }
      }

      renderer.render(scene, camera);
    }

    // Resize
    function handleResize() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrameRef.current);

      if (
        containerRef.current &&
        renderer.domElement.parentNode === containerRef.current
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }

      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: THREE.Material) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [setVrmLoaded]);

  if (loadError) {
    return <FallbackAvatar />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading avatar...</p>
          </div>
        </div>
      )}
    </div>
  );
}
