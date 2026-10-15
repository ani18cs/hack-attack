
import React, { useEffect, useRef, useState } from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';
import { camera } from '../core/camera';
import { detector } from '../vision/detector';
import { processSpatialObject } from '../vision/spatial';
import { announcer } from '../vision/announcer';
import type { SceneObject } from '../types';

interface AroundMeProps {
  onStop: () => void;
  onDescribeOnce?: () => void;
}

export const AroundMe: React.FC<AroundMeProps> = ({
  onStop,
  onDescribeOnce,
}) => {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [status, setStatus] = useState('Loading vision model...');
  const objectsRef = useRef<SceneObject[]>([]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      try {
        const video = camera.getVideoElement();

        if (!video) {
          setStatus('Camera is not available. Please restart the experience.');
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
              video.videoHeight,
            ),
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
      detector.stopDetection();
      announcer.reset();
      objectsRef.current = [];
    };
  }, []);

  return (
    <ModeScreen
      title="Around Me"
      description="Announcing objects and surroundings in real time."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        <BigButton
          label="Detailed Scene Description"
          variant="primary"
          onClick={onDescribeOnce}
          className="w-full py-8 text-xl"
          ariaDescription="Captures a frame and provides a detailed scene summary via Gemini"
        />

        <div className="text-center text-sm text-zinc-400" role="status">
          {status}
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
          <h2 className="mb-3 text-lg font-bold text-white">
            Detected objects ({objects.length})
          </h2>

          {objects.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Waiting for objects...
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {objects.slice(0, 5).map((object, index) => (
                <li
                  key={`${object.label}-${object.direction}-${index}`}
                  className={`rounded-xl p-3 text-sm ${
                    object.danger
                      ? 'bg-red-950 text-red-200'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <span className="font-semibold">{object.label}</span>
                  {' — '}
                  {object.direction}, {object.distance}
                  {object.danger ? ' — HAZARD' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModeScreen>
  );
};
