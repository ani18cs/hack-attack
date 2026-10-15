import React, { useEffect, useState } from 'react';
import { askLog, type AskLogItem } from '../ask/askLog';
import type { RouterTool } from '../ask/types';
import { settings, type AppSettings } from '../core/settings';
import { speech } from '../core/speech';
import type { SceneObject } from '../types';
import { GUIDANCE } from '../config/guidance';
import { hapticChannel, type HapticChannelStatus } from '../core/hapticChannel';
import type { GuidanceState, BlockerInfo } from '../guidance/engine';
import { formatDistance } from '../vision/units';

interface ControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fps: number;
  detectorLatencyMs: number;
  serverLatencyMs: number;
  isOnline: boolean;
  detectedObjects: SceneObject[];
  guidanceState?: GuidanceState;
  nearestBlocker?: BlockerInfo | null;
  onSelectTool: (tool: RouterTool, args?: Record<string, any>) => void;
  onTriggerSos: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isOpen,
  onClose,
  fps,
  detectorLatencyMs,
  serverLatencyMs,
  isOnline,
  detectedObjects,
  guidanceState,
  nearestBlocker,
  onSelectTool,
  onTriggerSos,
}) => {
  const [logs, setLogs] = useState<AskLogItem[]>([]);
  const [userSettings, setUserSettings] = useState<AppSettings>(settings.getSettings());
  const [sosNumberInput, setSosNumberInput] = useState(userSettings.trustedContact || '+919876543210');
  const [hapticStatus, setHapticStatus] = useState<HapticChannelStatus>(hapticChannel.getStatus());

  useEffect(() => {
    const unsubLogs = askLog.subscribe((updated) => setLogs(updated));
    const unsubHaptic = hapticChannel.subscribe((st) => setHapticStatus(st));
    return () => {
      unsubLogs();
      unsubHaptic();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      speech.speak('Control panel', { priority: 'normal' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLangChange = (lang: 'en-IN' | 'hi-IN' | 'kn-IN') => {
    speech.setLang(lang);
    const short = lang.startsWith('hi') ? 'hi' : lang.startsWith('kn') ? 'kn' : 'en';
    onSelectTool('set_language', { lang: short });
  };

  const handleVerbosityChange = (level: 'quiet' | 'normal' | 'detailed') => {
    settings.updateSettings({ verbosity: level });
    setUserSettings(settings.getSettings());
    onSelectTool('set_verbosity', { level });
  };

  const handleSaveContact = () => {
    settings.updateSettings({ trustedContact: sosNumberInput });
    setUserSettings(settings.getSettings());
    speech.speak('Emergency contact saved.', { priority: 'normal' });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Control Panel and Manual Fallback"
      className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col p-4 overflow-y-auto animate-fadeIn select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <h1 className="text-2xl font-black flex items-center gap-2">
          <span>⚙️</span> CONTROL PANEL
        </h1>
        <button
          onClick={onClose}
          type="button"
          className="bg-yellow-400 text-black font-bold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform"
          aria-label="Close Control Panel"
        >
          CLOSE ✕
        </button>
      </div>

      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full pb-8">
        {/* Section 1: Manual Mode Buttons (Eyes-free / Touch fallback) */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400 mb-2">
            Manual Mode Actions (Speech Fallback)
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('describe_scene');
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              🧭 Around Me
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('read_text');
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              📖 Read Signs
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('find_target', { target: 'washroom' });
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              🚻 Find Washroom
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('identify_currency');
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              💵 Currency Reader
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('sort_waste');
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              ♻️ Waste Sorter
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('read_label');
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              🏷️ Product Label
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('scan_hazards', { enabled: true });
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              ⚠️ Hazard Scan
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTool('navigate_to', { destination: 'washroom' });
              }}
              className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl font-bold text-left hover:border-yellow-400 active:scale-98"
            >
              🗺️ Navigate Venue
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onTriggerSos();
            }}
            className="w-full mt-2.5 p-4 bg-red-600 text-white border-2 border-red-400 rounded-2xl font-black text-center text-lg active:scale-98"
          >
            🆘 EMERGENCY SOS CONFIRMATION
          </button>
        </div>

        {/* Section 2: Settings */}
        <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">Settings</h2>

          {/* Language */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Language</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleLangChange('en-IN')}
                className={`py-2 px-3 rounded-xl font-bold text-xs ${
                  speech.getLang().startsWith('en')
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLangChange('hi-IN')}
                className={`py-2 px-3 rounded-xl font-bold text-xs ${
                  speech.getLang().startsWith('hi')
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => handleLangChange('kn-IN')}
                className={`py-2 px-3 rounded-xl font-bold text-xs ${
                  speech.getLang().startsWith('kn')
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                ಕನ್ನಡ
              </button>
            </div>
          </div>

          {/* Verbosity */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Verbosity Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(['quiet', 'normal', 'detailed'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleVerbosityChange(level)}
                  className={`py-2 px-3 rounded-xl font-bold text-xs capitalize ${
                    userSettings.verbosity === level
                      ? 'bg-yellow-400 text-black'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Trusted SOS Contact */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
              Trusted SOS Number
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={sosNumberInput}
                onChange={(e) => setSosNumberInput(e.target.value)}
                className="flex-1 bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                placeholder="+919876543210"
              />
              <button
                type="button"
                onClick={handleSaveContact}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl text-xs font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Navigation Guidance & Haptic Dashboard */}
        <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
              Guidance & Haptics
            </h2>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-black tracking-wider uppercase ${
                (guidanceState || hapticStatus.state) === 'STOP'
                  ? 'bg-red-600 text-white animate-pulse'
                  : (guidanceState || hapticStatus.state) === 'CAUTION'
                  ? 'bg-amber-500 text-black'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {guidanceState || hapticStatus.state}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/60 p-2.5 rounded-xl border border-zinc-800">
              <div className="text-zinc-400 text-[11px]">Nearest Blocker</div>
              <div className="font-bold text-white truncate mt-0.5">
                {nearestBlocker ? nearestBlocker.label : 'None (Path Clear)'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {nearestBlocker
                  ? `${nearestBlocker.distanceM.toFixed(1)}m (${formatDistance(nearestBlocker.distanceM)}) · ${nearestBlocker.direction}`
                  : 'Clear forward corridor'}
              </div>
            </div>

            <div className="bg-black/60 p-2.5 rounded-xl border border-zinc-800">
              <div className="text-zinc-400 text-[11px]">Channel Mode</div>
              <div className="font-bold text-white truncate mt-0.5">
                {hapticStatus.hasVibration ? 'Vibration' : 'Audio Fallback'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {hapticStatus.hasVibration
                  ? `Heartbeat: ${GUIDANCE.haptics.clearIntervalMs}ms`
                  : 'iOS audio tones active'}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs bg-black/40 px-3 py-2 rounded-xl border border-zinc-800">
            <span className="text-zinc-400">Safety Watchdog:</span>
            <span
              className={`font-mono font-bold ${
                hapticStatus.isWatchdogPaused ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {hapticStatus.isWatchdogPaused ? '⚠️ Vision Paused' : 'Healthy (Active)'}
            </span>
          </div>
        </div>

        {/* Section 4: Judge Diagnostics */}
        <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
            Performance Metrics
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-black/60 p-2 rounded-xl border border-zinc-800">
              <div className="text-zinc-400">FPS</div>
              <div className="font-mono font-bold text-emerald-400 text-sm">{fps.toFixed(1)}</div>
            </div>
            <div className="bg-black/60 p-2 rounded-xl border border-zinc-800">
              <div className="text-zinc-400">Detector</div>
              <div className="font-mono font-bold text-blue-400 text-sm">{detectorLatencyMs}ms</div>
            </div>
            <div className="bg-black/60 p-2 rounded-xl border border-zinc-800">
              <div className="text-zinc-400">Server</div>
              <div className="font-mono font-bold text-purple-400 text-sm">{serverLatencyMs}ms</div>
            </div>
            <div className="bg-black/60 p-2 rounded-xl border border-zinc-800">
              <div className="text-zinc-400">Network</div>
              <div
                className={`font-mono font-bold text-sm ${
                  isOnline ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
          <div className="text-xs text-zinc-400 pt-1">
            Tracking {detectedObjects.length} object(s):{' '}
            {detectedObjects.map((o) => `${o.label} (${Math.round(o.score * 100)}%)`).join(', ') ||
              'None'}
          </div>
        </div>

        {/* Section 4: In-Memory Ask Log (Last 5 queries) */}
        <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
            Ask Log (In-Memory Last 5)
          </h2>
          {logs.length === 0 ? (
            <div className="text-xs text-zinc-500 italic py-2">No queries recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-black/60 p-2.5 rounded-xl border border-zinc-800 text-xs space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">"{item.transcript}"</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.source === 'local'
                          ? 'bg-blue-900/60 text-blue-300'
                          : 'bg-purple-900/60 text-purple-300'
                      }`}
                    >
                      {item.source}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Tool: <strong className="text-zinc-200">{item.tool}</strong></span>
                    <span>
                      Conf: {Math.round(item.confidence * 100)}% · Latency: {item.latencyMs || 0}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
