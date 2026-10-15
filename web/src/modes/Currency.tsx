import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface CurrencyProps {
  onStop: () => void;
  onScan?: () => void;
  isScanning?: boolean;
}

/**
 * Currency reader mode (Part 2).
 * TODO: Hook to /api/analyze with task: 'currency'.
 */
export const Currency: React.FC<CurrencyProps> = ({
  onStop,
  onScan,
  isScanning = false,
}) => {
  return (
    <ModeScreen
      title="Currency Reader"
      description="Hold banknote flat in front of camera."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4 items-center">
        <span className="text-6xl mb-2">💵</span>
        <BigButton
          label={isScanning ? 'Identifying Note...' : 'Scan Banknote'}
          variant="primary"
          onClick={onScan}
          disabled={isScanning}
          className="w-full py-8 text-2xl"
          ariaDescription="Captures a frame and identifies banknote denomination"
        />
        <p className="text-sm text-zinc-400 text-center">
          Identifies ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000 notes.
        </p>
      </div>
    </ModeScreen>
  );
};
