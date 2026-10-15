import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface SosProps {
  onStop: () => void;
  onBroadcastSos?: () => void;
}

/**
 * Emergency SOS Mode.
 * TODO: Hook to /api/analyze with task: 'sos_context' and announce location.
 */
export const Sos: React.FC<SosProps> = ({ onStop, onBroadcastSos }) => {
  return (
    <ModeScreen
      title="Emergency SOS"
      description="Tap to announce emergency assistance & surroundings."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4 items-center">
        <span className="text-6xl mb-2 animate-bounce">🚨</span>
        <BigButton
          label="Broadcast SOS"
          variant="danger"
          onClick={onBroadcastSos}
          className="w-full py-10 text-3xl font-black shadow-[0_0_50px_rgba(255,0,0,0.8)]"
          ariaDescription="Sends emergency alert with location and visual description of surroundings"
        />
        <p className="text-sm text-red-300 text-center">
          Captures immediate scene context to describe your surroundings to responders.
        </p>
      </div>
    </ModeScreen>
  );
};
