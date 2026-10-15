import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import { spatialAudio } from '../core/spatialAudio';
import type { Direction, DistanceBucket } from '../types';
import { api } from '../vision/api';
import { detector } from '../vision/detector';
import { processSpatialObject } from '../vision/spatial';
import { FindState, FindStateMachine } from './findStateMachine';

interface FindProps {
  onStop: () => void;
  target?: string;
}

export const Find: React.FC<FindProps> = ({ onStop, target = 'washroom' }) => {
  const [fsmState, setFsmState] = useState<FindState>('IDLE');
  const [statusMessage, setStatusMessage] = useState(`Scanning for ${target}. Turn slowly.`);
  const [currentDirection, setCurrentDirection] = useState<Direction>('unknown');
  const [currentDistance, setCurrentDistance] = useState<DistanceBucket>('far');

  const fsmRef = useRef<FindStateMachine | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Initialize Find State Machine
  useEffect(() => {
    isMountedRef.current = true;

    const fsm = new FindStateMachine(target, {
      onStateChange: (newState) => {
        if (!isMountedRef.current) return;
        setFsmState(newState);
      },
      onSpeak: (text, priority) => {
        if (!isMountedRef.current) return;
        setStatusMessage(text);
        speech.speak(text, { priority: priority || 'normal' });
      },
      onBeaconStart: (direction, distance) => {
        if (!isMountedRef.current) return;
        setCurrentDirection(direction);
        setCurrentDistance(distance);

        // Start 3D HRTF audio beacon
        spatialAudio.startBeacon(() => ({
          direction,
          distance,
        }));

        // Accelerating proximity beeping based on distance
        let intervalMs = 900;
        if (distance === 'very-close') intervalMs = 120;
        else if (distance === 'close') intervalMs = 250;
        else if (distance === 'near') intervalMs = 500;

        earcons.startProximityBeep(intervalMs, 680);
      },
      onBeaconStop: () => {
        spatialAudio.stopBeacon();
        earcons.stopProximityBeep();
      },
      onEarcon: (type) => {
        if (type === 'found') earcons.found();
        if (type === 'success') earcons.success();
        if (type === 'error') earcons.error();
      },
      onHaptic: (type) => {
        if (type === 'found') haptics.pulseFound();
      },
    });

    fsmRef.current = fsm;
    fsm.start();

    // Periodic scanner loop (one in-flight request roughly every 2 seconds)
    scanIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current || !fsmRef.current) return;

      fsmRef.current.tick(Date.now());
      if (fsmRef.current.state === 'ARRIVED' || fsmRef.current.state === 'NOT_FOUND') {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        return;
      }

      // Check one in-flight rule
      if (fsmRef.current.isInFlight()) {
        return;
      }

      // Case 1: Local on-device COCO detector target (chair, bottle, phone, backpack, cup, etc.)
      if (fsmRef.current.isCocoTarget()) {
        const video = camera.getVideoElement();
        if (video && video.readyState >= 2) {
          fsmRef.current.setInFlight(true);
          try {
            const rawDetections = await detector.detect(video);
            const matching = rawDetections.filter(
              (d) => d.label.toLowerCase() === fsmRef.current?.target && d.score >= 0.5
            );

            if (matching.length > 0) {
              const best = matching[0];
              const spatial = processSpatialObject(
                best,
                video.videoWidth || 640,
                video.videoHeight || 480
              );
              fsmRef.current.handleResult({
                found: true,
                direction: spatial.direction,
                distance: spatial.distance,
                confidence: best.score,
                cue: `${fsmRef.current.target} detected ${spatial.direction.replace('-', ' ')}.`,
              });
            } else {
              fsmRef.current.handleResult({
                found: false,
                direction: 'unknown',
                distance: 'far',
                confidence: 0,
              });
            }
          } catch (detErr) {
            console.warn('Local detector find error:', detErr);
            fsmRef.current.setInFlight(false);
          }
        }
        return;
      }

      // Case 2: Vision VLM server target (washroom, signs, specialized destinations)
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) return;

      fsmRef.current.setInFlight(true);
      try {
        const res = await api.find(frame, fsmRef.current.target, speech.getLang());
        if (res.ok && res.data) {
          fsmRef.current.handleResult({
            found: res.data.found,
            direction: res.data.direction,
            distance: res.data.distance,
            confidence: res.confidence,
            cue: res.data.cue || res.summary,
            gender: res.data.gender,
          });
        } else {
          fsmRef.current.setInFlight(false);
        }
      } catch (err) {
        console.warn('Vision VLM find error:', err);
        fsmRef.current.setInFlight(false);
      }
    }, 2000);

    return () => {
      isMountedRef.current = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (fsmRef.current) {
        fsmRef.current.stop();
      }
      spatialAudio.stopBeacon();
      earcons.stopProximityBeep();
      api.abortTask('find');
    };
  }, [target]);

  const handleRestartScan = () => {
    if (fsmRef.current) {
      fsmRef.current.start();
    }
  };

  return (
    <ModeScreen
      title={`Find: ${target.toUpperCase()}`}
      description={
        fsmState === 'ARRIVED'
          ? 'Destination Reached'
          : fsmState === 'GUIDING'
          ? `Beacon active · ${currentDirection.replace('-', ' ')} · ${currentDistance.replace('-', ' ')}`
          : 'Scanning surroundings...'
      }
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-5 items-center">
        {/* Visual & ARIA Status Card */}
        <div
          className={`w-full p-6 rounded-3xl border-4 text-center transition-all shadow-lg ${
            fsmState === 'ARRIVED'
              ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
              : fsmState === 'GUIDING' || fsmState === 'FOUND'
              ? 'bg-yellow-950/80 border-yellow-400 text-yellow-200 animate-pulse'
              : fsmState === 'NOT_FOUND'
              ? 'bg-zinc-900 border-zinc-600 text-zinc-300'
              : 'bg-zinc-900 border-blue-500 text-blue-200'
          }`}
          aria-live="assertive"
        >
          <span className="text-6xl block mb-3">
            {fsmState === 'ARRIVED' ? '🎉' : fsmState === 'GUIDING' ? '📡' : fsmState === 'NOT_FOUND' ? '❓' : '🔍'}
          </span>
          <h2 className="text-2xl font-black mb-1">
            {fsmState === 'ARRIVED'
              ? 'ARRIVED'
              : fsmState === 'GUIDING'
              ? `GUIDING: ${currentDirection.toUpperCase()}`
              : fsmState === 'NOT_FOUND'
              ? 'NOT DETECTED'
              : 'SCANNING'}
          </h2>
          <p className="text-base font-medium opacity-90">{statusMessage}</p>
        </div>

        {/* Action Button */}
        {fsmState === 'NOT_FOUND' || fsmState === 'ARRIVED' ? (
          <BigButton
            label="Scan Again"
            variant="primary"
            onClick={handleRestartScan}
            className="w-full py-8 text-2xl"
            icon="🔄"
            ariaDescription="Restart scanning for target"
          />
        ) : (
          <div className="text-center text-sm text-zinc-400 p-2">
            Turn your phone slowly 360°. Accelerating beeps indicate you are getting closer.
          </div>
        )}
      </div>
    </ModeScreen>
  );
};
