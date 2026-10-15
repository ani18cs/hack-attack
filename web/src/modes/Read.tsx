import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import { Direction, TextKind } from '../types';
import { api } from '../vision/api';
import { recognizeTextFallback } from '../vision/ocr';

interface DetectedTextItem {
  text: string;
  kind: TextKind;
  direction?: Direction;
}

interface ReadProps {
  onStop: () => void;
  lang?: string;
  onCaptureAndRead?: () => void;
  isProcessing?: boolean;
}

export const Read: React.FC<ReadProps> = ({
  onStop,
  lang = 'en',
  onCaptureAndRead,
  isProcessing: externalProcessing,
}) => {
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Point camera at signs, doors, or text.');
  const [summary, setSummary] = useState<string | null>(null);
  const [detectedTexts, setDetectedTexts] = useState<DetectedTextItem[]>([]);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  const isProcessing = externalProcessing ?? internalProcessing;
  const inFlightRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const isMountedRef = useRef(true);

  const executeRead = useCallback(async () => {
    // Guard against concurrent executions
    if (inFlightRef.current || !isMountedRef.current) return;
    inFlightRef.current = true;
    setInternalProcessing(true);
    setIsOfflineFallback(false);
    setStatusMessage('Capturing frame...');

    try {
      // 1. Spoken feedback and haptic pulse
      speech.speak('Looking...', { priority: 'normal' });
      haptics.pulseInfo();

      // 2. Capture high-res frame from rear camera with brief retry if initializing
      let frameBase64 = camera.captureFrame(1024, 0.75);

      if (!frameBase64) {
        // Wait 350ms in case camera video stream is just starting up
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (!isMountedRef.current) return;
        frameBase64 = camera.captureFrame(1024, 0.75);
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

      // 3. Online Gemini vision request
      const response = await api.readText(frameBase64, lang);
      if (!isMountedRef.current) return;

      // Check if server returned an error or was unreachable
      if (response.error || !response.summary) {
        console.warn('Online readText error, falling back to local OCR:', response.error);
        setStatusMessage('Server offline. Trying on-device text reader...');
        speech.speak('Server offline. Trying on-device text reader.', { priority: 'normal' });

        // 4. Offline Tesseract.js fallback
        try {
          const fallbackRaw = await recognizeTextFallback(frameBase64);
          if (!isMountedRef.current) return;

          const cleanText = fallbackRaw?.replace(/\s+/g, ' ').trim();

          if (cleanText && cleanText.length > 0) {
            haptics.pulseConfirm();
            setIsOfflineFallback(true);

            // Split into separate line items if multiline text was detected
            const rawLines = fallbackRaw
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 1);

            const fallbackItems: DetectedTextItem[] =
              rawLines.length > 0
                ? rawLines.map((line) => ({
                    text: line,
                    kind: 'other',
                    direction: 'ahead',
                  }))
                : [
                    {
                      text: cleanText,
                      kind: 'other',
                      direction: 'ahead',
                    },
                  ];

            const fallbackSummary = `Offline mode: ${cleanText}`;
            setSummary(fallbackSummary);
            setDetectedTexts(fallbackItems);
            setStatusMessage(`Read complete (${fallbackItems.length} text found via offline fallback)`);
            speech.speak(`Offline mode. Found text: ${cleanText}`, { priority: 'normal' });
          } else {
            const noTextMsg = 'No text detected by offline reader.';
            setSummary(noTextMsg);
            setDetectedTexts([]);
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
        return;
      }

      // 5. Success with Gemini vision
      if (!isMountedRef.current) return;
      haptics.pulseConfirm();
      setSummary(response.summary);
      setDetectedTexts(response.texts || []);

      if (response.texts && response.texts.length > 0) {
        setStatusMessage(`Found ${response.texts.length} text ${response.texts.length === 1 ? 'item' : 'items'}`);
      } else {
        setStatusMessage('No text or signs detected.');
      }

      // Announce the summary aloud
      speech.speak(response.summary, { priority: 'normal' });
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

  // Auto-trigger frame capture once on mount after camera stabilizes, with cleanup
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

  const speakItem = (item: DetectedTextItem) => {
    speech.stop();
    const directionPhrase = item.direction ? `, on your ${item.direction}` : '';
    const kindPhrase = item.kind && item.kind !== 'other' ? ` (${item.kind})` : '';
    speech.speak(`${item.text}${kindPhrase}${directionPhrase}`, { priority: 'normal' });
  };

  const speakAllDetails = () => {
    if (detectedTexts.length === 0) return;
    speech.stop();
    const fullText = detectedTexts
      .map((item) => {
        const dir = item.direction ? `on the ${item.direction}` : '';
        return `${item.text} ${dir}`.trim();
      })
      .join('. ');
    speech.speak(fullText, { priority: 'normal' });
  };

  const getKindBadgeClass = (kind: TextKind) => {
    switch (kind) {
      case 'exit':
        return 'bg-green-600 text-white';
      case 'warning':
        return 'bg-red-600 text-white';
      case 'direction':
        return 'bg-blue-600 text-white';
      case 'room':
        return 'bg-purple-600 text-white';
      case 'store':
        return 'bg-amber-600 text-black';
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
      <div className="w-full flex flex-col gap-4 max-h-[60vh] overflow-y-auto px-1">
        {/* Primary Action Button */}
        <BigButton
          label={isProcessing ? 'Reading...' : 'Read Now'}
          variant="primary"
          onClick={handleManualTrigger}
          disabled={isProcessing}
          className="w-full py-8 text-2xl"
          ariaDescription="Captures a frame and reads all visible text and signs"
        />

        {/* Processing Indicator */}
        {isProcessing && (
          <div
            className="flex items-center justify-center p-4 bg-zinc-900 border-2 border-yellow-400 rounded-2xl animate-pulse text-yellow-300 font-bold"
            role="status"
            aria-live="polite"
          >
            <span className="mr-2 text-xl">🔍</span>
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Offline Fallback Badge */}
        {isOfflineFallback && !isProcessing && (
          <div
            className="p-3 bg-amber-950 border border-amber-500 text-amber-200 rounded-xl text-center text-sm font-semibold"
            role="note"
          >
            ⚠️ Offline reader used (lower accuracy)
          </div>
        )}

        {/* Summary Card */}
        {summary && !isProcessing && (
          <div
            className="p-4 bg-zinc-900 border-2 border-zinc-700 rounded-2xl flex flex-col gap-2"
            role="region"
            aria-label="Summary of detected text"
          >
            <span className="text-xs uppercase tracking-wider text-yellow-400 font-bold">
              Summary
            </span>
            <p className="text-lg font-semibold text-white leading-snug">
              {summary}
            </p>
          </div>
        )}

        {/* List of Detected Text Items */}
        {detectedTexts.length > 0 && !isProcessing && (
          <div className="flex flex-col gap-2" role="region" aria-label="Detected items list">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                Detected Signs & Labels (Tap to speak)
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
                  className="flex items-center justify-between p-3.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl border border-zinc-600 text-left transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400"
                  aria-label={`${item.text}, category ${item.kind}${item.direction ? `, direction ${item.direction}` : ''}. Tap to speak.`}
                >
                  <div className="flex flex-col gap-1 pr-2">
                    <span className="text-base font-bold text-white break-words">
                      {item.text}
                    </span>
                    {item.direction && (
                      <span className="text-xs text-zinc-400">
                        Position: <strong className="text-zinc-200 capitalize">{item.direction}</strong>
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full uppercase font-bold tracking-wider shrink-0 ${getKindBadgeClass(
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

        {/* Helper Hint */}
        <div className="text-center text-xs text-zinc-400 pb-2">
          Point camera directly at doors, signs, or room numbers
        </div>
      </div>
    </ModeScreen>
  );
};
