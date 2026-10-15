import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface ReadProps {
  onStop: () => void;
  onCaptureAndRead?: () => void;
  isProcessing?: boolean;
}

export const Read: React.FC<ReadProps> = ({ onStop, onCaptureAndRead, isProcessing = false }) => {
  return (
    <ModeScreen
      title="Read Text & Signs"
      description="Point camera at signs, doors, or text."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        <BigButton
          label={isProcessing ? 'Reading...' : 'Read Now'}
          variant="primary"
          onClick={onCaptureAndRead}
          disabled={isProcessing}
          className="w-full py-10 text-2xl"
          ariaDescription="Captures a frame and reads all visible text"
        />
        <div className="text-center text-sm text-zinc-400">
          Point directly at exit signs, labels, or directions
        </div>
      </div>
    </ModeScreen>
  );
};
