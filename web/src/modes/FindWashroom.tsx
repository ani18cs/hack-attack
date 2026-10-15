import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import { Direction, GenderKind } from '../types';
import { api } from '../vision/api';

export type WashroomState = 'idle' | 'scanning' | 'found' | 'guiding' | 'not_found';

interface FindWashroomProps {
  onStop: () => void;
  lang?: string;
  statusText?: string;
}

interface DetectedWashroomInfo {
  direction: Direction;
  gender: GenderKind;
  confidence: number;
  cue: string;
}

const TIMEOUT_SECONDS = 20;
const SCAN_INTERVAL_MS = 2000;

export const FindWashroom: React.FC<FindWashroomProps> = ({
  onStop,
  lang = 'en',
  statusText: initialStatusText = 'Scanning for washroom. Slowly turn around.',
}) => {
  const [washroomState, setWashroomState] = useState<WashroomState>('scanning');
  const [statusMessage, setStatusMessage] = useState<string>(initialStatusText);
  const [detectedInfo, setDetectedInfo] = useState<DetectedWashroomInfo | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const stateRef = useRef<WashroomState>('scanning');
  const lastSpokenDirectionRef = useRef<Direction | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize stateRef with state
  useEffect(() => {
    stateRef.current = washroomState;
  }, [washroomState]);

  const clearTimers = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (initialScanTimerRef.current) {
      clearTimeout(initialScanTimerRef.current);
      initialScanTimerRef.current = null;
    }
  }, []);

  const formatGender = (gender: GenderKind): string => {
    switch (gender) {
      case 'men':
        return "men's";
      case 'women':
        return "women's";
      case 'unisex':
        return 'all-gender';
      default:
        return '';
    }
  };

  const performScan = useCallback(async () => {
    // Only scan if in scanning or guiding states and no other call in flight
    if (
      inFlightRef.current ||
      !isMountedRef.current ||
      (stateRef.current !== 'scanning' && stateRef.current !== 'guiding')
    ) {
      return;
    }

    inFlightRef.current = true;

    try {
      // Capture frame from camera
      const frameBase64 = camera.captureFrame(1024, 0.75);
      if (!frameBase64) {
        // Camera frame not yet ready, will retry on next tick
        return;
      }

      const response = await api.findTarget(frameBase64, 'restroom', lang);
      if (!isMountedRef.current) return;

      // Handle server error response gracefully
      if (response.error) {
        console.warn('Find washroom server error:', response.error);
        return;
      }

      // Check if washroom was detected with confidence >= 0.6
      if (response.found && response.confidence >= 0.6) {
        const info: DetectedWashroomInfo = {
          direction: response.direction,
          gender: response.gender,
          confidence: response.confidence,
          cue: response.cue || 'Restroom indicator visible',
        };
        setDetectedInfo(info);

        const genderPhrase = formatGender(response.gender);
        const dirPhrase = response.direction !== 'unknown' ? `on your ${response.direction}` : 'ahead';

        if (stateRef.current === 'scanning') {
          // Transition: SCANNING -> FOUND -> GUIDING
          clearTimers();
          setWashroomState('found');
          haptics.pulseConfirm();

          const announcement = genderPhrase
            ? `Restroom sign, ${genderPhrase}, ${dirPhrase}.`
            : `Restroom sign, ${dirPhrase}.`;

          setStatusMessage(announcement);
          speech.stop();
          speech.speak(announcement, { priority: 'normal' });
          lastSpokenDirectionRef.current = response.direction;

          // Transition to GUIDING after announcement
          transitionTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setWashroomState('guiding');
              // Start continuous guidance scanning loop
              scanTimerRef.current = setInterval(performScan, SCAN_INTERVAL_MS);
            }
          }, 1500);
        } else if (stateRef.current === 'guiding') {
          // Provide updated directional guidance if direction changed
          if (response.direction !== lastSpokenDirectionRef.current && response.direction !== 'unknown') {
            lastSpokenDirectionRef.current = response.direction;
            haptics.pulseInfo();
            const updateMsg = `Restroom now ${dirPhrase}.`;
            setStatusMessage(updateMsg);
            speech.speak(updateMsg, { priority: 'normal' });
          } else if (response.direction !== 'unknown') {
            const reaffirmMsg = `Still ${dirPhrase}.`;
            setStatusMessage(reaffirmMsg);
            speech.speak(reaffirmMsg, { priority: 'low' });
          }
        }
      }
    } catch (err: any) {
      console.error('Find washroom scan error:', err);
    } finally {
      inFlightRef.current = false;
    }
  }, [clearTimers, lang]);

  const startScanning = useCallback(() => {
    clearTimers();
    setWashroomState('scanning');
    setDetectedInfo(null);
    setSecondsElapsed(0);
    lastSpokenDirectionRef.current = null;

    const initialAnnouncement = 'Scanning for washroom. Slowly turn around.';
    setStatusMessage(initialAnnouncement);
    speech.stop();
    speech.speak(initialAnnouncement, { priority: 'normal' });
    haptics.pulseInfo();

    // Elapsed seconds counter for progress display
    elapsedTimerRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setSecondsElapsed((prev) => prev + 1);
      }
    }, 1000);

    // Initial scan after 400ms to allow speech to initiate
    initialScanTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && stateRef.current === 'scanning') {
        performScan();
      }
    }, 400);

    // Repeat scans every 2 seconds
    scanTimerRef.current = setInterval(performScan, SCAN_INTERVAL_MS);

    // 20-second timeout if no restroom found
    timeoutTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && stateRef.current === 'scanning') {
        clearTimers();
        setWashroomState('not_found');
        const notFoundMsg = 'Not found yet. Try turning more, or move forward and say find washroom again.';
        setStatusMessage(notFoundMsg);
        speech.stop();
        speech.speak(notFoundMsg, { priority: 'normal' });
      }
    }, TIMEOUT_SECONDS * 1000);
  }, [clearTimers, performScan]);

  // Start on mount
  useEffect(() => {
    isMountedRef.current = true;
    startScanning();

    return () => {
      isMountedRef.current = false;
      clearTimers();
      speech.stop();
    };
  }, [clearTimers, startScanning]);

  const getDirectionArrow = (dir?: Direction) => {
    switch (dir) {
      case 'left':
      case 'slightly-left':
        return '⬅️';
      case 'right':
      case 'slightly-right':
        return '➡️';
      case 'ahead':
        return '⬆️';
      default:
        return '🧭';
    }
  };

  return (
    <ModeScreen
      title="Find Washroom"
      description={statusMessage}
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4 max-h-[60vh] overflow-y-auto px-1 items-center">
        {/* State: SCANNING */}
        {washroomState === 'scanning' && (
          <div className="flex flex-col items-center justify-center p-6 border-4 border-yellow-400 bg-zinc-900 rounded-3xl w-full text-center animate-pulse">
            <span className="text-6xl mb-4">🔄</span>
            <p className="text-2xl font-black text-yellow-400 mb-2">Scanning 360°</p>
            <p className="text-zinc-300 text-base mb-4">
              Rotate slowly. SightLine is scanning every 2 seconds for restroom signs, WC, toilets, and pictograms.
            </p>
            <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden border border-zinc-700">
              <div
                className="bg-yellow-400 h-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (secondsElapsed / TIMEOUT_SECONDS) * 100)}%` }}
                role="progressbar"
                aria-valuenow={secondsElapsed}
                aria-valuemin={0}
                aria-valuemax={TIMEOUT_SECONDS}
                aria-label="Scan timeout progress"
              />
            </div>
            <span className="text-xs text-zinc-400 mt-2">
              Time remaining: {Math.max(0, TIMEOUT_SECONDS - secondsElapsed)}s
            </span>
          </div>
        )}

        {/* State: FOUND / GUIDING */}
        {(washroomState === 'found' || washroomState === 'guiding') && detectedInfo && (
          <div className="flex flex-col items-center justify-center p-6 border-4 border-green-500 bg-zinc-900 rounded-3xl w-full text-center shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            <div className="text-7xl mb-3 flex items-center justify-center gap-3">
              <span>🚻</span>
              <span className="animate-bounce">{getDirectionArrow(detectedInfo.direction)}</span>
            </div>

            <p className="text-2xl font-black text-green-400 uppercase tracking-wide mb-1">
              {washroomState === 'found' ? 'Restroom Spotted!' : 'Guiding to Washroom'}
            </p>

            <div className="text-3xl font-extrabold text-white capitalize mb-3">
              Direction: <span className="text-yellow-400">{detectedInfo.direction}</span>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="bg-green-700 text-white text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                {detectedInfo.gender !== 'unknown' ? `${detectedInfo.gender}` : 'General'}
              </span>
              <span className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs px-3 py-1 rounded-full font-bold">
                Confidence: {Math.round(detectedInfo.confidence * 100)}%
              </span>
            </div>

            {detectedInfo.cue && (
              <p className="text-xs text-zinc-300 bg-zinc-800 p-2.5 rounded-xl border border-zinc-700 italic max-w-sm">
                "{detectedInfo.cue}"
              </p>
            )}

            <div className="mt-4 text-xs text-zinc-400">
              Guidance active. Rotate towards the indicated direction.
            </div>
          </div>
        )}

        {/* State: NOT_FOUND */}
        {washroomState === 'not_found' && (
          <div className="flex flex-col items-center justify-center p-6 border-4 border-red-500 bg-zinc-900 rounded-3xl w-full text-center">
            <span className="text-6xl mb-3">⚠️</span>
            <p className="text-2xl font-black text-red-400 mb-2">Restroom Not Found</p>
            <p className="text-zinc-300 text-sm mb-6">
              No restroom signs detected in 20 seconds. Try turning towards another corridor or walk forward and scan again.
            </p>

            <BigButton
              label="Scan Again"
              variant="warning"
              onClick={startScanning}
              className="w-full py-8 text-xl"
              ariaDescription="Restarts 20-second washroom scan"
            />
          </div>
        )}

        {/* Retry / Re-scan button when guiding */}
        {washroomState === 'guiding' && (
          <button
            type="button"
            onClick={startScanning}
            className="text-xs text-yellow-400 underline font-bold px-3 py-2 hover:text-yellow-300 focus:ring-2 focus:ring-white rounded mt-1"
            aria-label="Restart scanning for a new washroom sign"
          >
            Restart 360° Scan
          </button>
        )}
      </div>
    </ModeScreen>
  );
};
