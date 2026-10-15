import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { confidencePhrase, speech } from '../core/speech';
import type { SceneObject } from '../types';
import { announcer } from '../vision/announcer';
import { api } from '../vision/api';
import { detector } from '../vision/detector';
import { processSpatialObject } from '../vision/spatial';

interface AroundMeProps {
  onStop: () => void;
  onDescribeOnce?: () => void;
}

export const AroundMe: React.FC<AroundMeProps> = ({
  onStop,
  onDescribeOnce,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSummary, setLastSummary] = useState('Tap "Describe Scene" or ask "What is in front of me?"');
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [status, setStatus] = useState('Monitoring surroundings');
  const objectsRef = useRef<SceneObject[]>([]);

  // Real-time on-device spatial tracking
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      try {
        const video = camera.getVideoElement();
        if (!video) {
          setStatus('Camera unavailable. Tap start to initialize.');
          return;
        }

        await detector.loadModel();
        if (!active) return;

        unsubscribe = detector.subscribe((detections) => {
          if (!active || video.videoWidth === 0 || video.videoHeight === 0) {
            return;
          }

          const nextObjects = detections.map((detection) =>
            processSpatialObject(
              detection,
              video.videoWidth,
              video.videoHeight
            )
          );

          objectsRef.current = nextObjects;
          setObjects(nextObjects);
          announcer.process(nextObjects);
          setStatus('Detecting surroundings');
        });

        detector.startDetection(video);
      } catch (error) {
        console.error('Around Me detection failed:', error);
        if (active) {
          setStatus('Could not load vision model. Please try again.');
        }
      }
    };

    void start();

    return () => {
      active = false;
      unsubscribe?.();
      announcer.reset();
      objectsRef.current = [];
    };
  }, []);

  // Trigger detailed scene description via unified POST /api/analyze task="describe"
  const handleDescribe = async () => {
    if (onDescribeOnce) {
      onDescribeOnce();
    }
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    speech.speak('Looking...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(720, 0.65);
      if (!frame) {
        speech.speak('Camera not ready. Please try again.', { priority: 'normal' });
        setIsAnalyzing(false);
        return;
      }

      const res = await api.describe(frame, speech.getLang());
      if (res.ok && res.summary) {
        const spoken = confidencePhrase(res.confidence, res.summary);
        setLastSummary(spoken);
        speech.speak(spoken, { priority: 'normal' });
      } else {
        const fallback = res.summary || 'I could not describe the scene right now.';
        setLastSummary(fallback);
        speech.speak(fallback, { priority: 'normal' });
      }
    } catch (err: any) {
      console.error('AroundMe describe error:', err);
      speech.speak('Could not connect to vision server.', { priority: 'normal' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <ModeScreen
      title="Around Me"
      description="Scene awareness & real-time spatial object tracker"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-3 max-h-[62vh] overflow-y-auto px-1">
        {/* Real-time summary display */}
        <div
          className="p-4 rounded-2xl bg-zinc-900 border-2 border-yellow-400 text-zinc-100 text-base font-medium shadow-md text-center min-h-[75px] flex items-center justify-center"
          aria-live="polite"
        >
          {isAnalyzing ? (
            <span className="text-yellow-400 font-bold animate-pulse">Analyzing scene with AI...</span>
          ) : (
            <span>{lastSummary}</span>
          )}
        </div>

        {/* Big tactile action button for AI scene description */}
        <BigButton
          label={isAnalyzing ? 'Looking...' : 'Describe Scene (AI)'}
          variant="primary"
          onClick={handleDescribe}
          disabled={isAnalyzing}
          className="w-full py-7 text-2xl"
          icon="👁️"
          ariaDescription="Captures a frame and describes what is in front of you"
        />

        {/* Real-time detected objects list */}
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Real-Time Tracks ({objects.length})
            </h2>
            <span className="text-xs text-zinc-400">{status}</span>
          </div>

          {objects.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-2">
              Scanning for objects in camera view...
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {objects.slice(0, 5).map((object, index) => (
                <li
                  key={`${object.label}-${object.direction}-${index}`}
                  className={`rounded-xl p-2.5 text-xs flex items-center justify-between font-mono ${
                    object.danger
                      ? 'bg-red-950/80 border border-red-500 text-red-200 font-bold animate-pulse'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                  }`}
                >
                  <span className="font-bold text-yellow-300 uppercase">
                    {object.danger ? '⚠️ ' : ''}
                    {object.label}
                  </span>
                  <span>
                    {object.direction} · {object.distance}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-center text-xs text-zinc-400">
          Voice shortcuts: "What's in front of me", "Around me", or "Stop"
        </div>
      </div>
    </ModeScreen>
  );
};
