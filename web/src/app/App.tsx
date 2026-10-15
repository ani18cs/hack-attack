import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureHandler } from '../ask/gestureHandler';
import { routeUserRequest } from '../ask/router';
import { toolRuntime, type ToolRuntimeStatus } from '../ask/toolRuntime';
import type { RouterTool } from '../ask/types';
import { ControlPanel } from '../components/ControlPanel';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { networkMonitor } from '../core/network';
import { settings } from '../core/settings';
import { speech } from '../core/speech';
import { speechPolicy } from '../core/speechPolicy';
import { voice } from '../core/voice';
import type { SceneObject } from '../types';
import { announcer } from '../vision/announcer';
import { detector } from '../vision/detector';
import { FOCUS_CONFIG } from '../vision/focus';
import { processSpatialObject } from '../vision/spatial';
import { GuidanceEngine, type GuidanceState, type BlockerInfo, type GuidanceInputItem } from '../guidance/engine';
import { hapticChannel } from '../core/hapticChannel';

export const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [runtimeStatus, setRuntimeStatus] = useState<ToolRuntimeStatus>(toolRuntime.getStatus());
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);

  // Guidance state & nearest blocker
  const [guidanceState, setGuidanceState] = useState<GuidanceState>('CLEAR');
  const [nearestBlocker, setNearestBlocker] = useState<BlockerInfo | null>(null);
  const guidanceEngineRef = useRef(new GuidanceEngine());

  // Diagnostics and live detections
  const [detectedObjects, setDetectedObjects] = useState<SceneObject[]>([]);
  const [fps, setFps] = useState(8.5);
  const [detectorLatencyMs] = useState(55);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastDangerAlertTime = useRef(0);

  // Sync refs and speechPolicy guards for event handlers
  useEffect(() => {
    isListeningRef.current = isListening;
    isThinkingRef.current = isThinking;
    isSpeakingRef.current = isSpeaking;
    speechPolicy.setUserListening(isListening);
  }, [isListening, isThinking, isSpeaking]);

  // Subscribe to speech, runtime, and network
  useEffect(() => {
    const unsubSpeech = speech.subscribe((speaking) => setIsSpeaking(speaking));
    const unsubRuntime = toolRuntime.subscribe((status) => setRuntimeStatus(status));
    const unsubNetwork = networkMonitor.subscribe((online) => setIsOnline(online));

    return () => {
      unsubSpeech();
      unsubRuntime();
      unsubNetwork();
    };
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Ask Flow / Push-to-Talk Logic                                             */
  /* -------------------------------------------------------------------------- */
  const handleStartListening = async () => {
    if (isListeningRef.current || isThinkingRef.current) return;

    // Stop active speech before listening
    if (speech.isSpeaking()) {
      speech.stop();
    }

    setIsListening(true);
    isListeningRef.current = true;

    try {
      const transcript = await voice.listenOnce(8000);
      setIsListening(false);
      isListeningRef.current = false;

      if (!transcript) {
        speech.speak("I didn't catch that. Tap and try again.", { priority: 'normal' });
        return;
      }

      setIsThinking(true);
      isThinkingRef.current = true;

      // Handle SOS verbal confirmation if SOS flow is armed
      if (toolRuntime.isSosPending()) {
        const lower = transcript.toLowerCase();
        if (
          lower.includes('yes') ||
          lower.includes('confirm') ||
          lower.includes('send') ||
          lower.includes('haan') ||
          lower.includes('sari') ||
          lower.includes('howdu')
        ) {
          setIsThinking(false);
          isThinkingRef.current = false;
          await toolRuntime.confirmSos();
          return;
        } else if (
          lower.includes('no') ||
          lower.includes('cancel') ||
          lower.includes('stop') ||
          lower.includes('nahi') ||
          lower.includes('bedi')
        ) {
          setIsThinking(false);
          isThinkingRef.current = false;
          toolRuntime.cancelSos();
          return;
        }
      }

      // Route the user request (fastPath -> /api/ask -> clarify)
      const toolCall = await routeUserRequest(transcript, () => {
        handleStartListening();
      });

      setIsThinking(false);
      isThinkingRef.current = false;

      if (toolCall) {
        await toolRuntime.execute(toolCall);
      }
    } catch (err: any) {
      console.warn('[App] Listening / ask flow error:', err);
      setIsListening(false);
      setIsThinking(false);
      isListeningRef.current = false;
      isThinkingRef.current = false;
      speech.speak("Sorry, I couldn't understand. Try again.", { priority: 'normal' });
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Gestures Configuration                                                     */
  /* -------------------------------------------------------------------------- */
  const gestureHandler = useMemo(() => {
    return new GestureHandler(
      {
        onSingleTap: () => {
          handleStartListening();
        },
        onDoubleTap: () => {
          if (toolRuntime.isSosPending()) {
            // Double tap confirms emergency SOS
            toolRuntime.confirmSos();
          } else {
            // Double tap repeats last answer
            toolRuntime.handleRepeatLast();
          }
        },
        onTripleTap: () => {
          // Triple tap starts SOS confirmation deterministically
          toolRuntime.startSosConfirmation();
        },
        onLongPress: () => {
          // Long press opens hidden Control Panel
          setIsControlPanelOpen(true);
        },
      },
      { tapWindowMs: 350, longPressMs: 800 }
    );
  }, []);

  /* -------------------------------------------------------------------------- */
  /* Layer 1: Continuous Obstacle Tracking & Danger Interrupt                   */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (!hasStarted) return;
    let isMounted = true;
    let lastFrameTime = performance.now();
    let frameCount = 0;

    const startLayer1 = async () => {
      try {
        await detector.loadModel();
        if (!isMounted) return;

        const video = videoRef.current || camera.getVideoElement();
        if (video) {
          detector.startDetection(video);
        }
      } catch (err) {
        console.warn('[Layer 1] Detector start warning:', err);
      }
    };

    startLayer1();

    const unsubDetector = detector.subscribe((rawDetections) => {
      if (!isMounted) return;

      // Estimate FPS
      frameCount++;
      const now = performance.now();
      if (now - lastFrameTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFrameTime) * 10) / 10);
        frameCount = 0;
        lastFrameTime = now;
      }

      const video = videoRef.current || camera.getVideoElement();
      const vw = video?.videoWidth || 640;
      const vh = video?.videoHeight || 480;

      const objects = rawDetections.map((d) => processSpatialObject(d, vw, vh));
      setDetectedObjects(objects);

      // Render detection boxes on viewfinder HUD
      renderOverlay(rawDetections, vw, vh);

      // Notify watchdog of fresh detector frame
      hapticChannel.notifyFrameProcessed(Date.now());

      // Feed into GuidanceEngine for safety state machine & haptic language
      const guidanceItems: GuidanceInputItem[] = objects.map((o) => ({
        label: o.label,
        distanceM: o.distanceMeters ?? 3.0,
        direction: o.direction,
        zone: o.zone,
        widthM: o.bbox ? (o.bbox[2] / vw) * 1.8 : undefined,
        danger: o.danger,
      }));
      const guidanceOutput = guidanceEngineRef.current.processFrame({
        items: guidanceItems,
        timestamp: Date.now(),
      });
      setGuidanceState(guidanceOutput.state);
      setNearestBlocker(guidanceOutput.nearestBlocker);
      hapticChannel.setState(guidanceOutput.state);

      // Spoken alerts on critical transitions (e.g. entering STOP)
      if (guidanceOutput.stateChanged && guidanceOutput.state === 'STOP' && guidanceOutput.nearestBlocker) {
        const currentTime = Date.now();
        if (currentTime - lastDangerAlertTime.current >= 2000) {
          lastDangerAlertTime.current = currentTime;
          speech.speak(`Stop. ${guidanceOutput.nearestBlocker.label} ahead.`, { priority: 'danger' });
        }
      }

      // Layer 1 non-danger announcer: suppressed during listening or speaking
      if (!isListeningRef.current && !isSpeakingRef.current && settings.getSettings().verbosity !== 'quiet') {
        announcer.process(objects);
      }
    });

    return () => {
      isMounted = false;
      unsubDetector();
      hapticChannel.stop();
    };
  }, [hasStarted]);

  /* -------------------------------------------------------------------------- */
  /* Bounding Boxes Viewfinder Renderer                                         */
  /* -------------------------------------------------------------------------- */
  const renderOverlay = (
    detections: Array<{ bbox: [number, number, number, number]; label: string; score: number }>,
    videoWidth: number,
    videoHeight: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the walking path corridor rectangle and zone labels
    const cw = canvas.width;
    const ch = canvas.height;
    const corridorLeft = cw * FOCUS_CONFIG.corridor.xMin;
    const corridorRight = cw * FOCUS_CONFIG.corridor.xMax;
    const corridorWidth = corridorRight - corridorLeft;
    const corridorTop = ch * FOCUS_CONFIG.ignoreTop;
    const corridorHeight = ch - corridorTop;

    // 1. Upper Ignored Zone
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(0, 0, cw, corridorTop);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.font = '11px sans-serif';
    ctx.fillText('Upper Zone (Ignored)', 10, Math.min(20, corridorTop - 6));

    // 2. Side Danger-Only Zones
    ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
    ctx.fillRect(0, corridorTop, corridorLeft, corridorHeight);
    ctx.fillRect(corridorRight, corridorTop, cw - corridorRight, corridorHeight);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.85)';
    ctx.font = '10px sans-serif';
    ctx.fillText('Side Zone (Danger only)', 10, corridorTop + 20);
    ctx.fillText('Side Zone (Danger only)', Math.max(10, cw - 130), corridorTop + 20);

    // 3. Central Walking Corridor Box
    ctx.save();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(corridorLeft, corridorTop, corridorWidth, corridorHeight);
    ctx.restore();

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Walking Path Corridor', corridorLeft + 8, corridorTop + 18);

    const scaleX = canvas.width / videoWidth;
    const scaleY = canvas.height / videoHeight;

    detections.forEach((det) => {
      const [x, y, w, h] = det.bbox;
      const rx = x * scaleX;
      const ry = y * scaleY;
      const rw = w * scaleX;
      const rh = h * scaleY;

      const isPersonOrVehicle = det.label === 'person' || det.label === 'car' || det.label === 'bus';
      const strokeColor = isPersonOrVehicle ? '#ef4444' : '#eab308';

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, rw, rh);

      // Label badge
      const labelText = `${det.label} ${Math.round(det.score * 100)}%`;
      ctx.font = 'bold 13px system-ui, sans-serif';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = strokeColor;
      ctx.fillRect(rx, ry - 20 > 0 ? ry - 20 : ry, textWidth + 10, 20);

      ctx.fillStyle = '#000000';
      ctx.fillText(labelText, rx + 5, ry - 20 > 0 ? ry - 5 : ry + 15);
    });
  };

  /* -------------------------------------------------------------------------- */
  /* Single Gesture Start Experience Unlock                                     */
  /* -------------------------------------------------------------------------- */
  const handleStartExperience = async () => {
    haptics.pulseConfirm();
    earcons.success();
    setHasStarted(true);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }

    try {
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
        await (DeviceOrientationEvent as any).requestPermission();
      }
    } catch (_) {}

    try {
      await camera.start();
      if (videoRef.current) {
        camera.setVideoElement(videoRef.current);
      }
    } catch (err: any) {
      console.warn('[App] Camera start warning:', err);
      speech.speak('Camera permission denied or camera unavailable.', { priority: 'danger' });
    }

    // Start continuous guidance haptic channel
    hapticChannel.start();

    // First-run spoken welcome per spec
    const welcome =
      'AndhaDhun is on. One short buzz means keep going. A long buzz means stop. Keep using your cane. Tap anywhere and ask me anything.';
    speech.speak(welcome, { priority: 'normal' });
  };

  /* -------------------------------------------------------------------------- */
  /* Render: Welcome Screen                                                     */
  /* -------------------------------------------------------------------------- */
  if (!hasStarted) {
    return (
      <main className="h-screen w-screen flex flex-col items-center justify-center p-4 bg-black select-none">
        <button
          type="button"
          onClick={handleStartExperience}
          className="touch-target w-full h-full max-w-lg max-h-[85vh] bg-yellow-400 text-black font-black text-4xl sm:text-5xl rounded-3xl border-8 border-yellow-200 shadow-[0_0_60px_rgba(255,221,0,0.6)] flex flex-col items-center justify-center gap-6 p-6 active:scale-98 transition-transform focus:ring-8 focus:ring-white"
          aria-label="Start AndhaDhun Assistant. Tap anywhere on this screen to unlock camera and audio."
        >
          <span className="text-8xl">👁️🔊</span>
          <span className="text-center">START ANDHADHUN</span>
          <span className="text-base sm:text-lg font-semibold text-zinc-900 bg-yellow-300 px-6 py-2 rounded-full">
            Tap anywhere to start
          </span>
        </button>
      </main>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Render: ONE Single Screen Eyes-Free UI                                     */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
      {/* 1. Full-Bleed Live Camera View */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        aria-hidden="true"
      />

      {/* 2. Detection Overlay Canvas for Bounding Boxes */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* 3. Compact Floating Status Chip (Top) */}
      <div className="absolute top-4 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border-2 shadow-2xl backdrop-blur-md text-sm sm:text-base font-bold transition-all ${
            isListening
              ? 'bg-red-600/90 border-red-300 text-white animate-pulse'
              : isThinking
              ? 'bg-purple-600/90 border-purple-300 text-white animate-pulse'
              : isSpeaking
              ? 'bg-blue-600/90 border-blue-300 text-white'
              : runtimeStatus.sosConfirmationPending
              ? 'bg-red-700 border-red-300 text-white animate-bounce'
              : runtimeStatus.activeTool
              ? 'bg-yellow-400/90 border-yellow-200 text-black'
              : !isOnline
              ? 'bg-zinc-800/90 border-amber-500 text-amber-200'
              : 'bg-black/75 border-zinc-700 text-zinc-200'
          }`}
        >
          {isListening && <span className="animate-ping text-base">🔴</span>}
          {isThinking && <span className="text-base">🧠</span>}
          {isSpeaking && <span className="text-base">🔊</span>}
          {runtimeStatus.sosConfirmationPending && <span className="text-base">🆘</span>}
          {!isOnline && <span className="text-base">⚠️</span>}

          <span>
            {isListening
              ? 'Listening... Speak now'
              : isThinking
              ? 'Thinking...'
              : runtimeStatus.sosConfirmationPending
              ? 'Confirm SOS? Say Yes or Double-Tap'
              : isSpeaking
              ? 'Speaking...'
              : runtimeStatus.activeTool
              ? `Active: ${runtimeStatus.activeTool.replace('_', ' ')}`
              : !isOnline
              ? 'Offline · Safety Active'
              : 'AndhaDhun Ready · Tap to Ask'}
          </span>
        </div>
      </div>

      {/* 4. One Giant Touch Target Covering Entire Screen */}
      <button
        type="button"
        role="button"
        aria-label={
          isListening
            ? 'Listening to your request'
            : runtimeStatus.sosConfirmationPending
            ? 'Emergency confirmation pending. Double tap to send emergency message, or single tap and say yes or no.'
            : 'Tap anywhere to ask. Double tap to repeat last answer. Triple tap for emergency SOS. Hold for control panel.'
        }
        onPointerDown={() => gestureHandler.onPointerDown()}
        onPointerUp={() => gestureHandler.onPointerUp()}
        onPointerCancel={() => gestureHandler.onPointerCancel()}
        onClick={() => gestureHandler.registerTap()}
        className="absolute inset-0 w-full h-full z-15 bg-transparent cursor-pointer focus:outline-none active:bg-white/5 transition-colors"
      >
        <span className="sr-only">Tap to ask</span>
      </button>

      {/* 5. Minimal Eyes-Free Hint Footer for Sighted Judges */}
      <div className="absolute bottom-5 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-zinc-800 text-zinc-400 text-xs text-center space-y-0.5">
          <p className="font-semibold text-zinc-300">
            Single tap: Ask anything · Double tap: Repeat · Triple tap: SOS
          </p>
          <p className="text-[11px] text-zinc-500">Hold 800ms for Control Panel · Obstacle guard is always on</p>
        </div>
      </div>

      {/* 6. Hidden Control Panel Overlay */}
      <ControlPanel
        isOpen={isControlPanelOpen}
        onClose={() => setIsControlPanelOpen(false)}
        fps={fps}
        detectorLatencyMs={detectorLatencyMs}
        serverLatencyMs={0}
        isOnline={isOnline}
        detectedObjects={detectedObjects}
        guidanceState={guidanceState}
        nearestBlocker={nearestBlocker}
        onSelectTool={async (tool: RouterTool, args?: Record<string, any>) => {
          await toolRuntime.execute({
            tool,
            args: args || {},
            confidence: 1.0,
            source: 'local',
          });
        }}
        onTriggerSos={() => {
          toolRuntime.startSosConfirmation();
        }}
      />
    </div>
  );
};
