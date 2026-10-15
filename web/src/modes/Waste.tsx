import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface WasteProps {
  onStop: () => void;
  onClassify?: () => void;
  isClassifying?: boolean;
}

/**
 * Waste sorting mode (Part 2 - Sustainability track).
 * TODO: Hook to /api/analyze with task: 'waste'.
 */
export const Waste: React.FC<WasteProps> = ({
  onStop,
  onClassify,
  isClassifying = false,
}) => {
  return (
    <ModeScreen
      title="Waste Sorting"
      description="Hold item in front of camera to identify bin."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4 items-center">
        <span className="text-6xl mb-2">♻️</span>
        <BigButton
          label={isClassifying ? 'Analyzing Item...' : 'Identify Bin'}
          variant="primary"
          onClick={onClassify}
          disabled={isClassifying}
          className="w-full py-8 text-2xl"
          ariaDescription="Captures a frame and identifies wet, dry, recyclable, or e-waste category"
        />
        <p className="text-sm text-zinc-400 text-center">
          Helps sort into wet (green), dry (blue), or hazardous bins.
        </p>
      </div>
    </ModeScreen>
  );
};
