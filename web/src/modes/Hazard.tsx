import React, { useEffect, useRef, useState } from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import type { HazardAlert, HazardData } from '../types';
import { api } from '../vision/api';

interface HazardProps {
  onStop: () => void;
}

export const Hazard: React.FC<HazardProps> = ({ onStop }) => {
  const [activeHazards, setActiveHazards] = useState<HazardAlert[]>([]);
  const [statusText, setStatusText] = useState('Monitoring walking path for drops, stairs, and obstacles...');
  const inFlightRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Spoken disclaimer on enabling per spec
    speech.speak('Hazard scan is a helper, not a guarantee. Keep using your cane.', {
      priority: 'normal',
    });

    const runHazardCheck = async () => {
      if (inFlightRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatusText('Offline. Hazard scan requires internet connection.');
        return;
      }

      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) return;

      inFlightRef.current = true;
      try {
        const res = await api.analyze<HazardData>({
          task: 'hazard',
          image: frame,
          lang: speech.getLang(),
        });

        if (res.ok && res.data?.hazards) {
          const highHazards = res.data.hazards.filter((h) => h.urgency === 'high');
          setActiveHazards(res.data.hazards);

          if (highHazards.length > 0) {
            const top = highHazards[0];
            const dir = top.direction === 'ahead' ? 'ahead' : `on your ${top.direction.replace('-', ' ')}`;
            const alertMsg = `Stop. Caution: ${top.type} ${dir}.`;

            setStatusText(alertMsg);
            earcons.hazard();
            haptics.pulseDanger();
            speech.speak(alertMsg, { priority: 'danger' });
          } else {
            setStatusText('Path currently clear of major hazards.');
          }
        }
      } catch (err) {
        console.warn('Hazard scan background check error:', err);
      } finally {
        inFlightRef.current = false;
      }
    };

    // Run every 6 seconds per task rate limit
    intervalRef.current = setInterval(runHazardCheck, 6000);
    // Initial run after 1s
    const initialTimer = setTimeout(runHazardCheck, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(initialTimer);
      inFlightRef.current = false;
      api.abortTask('hazard');
    };
  }, []);

  return (
    <ModeScreen
      title="Hazard Scan"
      description="Best-effort periodic scan for stairs, wet floors, and low overhead drops"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Warning banner */}
        <div
          className={`p-6 rounded-3xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-colors ${
            activeHazards.some((h) => h.urgency === 'high')
              ? 'bg-red-950 border-red-500 text-red-200 animate-pulse'
              : 'bg-zinc-900 border-amber-500 text-amber-200'
          }`}
          aria-live="assertive"
        >
          <span className="text-5xl block mb-2">⚠️</span>
          <h2 className="text-xl font-black mb-1">
            {activeHazards.some((h) => h.urgency === 'high') ? 'DANGER DETECTED' : 'HAZARD SCAN ACTIVE'}
          </h2>
          <p className="text-sm font-semibold opacity-90">{statusText}</p>
        </div>

        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-700 text-xs text-zinc-400 space-y-1">
          <p className="font-bold text-zinc-300">Safety Policy:</p>
          <p>Scans walking corridor every 6 seconds. Speaks only high-urgency physical fall or collision hazards.</p>
          <p className="text-amber-400">Remember: This does not replace a white cane or guide dog.</p>
        </div>
      </div>
    </ModeScreen>
  );
};
