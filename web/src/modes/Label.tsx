import React, { useEffect, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import type { LabelData } from '../types';
import { api } from '../vision/api';

interface LabelProps {
  onStop: () => void;
}

export const Label: React.FC<LabelProps> = ({ onStop }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [statusText, setStatusText] = useState('Hold package or medicine label close to camera and tap "Read Label"');

  const handleReadLabel = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    speech.speak('Reading label...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Please try again.', { priority: 'normal' });
        setIsProcessing(false);
        return;
      }

      const res = await api.analyze<LabelData>({
        task: 'label',
        image: frame,
        lang: speech.getLang(),
      });

      if (res.ok && res.data) {
        setLabelData(res.data);
        const spoken = res.summary || `${res.data.product}.`;
        setStatusText(spoken);

        if (res.data.legible) {
          earcons.success();
          haptics.pulseFound();
        } else {
          earcons.error();
        }

        speech.speak(spoken, { priority: 'normal' });
      } else {
        const fallbackMsg =
          res.summary || "I can't read that clearly. Please ask someone to check, especially the expiry date.";
        setStatusText(fallbackMsg);
        earcons.error();
        speech.speak(fallbackMsg, { priority: 'normal' });
      }
    } catch (err) {
      console.error('Label read error:', err);
      speech.speak('Could not read label right now.', { priority: 'normal' });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      api.abortTask('label');
    };
  }, []);

  return (
    <ModeScreen
      title="Label & Medicine Reader"
      description="Extracts product name, printed expiry date, and allergens with zero-guess safety"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Label output display */}
        <div
          className={`p-6 rounded-3xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-colors ${
            labelData && !labelData.legible
              ? 'bg-red-950/80 border-red-500 text-red-200'
              : labelData && labelData.legible
              ? 'bg-zinc-900 border-emerald-500 text-emerald-200'
              : 'bg-zinc-900 border-yellow-400 text-zinc-200'
          }`}
          aria-live="polite"
        >
          {isProcessing ? (
            <span className="text-yellow-400 font-bold text-xl animate-pulse">Scanning package label...</span>
          ) : labelData ? (
            <div className="space-y-2 text-left w-full">
              {labelData.allergens && labelData.allergens.length > 0 && (
                <div className="bg-amber-950/80 p-2 rounded border border-amber-500 text-amber-200 text-xs font-bold">
                  ⚠️ ALLERGENS: {labelData.allergens.join(', ')}
                </div>
              )}
              <h3 className="text-xl font-black text-white">{labelData.product}</h3>
              <p className="text-sm font-medium">
                {labelData.expiry ? `Expiry: ${labelData.expiry}` : 'Expiry: Not legible / not visible'}
              </p>
              {!labelData.legible && (
                <p className="text-xs text-red-300 italic">
                  Refused to guess: blurry or incomplete text. Please verify manually.
                </p>
              )}
            </div>
          ) : (
            <span className="text-base text-zinc-300 font-medium">{statusText}</span>
          )}
        </div>

        {/* Read action button */}
        <BigButton
          label={isProcessing ? 'Scanning...' : labelData ? 'Read Another Label' : 'Read Label'}
          variant="primary"
          onClick={handleReadLabel}
          disabled={isProcessing}
          className="w-full py-8 text-2xl"
          icon="🏷️"
          ariaDescription="Captures a frame and reads product and medicine information"
        />

        <div className="text-center text-xs text-zinc-400 mt-2">
          Safety: Always verify prescription medicine and dosage with a sighted person.
        </div>
      </div>
    </ModeScreen>
  );
};
