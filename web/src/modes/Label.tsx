import React from 'react';
import { ModeScreen } from '../components/ModeScreen';
import { BigButton } from '../components/BigButton';

interface LabelProps {
  onStop: () => void;
  onReadLabel?: () => void;
  isReading?: boolean;
}

/**
 * Product label & expiry reader (Part 2).
 * TODO: Hook to /api/analyze with task: 'label'.
 */
export const Label: React.FC<LabelProps> = ({
  onStop,
  onReadLabel,
  isReading = false,
}) => {
  return (
    <ModeScreen
      title="Product Label"
      description="Point camera at product label or package."
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4 items-center">
        <span className="text-6xl mb-2">🏷️</span>
        <BigButton
          label={isReading ? 'Reading Label...' : 'Scan Product Label'}
          variant="primary"
          onClick={onReadLabel}
          disabled={isReading}
          className="w-full py-8 text-2xl"
          ariaDescription="Reads product name, expiry date, and allergens"
        />
        <p className="text-sm text-zinc-400 text-center">
          Checks brand, expiry date, and allergen warnings.
        </p>
      </div>
    </ModeScreen>
  );
};
