import React, { useEffect, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import type { WasteData } from '../types';
import { api } from '../vision/api';

interface WasteProps {
  onStop: () => void;
}

export const Waste: React.FC<WasteProps> = ({ onStop }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasteData, setWasteData] = useState<WasteData | null>(null);
  const [statusText, setStatusText] = useState('Hold waste item in front of camera and tap "Classify Waste"');

  const handleClassify = async () => {
    if (isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const msg = 'I need internet for that.';
      setStatusText(msg);
      speech.speak(msg, { priority: 'normal' });
      return;
    }
    setIsProcessing(true);
    speech.speak('Checking waste item...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Please try again.', { priority: 'normal' });
        setIsProcessing(false);
        return;
      }

      const res = await api.analyze<WasteData>({
        task: 'waste',
        image: frame,
        lang: speech.getLang(),
      });

      if (res.ok && res.data) {
        setWasteData(res.data);
        const spoken = res.summary || `${res.data.item}. Put in ${res.data.binHint}.`;
        setStatusText(spoken);

        if (res.data.category !== 'unknown') {
          // Play success earcon per spec
          earcons.success();
          haptics.pulseFound();
        } else {
          earcons.error();
        }

        speech.speak(spoken, { priority: 'normal' });
      } else {
        const fallbackMsg = res.summary || "I'm not sure. Please check the bin label.";
        setStatusText(fallbackMsg);
        earcons.error();
        speech.speak(fallbackMsg, { priority: 'normal' });
      }
    } catch (err) {
      console.error('Waste classification error:', err);
      speech.speak('Could not classify waste right now.', { priority: 'normal' });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      api.abortTask('waste');
    };
  }, []);

  return (
    <ModeScreen
      title="Waste Sorter"
      description="Segregates waste into Wet, Dry, Recyclable, Hazardous, or E-waste"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Classification result card */}
        <div
          className={`p-6 rounded-3xl border-4 text-center min-h-[140px] flex flex-col items-center justify-center shadow-lg transition-colors ${
            wasteData?.category === 'wet'
              ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
              : wasteData?.category === 'recyclable' || wasteData?.category === 'dry'
              ? 'bg-blue-950 border-blue-500 text-blue-200'
              : wasteData?.category === 'hazardous' || wasteData?.category === 'e-waste'
              ? 'bg-red-950 border-red-500 text-red-200'
              : 'bg-zinc-900 border-zinc-500 text-zinc-200'
          }`}
          aria-live="polite"
        >
          {isProcessing ? (
            <span className="text-yellow-400 font-bold text-xl animate-pulse">Classifying item...</span>
          ) : wasteData ? (
            <>
              <span className="text-4xl block mb-2">
                {wasteData.category === 'wet'
                  ? '🥬'
                  : wasteData.category === 'recyclable'
                  ? '♻️'
                  : wasteData.category === 'hazardous'
                  ? '☣️'
                  : wasteData.category === 'e-waste'
                  ? '🔌'
                  : '🗑️'}
              </span>
              <h3 className="text-xl font-bold mb-1">{wasteData.item}</h3>
              <p className="text-sm font-semibold opacity-90">{statusText}</p>
            </>
          ) : (
            <span className="text-base text-zinc-300 font-medium">{statusText}</span>
          )}
        </div>

        {/* Action button */}
        <BigButton
          label={isProcessing ? 'Classifying...' : wasteData ? 'Classify Another' : 'Classify Waste'}
          variant="primary"
          onClick={handleClassify}
          disabled={isProcessing}
          className="w-full py-8 text-2xl"
          icon="♻️"
          ariaDescription="Captures a frame and identifies the correct waste bin"
        />

        <div className="text-center text-xs text-zinc-400 mt-2">
          Voice shortcuts: "Classify", "Again", or "Stop"
        </div>
      </div>
    </ModeScreen>
  );
};
