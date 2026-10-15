import React from 'react';
import { ModeScreen } from '../components/ModeScreen';

interface FindProps {
  onStop: () => void;
  target?: string;
  statusText?: string;
}

/**
 * Find mode: searches for targets (washroom, bottle, chair, phone)
 * using local COCO-SSD detection and on-demand Gemini analysis.
 */
export const Find: React.FC<FindProps> = ({
  onStop,
  target = 'washroom',
  statusText = 'Scanning for target. Slowly turn around.',
}) => {
  return (
    <ModeScreen
      title={`Find: ${target.toUpperCase()}`}
      description={statusText}
      onStop={onStop}
    >
      <div className="flex flex-col items-center justify-center p-6 border-4 border-yellow-400 bg-zinc-900 rounded-3xl w-full text-center">
        <span className="text-6xl mb-4">🔍</span>
        <p className="text-xl font-bold text-yellow-400 mb-2">Looking for {target}</p>
        <p className="text-zinc-300 text-sm">
          Rotate slowly 360 degrees. SightLine will chime and announce when {target} is spotted.
        </p>
      </div>
    </ModeScreen>
  );
};
