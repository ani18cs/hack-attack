import React from 'react';
import { SceneObject } from '../types';

interface DebugOverlayProps {
  visible: boolean;
  onClose: () => void;
  fps: number;
  detectorLatencyMs: number;
  serverLatencyMs: number;
  isOnline: boolean;
  detectedObjects: SceneObject[];
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  visible,
  onClose,
  fps,
  detectorLatencyMs,
  serverLatencyMs,
  isOnline,
  detectedObjects,
}) => {
  if (!visible) return null;

  return (
    <aside
      aria-label="Judge live diagnostics dashboard"
      className="fixed inset-x-2 top-16 z-50 p-4 bg-zinc-950/90 backdrop-blur border-2 border-emerald-500 rounded-2xl shadow-2xl text-xs font-mono text-emerald-400 select-none max-h-[70vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
        <span className="font-bold text-sm tracking-wide text-white">
          🛠️ JUDGE DIAGNOSTICS DASHBOARD
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800"
          aria-label="Close debug overlay"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-zinc-900 p-2 rounded">
          <span className="text-zinc-400 block text-[10px]">DETECTION RATE</span>
          <span className="text-base font-bold text-white">{fps.toFixed(1)} FPS</span>
        </div>
        <div className="bg-zinc-900 p-2 rounded">
          <span className="text-zinc-400 block text-[10px]">DETECTOR LATENCY</span>
          <span className="text-base font-bold text-white">{detectorLatencyMs.toFixed(0)} ms</span>
        </div>
        <div className="bg-zinc-900 p-2 rounded">
          <span className="text-zinc-400 block text-[10px]">SERVER VLM LATENCY</span>
          <span className="text-base font-bold text-white">
            {serverLatencyMs > 0 ? `${serverLatencyMs} ms` : 'Idle'}
          </span>
        </div>
        <div className="bg-zinc-900 p-2 rounded">
          <span className="text-zinc-400 block text-[10px]">CONNECTIVITY</span>
          <span
            className={`text-base font-bold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-2">
        <span className="text-zinc-400 block mb-1">
          ACTIVE OBJECT TRACKS ({detectedObjects.length}):
        </span>
        {detectedObjects.length === 0 ? (
          <span className="text-zinc-600 italic">No candidate objects in walking path.</span>
        ) : (
          <ul className="space-y-1">
            {detectedObjects.map((obj, i) => (
              <li
                key={i}
                className={`flex justify-between px-2 py-1 rounded ${
                  obj.danger ? 'bg-red-950/80 text-red-300' : 'bg-zinc-900'
                }`}
              >
                <span>
                  {obj.danger && '⚠️ '}
                  {obj.label} ({(obj.score * 100).toFixed(0)}%)
                </span>
                <span>
                  {obj.direction} · {obj.distance}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
