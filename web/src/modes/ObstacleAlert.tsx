import React from 'react';
import { ModeScreen } from '../components/ModeScreen';

interface ObstacleAlertProps {
  onStop: () => void;
  isHazardDetected?: boolean;
}

export const ObstacleAlert: React.FC<ObstacleAlertProps> = ({
  onStop,
  isHazardDetected = false,
}) => {
  return (
    <ModeScreen
      title="Obstacle Alert"
      description="Continuous safety guard. Warns of obstacles in walking path."
      onStop={onStop}
    >
      <div
        className={`w-full p-8 rounded-3xl border-4 text-center transition-colors ${
          isHazardDetected
            ? 'bg-red-950 border-red-500 text-red-200 animate-pulse'
            : 'bg-zinc-900 border-emerald-500 text-emerald-300'
        }`}
      >
        <span className="text-6xl block mb-4">{isHazardDetected ? '⚠️' : '🛡️'}</span>
        <h2 className="text-2xl font-black mb-2">
          {isHazardDetected ? 'HAZARD AHEAD' : 'PATH CLEAR'}
        </h2>
        <p className="text-sm opacity-80">
          {isHazardDetected
            ? 'Stop immediately. Obstacle detected in forward path.'
            : 'Monitoring walking corridor at ~8 frames per second.'}
        </p>
      </div>
    </ModeScreen>
  );
};
