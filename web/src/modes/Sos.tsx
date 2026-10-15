import React, { useEffect, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { settings } from '../core/settings';
import { speech } from '../core/speech';
import type { SosContextData } from '../types';
import { api } from '../vision/api';

interface SosProps {
  onStop: () => void;
  autoTrigger?: boolean;
}

export const Sos: React.FC<SosProps> = ({ onStop, autoTrigger = true }) => {
  const [isGathering, setIsGathering] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextDesc, setContextDesc] = useState('Indoor corridor or room');
  const [sosMessage, setSosMessage] = useState('');
  const [isPrepared, setIsPrepared] = useState(false);

  const trustedNumber = settings.getSettings().trustedContact || '+919876543210';

  const prepareSosMessage = async () => {
    setIsGathering(true);
    earcons.hazard();
    haptics.pulseDanger();
    speech.speak('Gathering emergency context and GPS location...', { priority: 'danger' });

    let lat = 12.8718;
    let lng = 77.5946; // Fallback AMC Engineering College Bengaluru coords

    // 1. Fetch Geolocation
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setCoords({ lat, lng });
      } catch (geoErr) {
        console.warn('Geolocation unavailable, using default:', geoErr);
      }
    }

    // 2. Fetch Visual SOS context via unified /api/analyze task="sos_context"
    let desc = 'Indoor building area, assisting user with emergency assistance';
    try {
      const frame = camera.captureFrame(1024, 0.7);
      if (frame) {
        const res = await api.analyze<SosContextData>({
          task: 'sos_context',
          image: frame,
          lang: speech.getLang(),
        });
        if (res.ok && res.summary) {
          desc = res.summary;
          setContextDesc(desc);
        }
      }
    } catch (vErr) {
      console.warn('Visual context error:', vErr);
    }

    // 3. Build WhatsApp / SMS emergency message
    const msg = `I need help. My location: https://maps.google.com/?q=${lat},${lng}. Around me: ${desc}.`;
    setSosMessage(msg);
    setIsPrepared(true);
    setIsGathering(false);

    speech.speak('Emergency message prepared. Tap send to dispatch WhatsApp or SMS to trusted contact.', {
      priority: 'danger',
    });
  };

  const handleSendWhatsApp = () => {
    const cleanNumber = trustedNumber.replace(/\+/g, '').replace(/\s/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(sosMessage)}`;
    window.open(url, '_blank');
  };

  const handleSendSms = () => {
    const url = `sms:${trustedNumber}?body=${encodeURIComponent(sosMessage)}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (autoTrigger) {
      prepareSosMessage();
    }
    return () => {
      api.abortTask('sos_context');
    };
  }, [autoTrigger]);

  return (
    <ModeScreen
      title="EMERGENCY SOS"
      description="Quick dispatch of location and scene context to trusted contact"
      onStop={onStop}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Urgent warning card */}
        <div
          className="p-6 rounded-3xl bg-red-950 border-4 border-red-500 text-red-200 text-center shadow-2xl"
          aria-live="assertive"
        >
          <span className="text-6xl block mb-2">🆘</span>
          <h2 className="text-2xl font-black mb-1">EMERGENCY ASSISTANCE</h2>
          <p className="text-xs text-red-300 font-mono mb-2">
            Trusted Contact: {trustedNumber}
          </p>
          {isGathering ? (
            <p className="text-sm font-bold animate-pulse text-yellow-300">
              Gathering GPS and visual context...
            </p>
          ) : isPrepared ? (
            <div className="text-left bg-black/60 p-3 rounded-xl border border-red-800 text-xs text-zinc-200 space-y-1">
              <p className="font-bold text-red-400">Prepared Emergency Message:</p>
              <p className="italic">"{sosMessage}"</p>
              {coords && (
                <p className="text-[11px] text-zinc-400">
                  GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              )}
              {contextDesc && (
                <p className="text-[11px] text-zinc-400">Scene: {contextDesc}</p>
              )}
            </div>
          ) : (
            <p className="text-sm">Tap button below to generate emergency dispatch link.</p>
          )}
        </div>

        {/* Action Buttons */}
        {!isPrepared ? (
          <BigButton
            label={isGathering ? 'Preparing...' : 'Trigger SOS Now'}
            variant="danger"
            onClick={prepareSosMessage}
            disabled={isGathering}
            className="w-full py-8 text-2xl font-black"
            icon="🚨"
            ariaDescription="Prepares emergency message with GPS and surroundings"
          />
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <BigButton
              label="Send via WhatsApp"
              variant="primary"
              onClick={handleSendWhatsApp}
              className="w-full py-6 text-xl bg-emerald-600 border-emerald-400"
              icon="💬"
              ariaDescription="Opens WhatsApp with prefilled emergency coordinates and surroundings"
            />
            <BigButton
              label="Send via SMS (Fallback)"
              variant="neutral"
              onClick={handleSendSms}
              className="w-full py-5 text-lg"
              icon="📱"
              ariaDescription="Opens phone SMS messenger with prefilled emergency text"
            />
          </div>
        )}

        <div className="text-center text-xs text-zinc-400 mt-2">
          Browser limitation note: Operating systems require the user to tap "Send" in the messaging app.
        </div>
      </div>
    </ModeScreen>
  );
};
