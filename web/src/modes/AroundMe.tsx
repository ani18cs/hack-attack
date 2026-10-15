import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { confidencePhrase, speech } from '../core/speech';
import { announcer } from '../vision/announcer';
import { api } from '../vision/api';
import { detector } from '../vision/detector';
import { processSpatialObject } from '../vision/spatial';

interface AroundMeProps {
  onStop: () => void;
  onDescribeOnce?: () => void;
}

export const AroundMe: React.FC<AroundMeProps> = ({ onStop }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [lastSummary, setLastSummary] = useState('Tap "Describe Scene" or ask "What is in front of me?"');
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Trigger detailed scene description via unified POST /api/analyze task="describe"
  const handleDescribe = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    speech.speak('Looking...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
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

  // Toggle continuous COCO-SSD detection stream
  const toggleContinuous = () => {
    setIsContinuous((prev) => {
      const next = !prev;
      speech.speak(next ? 'Continuous announcements on.' : 'Continuous announcements paused.', {
        priority: 'normal',
      });
      return next;
    });
  };

  // Continuous COCO-SSD detection loop (5-10 FPS time-gated)
  useEffect(() => {
    if (!isContinuous) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const detectLoop = async (now: number) => {
      if (!isMounted) return;

      // Throttle to ~8 FPS (approx 125ms per frame)
      if (now - lastTimeRef.current >= 125) {
        lastTimeRef.current = now;
        const video = camera.getVideoElement();
        if (video && video.readyState >= 2) {
          try {
            const rawDetections = await detector.detect(video);
            const spatialObjects = rawDetections.map((det) =>
              processSpatialObject(det, video.videoWidth || 640, video.videoHeight || 480)
            );
            announcer.process(spatialObjects);
          } catch (e) {
            console.warn('Continuous detection frame error:', e);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detectLoop);
    };

    animFrameRef.current = requestAnimationFrame(detectLoop);

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isContinuous]);

  // Clean up in-flight requests on exit
  useEffect(() => {
    return () => {
      api.abortTask('describe');
    };
  }, []);

  return (
    <ModeScreen
      title="Around Me"
      description={isContinuous ? 'Continuously scanning walking path...' : 'Scene awareness assistant'}
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Real-time summary display */}
        <div
          className="p-5 rounded-2xl bg-zinc-900 border-2 border-yellow-400 text-zinc-100 text-base font-medium shadow-md text-center min-h-[90px] flex items-center justify-center"
          aria-live="polite"
        >
          {isAnalyzing ? (
            <span className="text-yellow-400 font-bold animate-pulse">Analyzing scene with AI...</span>
          ) : (
            <span>{lastSummary}</span>
          )}
        </div>

        {/* Big tactile action button */}
        <BigButton
          label={isAnalyzing ? 'Looking...' : 'Describe Scene'}
          variant="primary"
          onClick={handleDescribe}
          disabled={isAnalyzing}
          className="w-full py-8 text-2xl"
          icon="👁️"
          ariaDescription="Captures a frame and describes what is in front of you"
        />

        {/* Continuous mode toggle */}
        <BigButton
          label={isContinuous ? 'Pause Continuous Scan' : 'Continuous Scan'}
          variant={isContinuous ? 'warning' : 'neutral'}
          onClick={toggleContinuous}
          className="w-full py-6 text-xl"
          icon={isContinuous ? '⏸️' : '▶️'}
          ariaDescription="Continuously announce obstacles and nearby objects"
        />

        <div className="text-center text-xs text-zinc-400 mt-2">
          Voice shortcuts: "What's in front of me", "Keep telling me what's around", or "Stop"
        </div>
      </div>
    </ModeScreen>
  );
};
