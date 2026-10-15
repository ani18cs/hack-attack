import React from 'react';
import { ModeScreen } from '../components/ModeScreen';

interface NavigateProps {
  onStop: () => void;
  destination?: string;
  stepInstruction?: string;
}

/**
 * Campus & Venue Navigation Mode.
 * TODO: Combine with venue pack & compass heading.
 */
export const Navigate: React.FC<NavigateProps> = ({
  onStop,
  destination = 'Main Entrance',
  stepInstruction = 'Walk straight ahead 10 steps toward the corridor.',
}) => {
  return (
    <ModeScreen
      title={`Navigate: ${destination}`}
      description={stepInstruction}
      onStop={onStop}
    >
      <div className="flex flex-col items-center justify-center p-6 border-4 border-yellow-400 bg-zinc-900 rounded-3xl w-full text-center">
        <span className="text-6xl mb-4">🧭</span>
        <p className="text-2xl font-black text-yellow-400 mb-2">{destination}</p>
        <p className="text-zinc-200 text-lg mb-4">{stepInstruction}</p>
        <div className="bg-zinc-800 px-4 py-2 rounded-full text-xs text-zinc-400 font-mono">
          Compass + Step tracker active
        </div>
      </div>
    </ModeScreen>
  );
};
