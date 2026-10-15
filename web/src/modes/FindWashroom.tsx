import React from 'react';
import { ModeScreen } from '../components/ModeScreen';

interface FindWashroomProps {
  onStop: () => void;
  statusText?: string;
}

export const FindWashroom: React.FC<FindWashroomProps> = ({
  onStop,
  statusText = 'Scanning for washroom signs. Slowly turn around.',
}) => {
  return (
    <ModeScreen
      title="Find Washroom"
      description={statusText}
      onStop={onStop}
    >
      <div className="flex flex-col items-center justify-center p-6 border-4 border-yellow-400 bg-zinc-900 rounded-3xl w-full text-center">
        <span className="text-6xl mb-4">🚻</span>
        <p className="text-xl font-bold text-yellow-400 mb-2">Washroom Guidance Active</p>
        <p className="text-zinc-300 text-sm">
          Rotate slowly 360 degrees. SightLine will announce when restroom icons or text are spotted.
        </p>
      </div>
    </ModeScreen>
  );
};
