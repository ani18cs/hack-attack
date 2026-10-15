import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface AroundMeProps {
  onStop: () => void;
  onDescribeOnce?: () => void;
}

export const AroundMe: React.FC<AroundMeProps> = ({ onStop, onDescribeOnce }) => {
  return (
    <ModeScreen
      title="Around Me"
      description="Announcing objects and surroundings in real time."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        <BigButton
          label="Detailed Scene Description"
          variant="primary"
          onClick={onDescribeOnce}
          className="w-full py-8 text-xl"
          ariaDescription="Captures a frame and provides a detailed scene summary via Gemini"
        />
        <div className="text-center text-sm text-zinc-400">
          Listening for "Stop" or "Describe"
        </div>
      </div>
    </ModeScreen>
  );
};
