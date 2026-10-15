import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface HazardProps {
  onStop: () => void;
  onScanHazard?: () => void;
  isScanning?: boolean;
}

/**
 * Floor & drop-off hazard scanner (Part 2).
 * TODO: Hook to /api/analyze with task: 'hazard'.
 */
export const Hazard: React.FC<HazardProps> = ({
  onStop,
  onScanHazard,
  isScanning = false,
}) => {
  return (
    <ModeScreen
      title="Hazard Scan"
      description="Point camera down toward walking path or stairs."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4 items-center">
        <span className="text-6xl mb-2">⚠️</span>
        <BigButton
          label={isScanning ? 'Scanning Path...' : 'Scan For Hazards'}
          variant="danger"
          onClick={onScanHazard}
          disabled={isScanning}
          className="w-full py-8 text-2xl"
          ariaDescription="Scans floor for drop-offs, stairs, wet floors, and tripping hazards"
        />
        <p className="text-sm text-zinc-400 text-center">
          Best-effort check for stairs, drop-offs, and ground hazards.
        </p>
      </div>
    </ModeScreen>
  );
};
