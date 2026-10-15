import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { networkMonitor } from '../core/network';
import { confidencePhrase, speech } from '../core/speech';
import type { ReadTextItem } from '../types';
import { api } from '../vision/api';
import { recognizeTextFallback } from '../vision/ocr';

interface ReadProps {
  onStop: () => void;
  lang?: string;
  onCaptureAndRead?: () => void;
  isProcessing?: boolean;
}

export const Read: React.FC<ReadProps> = ({
  onStop,
  lang = 'en-IN',
  onCaptureAndRead,
  isProcessing: externalProcessing,
}) => {
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Point camera at signs, doors, or text.');
  const [summary, setSummary] = useState<string | null>(null);
  const [detectedTexts, setDetectedTexts] = useState<ReadTextItem[]>([]);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  const isProcessing = externalProcessing ?? internalProcessing;
  const inFlightRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const isMountedRef = useRef(true);

  const executeRead = useCallback(async () => {
    if (inFlightRef.current || !isMountedRef.current) return;
    inFlightRef.current = true;
    setInternalProcessing(true);
    setIsOfflineFallback(false);
    setStatusMessage('Capturing frame...');

    try {
      speech.speak('Looking...', { priority: 'normal' });
      haptics.pulseInfo();

      let frameBase64 = camera.captureFrame(720, 0.65);
      if (!frameBase64) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!isMountedRef.current) return;
        frameBase64 = camera.captureFrame(720, 0.65);
      }

      if (!frameBase64) {
        const errorMsg = 'Camera not ready. Tap Read Now once camera is active.';
        if (isMountedRef.current) {
          setStatusMessage(errorMsg);
          speech.speak(errorMsg, { priority: 'normal' });
        }
        return;
      }

      if (!isMountedRef.current) return;
      setStatusMessage('Reading signs with AI...');

      // 1. Check network
      const isOnline = networkMonitor.isOnline();
      if (!isOnline) {
        setStatusMessage('Offline. Using on-device text reader...');
        await runOfflineFallback(frameBase64);
        return;
      }

      // 2. Online unified analyze
      const response = await api.read(frameBase64, lang || speech.getLang());
      if (!isMountedRef.current) return;

      if (!response.ok || !response.summary) {
        console.warn('Online read error, falling back to local OCR:', response.error);
        setStatusMessage('Server unreachable. Trying on-device text reader...');
        await runOfflineFallback(frameBase64);
        return;
      }

      // Success online
      haptics.pulseConfirm();
      earcons.found();
      const phrased = confidencePhrase(response.confidence, response.summary);
      setSummary(phrased);
      const items = response.data?.texts || [];
      setDetectedTexts(items);

      if (items.length > 0) {
        setStatusMessage(`Found ${items.length} text ${items.length === 1 ? 'item' : 'items'}`);
      } else {
        setStatusMessage('No text or signs detected.');
      }

      speech.speak(phrased, { priority: 'normal' });
    } catch (err: any) {
      console.error('Read mode exception:', err);
      if (!isMountedRef.current) return;
      const errMsg = 'Error reading text. Tap Read Now to retry.';
      setStatusMessage(errMsg);
      speech.speak(errMsg, { priority: 'normal' });
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setInternalProcessing(false);
      }
    }
  }, [lang]);

  const runOfflineFallback = async (frameBase64: string) => {
    try {
      const fallbackData = await recognizeTextFallback(frameBase64);
      if (!isMountedRef.current) return;

      setIsOfflineFallback(true);
      if (fallbackData.texts.length > 0) {
        haptics.pulseConfirm();
        earcons.success();
        const first = fallbackData.texts[0].text;
        const fallbackSummary = `Offline text reads: ${first}`;
        setSummary(fallbackSummary);
        setDetectedTexts(fallbackData.texts);
        setStatusMessage(`Read complete (${fallbackData.texts.length} items found offline)`);
        speech.speak(fallbackSummary, { priority: 'normal' });
      } else {
        const noTextMsg = 'No text detected by offline reader.';
        setSummary(null);
        setStatusMessage(noTextMsg);
        speech.speak(noTextMsg, { priority: 'normal' });
      }
    } catch (ocrErr: any) {
      console.error('Offline OCR failed:', ocrErr);
      if (!isMountedRef.current) return;
      const failMsg = 'Unable to read text. Please move closer and try again.';
      setSummary(null);
      setStatusMessage(failMsg);
      speech.speak(failMsg, { priority: 'normal' });
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (!hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      timer = setTimeout(() => {
        if (isMountedRef.current) {
          executeRead();
        }
      }, 400);
    }

    return () => {
      isMountedRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [executeRead]);

  const handleManualTrigger = () => {
    if (onCaptureAndRead) {
      onCaptureAndRead();
    } else {
      executeRead();
    }
  };

  const speakItem = (item: ReadTextItem) => {
    speech.stop();
    const directionPhrase = item.direction && item.direction !== 'ahead' ? `, on your ${item.direction}` : '';
    const arrowPhrase = item.arrow ? `, arrow points ${item.arrow}` : '';
    const kindPhrase = item.kind && item.kind !== 'other' ? ` (${item.kind})` : '';
    speech.speak(`${item.text}${kindPhrase}${arrowPhrase}${directionPhrase}`, { priority: 'normal' });
  };

  const speakAllDetails = () => {
    if (detectedTexts.length === 0) return;
    speech.stop();
    const fullText = detectedTexts
      .map((item) => {
        const dir = item.direction && item.direction !== 'ahead' ? `on the ${item.direction}` : '';
        const arrow = item.arrow ? `arrow points ${item.arrow}` : '';
        return `${item.text} ${arrow} ${dir}`.trim();
      })
      .join('. ');
    speech.speak(fullText, { priority: 'normal' });
  };

  const getKindBadgeClass = (kind: string) => {
    switch (kind) {
      case 'exit':
        return 'bg-emerald-600 text-white';
      case 'warning':
        return 'bg-red-600 text-white';
      case 'direction':
        return 'bg-blue-600 text-white';
      case 'room':
        return 'bg-purple-600 text-white';
      case 'store':
        return 'bg-amber-500 text-black';
      default:
        return 'bg-zinc-700 text-zinc-200';
    }
  };

  return (
    <ModeScreen
      title="Read Text & Signs"
      description={statusMessage}
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-3 max-h-[62vh] overflow-y-auto px-1">
        {/* Primary Action Button */}
        <BigButton
          label={isProcessing ? 'Reading...' : 'Read Now'}
          variant="primary"
          onClick={handleManualTrigger}
          disabled={isProcessing}
          className="w-full py-7 text-2xl"
          icon="📖"
          ariaDescription="Captures a frame and reads all visible text and signs"
        />

        {/* Processing Indicator */}
        {isProcessing && (
          <div
            className="flex items-center justify-center p-3.5 bg-zinc-900 border-2 border-yellow-400 rounded-2xl animate-pulse text-yellow-300 font-bold text-sm"
            role="status"
            aria-live="polite"
          >
            <span className="mr-2 text-lg">🔍</span>
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Offline Fallback Badge */}
        {isOfflineFallback && !isProcessing && (
          <div
            className="p-2.5 bg-amber-950/80 border border-amber-500 text-amber-200 rounded-xl text-center text-xs font-semibold"
            role="note"
          >
            ⚠️ Offline reader used (lower accuracy)
          </div>
        )}

        {/* Summary Card */}
        {summary && !isProcessing && (
          <div
            className="p-3.5 bg-zinc-900 border-2 border-zinc-700 rounded-2xl flex flex-col gap-1.5"
            role="region"
            aria-label="Summary of detected text"
          >
            <span className="text-[11px] uppercase tracking-wider text-yellow-400 font-bold">
              Summary
            </span>
            <p className="text-base font-semibold text-white leading-snug">
              {summary}
            </p>
          </div>
        )}

        {/* List of Detected Text Items */}
        {detectedTexts.length > 0 && !isProcessing && (
          <div className="flex flex-col gap-2" role="region" aria-label="Detected items list">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                Detected Signs (Tap to speak)
              </span>
              <button
                type="button"
                onClick={speakAllDetails}
                className="text-xs text-yellow-400 underline font-bold px-2 py-1 hover:text-yellow-300 focus:ring-2 focus:ring-white rounded"
                aria-label="Read all detected items sequentially"
              >
                Read All
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {detectedTexts.map((item, index) => (
                <button
                  key={`${item.text}-${index}`}
                  type="button"
                  onClick={() => speakItem(item)}
                  className="flex items-center justify-between p-3 bg-zinc-800 hover:bg-zinc-750 active:bg-zinc-700 rounded-xl border border-zinc-700 text-left transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400"
                  aria-label={`${item.text}, category ${item.kind}${item.direction ? `, direction ${item.direction}` : ''}. Tap to speak.`}
                >
                  <div className="flex flex-col gap-0.5 pr-2">
                    <span className="text-sm font-bold text-white break-words">
                      {item.text}
                    </span>
                    {(item.direction || item.arrow) && (
                      <span className="text-xs text-zinc-400">
                        {item.arrow && `Arrow: ${item.arrow} · `}
                        Position: <strong className="text-zinc-200 capitalize">{item.direction}</strong>
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shrink-0 ${getKindBadgeClass(
                      item.kind
                    )}`}
                  >
                    {item.kind}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-zinc-400 pb-1">
          Point camera directly at doors, signs, or room numbers
        </div>
      </div>
    </ModeScreen>
  );
};
