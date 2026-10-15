import React, { useEffect, useState } from 'react';
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
}

export const Read: React.FC<ReadProps> = ({ onStop }) => {
  const [isReading, setIsReading] = useState(false);
  const [displayText, setDisplayText] = useState('Point camera at signs, exit labels, or doors and tap "Read Now"');
  const [readItems, setReadItems] = useState<ReadTextItem[]>([]);

  const handleRead = async () => {
    if (isReading) return;
    setIsReading(true);
    speech.speak('Reading...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (!frame) {
        speech.speak('Camera not ready. Please try again.', { priority: 'normal' });
        setIsReading(false);
        return;
      }

      // Check offline status
      const isOnline = networkMonitor.isOnline();
      if (!isOnline) {
        const fallbackData = await recognizeTextFallback(frame);
        if (fallbackData.texts.length > 0) {
          const first = fallbackData.texts[0].text;
          const summary = `Offline text reads: ${first}`;
          setDisplayText(summary);
          setReadItems(fallbackData.texts);
          earcons.success();
          speech.speak(summary, { priority: 'normal' });
        } else {
          setDisplayText('No text detected in offline mode.');
          speech.speak('No text detected.', { priority: 'normal' });
        }
        setIsReading(false);
        return;
      }

      // Online server analysis via unified /api/analyze task="read"
      const res = await api.read(frame, speech.getLang());

      if (res.ok && res.summary) {
        const phrased = confidencePhrase(res.confidence, res.summary);
        setDisplayText(phrased);
        setReadItems(res.data?.texts || []);
        earcons.found();
        haptics.pulseFound();
        speech.speak(phrased, { priority: 'normal' });
      } else {
        // Graceful fallback to local Tesseract if server analysis failed
        console.warn('Server read returned error, trying Tesseract fallback...');
        const fallbackData = await recognizeTextFallback(frame);
        if (fallbackData.texts.length > 0) {
          const first = fallbackData.texts[0].text;
          const summary = `Sign reads: ${first}`;
          setDisplayText(summary);
          setReadItems(fallbackData.texts);
          speech.speak(summary, { priority: 'normal' });
        } else {
          const failMsg = res.summary || 'Could not read any signs clearly.';
          setDisplayText(failMsg);
          speech.speak(failMsg, { priority: 'normal' });
        }
      }
    } catch (err: any) {
      console.error('Read error:', err);
      speech.speak('Could not complete reading.', { priority: 'normal' });
    } finally {
      setIsReading(false);
    }
  };

  // Speaks detailed individual sign items when user requests "more"
  const handleReadMore = () => {
    if (readItems.length === 0) {
      speech.speak('No additional text details available.', { priority: 'normal' });
      return;
    }

    const details = readItems
      .map((item, idx) => {
        let text = `Item ${idx + 1}: ${item.text}`;
        if (item.arrow) {
          text += `, arrow points ${item.arrow}`;
        }
        text += `, ${item.direction.replace('-', ' ')}`;
        return text;
      })
      .join('. ');

    speech.speak(details, { priority: 'normal' });
  };

  useEffect(() => {
    return () => {
      api.abortTask('read');
    };
  }, []);

  return (
    <ModeScreen
      title="Read Signs"
      description="Transcribes room labels, exit boards, and directions"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Results banner */}
        <div
          className="p-5 rounded-2xl bg-zinc-900 border-2 border-emerald-500 text-zinc-100 text-base font-medium shadow-md text-center min-h-[90px] flex items-center justify-center"
          aria-live="polite"
        >
          {isReading ? (
            <span className="text-emerald-400 font-bold animate-pulse">Reading visible text...</span>
          ) : (
            <span>{displayText}</span>
          )}
        </div>

        {/* Primary read button */}
        <BigButton
          label={isReading ? 'Reading...' : 'Read Now'}
          variant="primary"
          onClick={handleRead}
          disabled={isReading}
          className="w-full py-8 text-2xl"
          icon="📖"
          ariaDescription="Captures a frame and reads all visible signs and directional arrows"
        />

        {/* Read more button */}
        {readItems.length > 1 && (
          <BigButton
            label="Read More Details"
            variant="neutral"
            onClick={handleReadMore}
            className="w-full py-5 text-lg"
            icon="ℹ️"
            ariaDescription="Reads additional transcribed signs and locations aloud"
          />
        )}

        <div className="text-center text-xs text-zinc-400 mt-2">
          Voice shortcuts: "Read", "Read this sign", "More", or "Stop"
        </div>
      </div>
    </ModeScreen>
  );
};
