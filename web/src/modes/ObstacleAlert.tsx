
import React, { useEffect, useRef, useState } from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { detector } from '../vision/detector';
import { processSpatialObject } from '../vision/spatial';
import { speech } from '../core/speech';
import { haptics } from '../core/haptics';

interface ObstacleAlertProps {
  onStop: () => void;
  isHazardDetected?: boolean;
}

export const ObstacleAlert: React.FC<ObstacleAlertProps> = ({
  onStop,
  isHazardDetected: initialHazard = false,
}) => {
  const [isHazardDetected, setIsHazardDetected] = useState(initialHazard);
  const [status, setStatus] = useState('Starting obstacle detection...');
  const lastAlertTime = useRef(0);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      try {
        const video = camera.getVideoElement();

        if (!video) {
          setStatus('Camera unavailable. Restart the experience and try again.');
          return;
        }

        await detector.loadModel();

        if (!active) return;

        unsubscribe = detector.subscribe((detections) => {
          if (!active || !video.videoWidth || !video.videoHeight) return;

          const objects = detections.map((detection) =>
            processSpatialObject(
              detection,
              video.videoWidth,
              video.videoHeight,
            ),
          );

          const hazard = objects.find((object) => object.danger);
          setIsHazardDetected(Boolean(hazard));

          const now = Date.now();

          if (hazard && now - lastAlertTime.current >= 2500) {
            lastAlertTime.current = now;

            haptics.pulseDanger();
            speech.speak(`Stop. ${hazard.label} ahead.`, {
              priority: 'danger',
            });
          }

          setStatus('Monitoring walking corridor');
        });

        detector.startDetection(video);
      } catch (error) {
        console.error('Obstacle Alert detection failed:', error);

        if (active) {
          setStatus('Could not start detection. Check camera and model access.');
        }
      }
    };

    void start();

    return () => {
      active = false;
      unsubscribe?.();
      detector.stopDetection();
      haptics.cancel();
    };
  }, []);

  return (
    <ModeScreen
      title="Obstacle Alert"
      description="Continuous safety guard. Warns of obstacles in walking path."
      onStop={onStop}
    >
      <div
        className={`w-full p-8 rounded-3xl border-4 text-center transition-colors ${
          isHazardDetected
            ? 'bg-red-950 border-red-500 text-red-200 animate-pulse'
            : 'bg-zinc-900 border-emerald-500 text-emerald-300'
        }`}
      >
        <span className="text-6xl block mb-4">
          {isHazardDetected ? '⚠️' : '🛡️'}
        </span>

        <h2 className="text-2xl font-black mb-2">
          {isHazardDetected ? 'HAZARD AHEAD' : 'PATH CLEAR'}
        </h2>

        <p className="text-sm opacity-80">
          {isHazardDetected
            ? 'Stop immediately. Obstacle detected in forward path.'
            : status}
        </p>
      </div>
    </ModeScreen>
  );
};
