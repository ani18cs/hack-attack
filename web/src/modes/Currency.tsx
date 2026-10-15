import React, { useEffect, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import type { CurrencyData } from '../types';
import { api } from '../vision/api';

interface CurrencyProps {
  onStop: () => void;
}

export const Currency: React.FC<CurrencyProps> = ({ onStop }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedNote, setDetectedNote] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Hold Indian banknote flat in front of camera and tap "Scan Note"');

  const handleScan = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    speech.speak('Checking currency...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Please try again.', { priority: 'normal' });
        setIsProcessing(false);
        return;
      }

      const res = await api.analyze<CurrencyData>({
        task: 'currency',
        image: frame,
        lang: speech.getLang(),
      });

      if (res.ok && res.data) {
        setDetectedNote(res.data.denomination);
        const summary = res.summary || `${res.data.denomination} rupee note.`;
        setStatusText(summary);

        if (res.data.denomination !== null) {
          earcons.success();
          haptics.pulseFound();
        } else {
          earcons.error();
        }

        speech.speak(summary, { priority: 'normal' });
      } else {
        const fallbackMsg = res.summary || "I can't tell, hold the note flat and closer.";
        setStatusText(fallbackMsg);
        earcons.error();
        speech.speak(fallbackMsg, { priority: 'normal' });
      }
    } catch (err) {
      console.error('Currency scan error:', err);
      speech.speak('Could not identify currency note right now.', { priority: 'normal' });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      api.abortTask('currency');
    };
  }, []);

  return (
    <ModeScreen
      title="Currency Reader"
      description="Identifies Indian Rupee notes: 10, 20, 50, 100, 200, 500, 2000"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Status card with huge denomination display */}
        <div
          className="p-6 rounded-3xl bg-zinc-900 border-4 border-yellow-400 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg"
          aria-live="polite"
        >
          {isProcessing ? (
            <span className="text-yellow-400 font-bold text-xl animate-pulse">Inspecting banknote...</span>
          ) : detectedNote !== null ? (
            <>
              <span className="text-5xl font-black text-yellow-300">₹{detectedNote}</span>
              <span className="text-lg text-zinc-200 mt-2 font-medium">{statusText}</span>
            </>
          ) : (
            <span className="text-base text-zinc-300 font-medium">{statusText}</span>
          )}
        </div>

        {/* Scan / Scan Again button */}
        <BigButton
          label={isProcessing ? 'Inspecting...' : detectedNote !== null ? 'Scan Again' : 'Scan Note'}
          variant="primary"
          onClick={handleScan}
          disabled={isProcessing}
          className="w-full py-8 text-2xl"
          icon="💵"
          ariaDescription="Captures a frame and identifies the Indian Rupee banknote"
        />

        <div className="text-center text-xs text-zinc-400 mt-2">
          Voice shortcuts: "Scan", "Again", or "Stop"
        </div>
      </div>
    </ModeScreen>
  );
};
