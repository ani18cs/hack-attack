import React from 'react';

interface StatusBannerProps {
  status: string;
  isListening?: boolean;
  isSpeaking?: boolean;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  status,
  isListening = false,
  isSpeaking = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-zinc-900 border-b-2 border-zinc-700 px-4 py-3 flex items-center justify-between text-base md:text-lg font-semibold"
    >
      <div className="flex items-center gap-2 truncate">
        <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
        <span className="text-zinc-100 truncate">{status}</span>
      </div>
      <div className="flex items-center gap-2 text-xs md:text-sm font-mono shrink-0">
        {isListening && (
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-500 px-2 py-0.5 rounded-full">
            MIC ON
          </span>
        )}
        {isSpeaking && (
          <span className="bg-yellow-950 text-yellow-400 border border-yellow-500 px-2 py-0.5 rounded-full">
            SPEAKING
          </span>
        )}
      </div>
    </div>
  );
};
