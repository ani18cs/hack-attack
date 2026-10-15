import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { StatusBanner } from '../components/StatusBanner';
import { camera } from '../core/camera';
import { haptics } from '../core/haptics';
import { PHRASES, SupportedLocale } from '../core/i18n';
import { speech } from '../core/speech';
import { voice } from '../core/voice';
import { AroundMe } from '../modes/AroundMe';
import { FindWashroom } from '../modes/FindWashroom';
import { ObstacleAlert } from '../modes/ObstacleAlert';
import { Read } from '../modes/Read';
import { ActiveMode, VoiceIntent } from '../types';

export const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>('idle');
  const [statusMessage, setStatusMessage] = useState('Tap giant button to start');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [locale] = useState<SupportedLocale>('en-IN');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const phrases = PHRASES[locale];

  // Subscribe to speech and voice status
  useEffect(() => {
    const unsubSpeech = speech.subscribe((speaking) => setIsSpeaking(speaking));
    const unsubVoice = voice.onStatusChange((listening) => setIsListening(listening));

    const unsubIntent = voice.subscribe((intent: VoiceIntent, transcript: string) => {
      handleVoiceIntent(intent, transcript);
    });

    return () => {
      unsubSpeech();
      unsubVoice();
      unsubIntent();
    };
  }, [activeMode]);

  // Handle Intent routing
  const handleVoiceIntent = (intent: VoiceIntent, transcript: string) => {
    console.log(`[Voice] Intent: ${intent}, Transcript: "${transcript}"`);

    switch (intent) {
      case 'AROUND_ME':
        startMode('around_me', 'Starting Around Me mode.');
        break;
      case 'READ':
        startMode('read', 'Starting Read mode. Point camera at sign.');
        break;
      case 'FIND_WASHROOM':
        startMode('find_washroom', phrases.washroomScanning);
        break;
      case 'OBSTACLE_ON':
        startMode('obstacle_alert', 'Obstacle alert activated.');
        break;
      case 'OBSTACLE_OFF':
      case 'STOP':
        stopMode();
        break;
      case 'HELP':
        speech.speak(phrases.commandHelp, { priority: 'normal' });
        setStatusMessage(phrases.commandHelp);
        break;
      case 'REPEAT':
        speech.speak(statusMessage, { priority: 'normal' });
        break;
      case 'UNKNOWN':
      default:
        speech.speak(phrases.unknownCommand, { priority: 'low' });
        break;
    }
  };

  const handleStartExperience = async () => {
    haptics.pulseConfirm();
    setHasStarted(true);
    setStatusMessage('Initializing camera and audio...');

    try {
      // Connect camera to video element
      if (videoRef.current) {
        await camera.start(videoRef.current);
      }
    } catch (err: any) {
      console.warn('Camera initialization warning:', err);
      speech.speak('Camera permission denied or unavailable.', { priority: 'danger' });
    }

    // Start speech recognition
    voice.start();

    // Welcome sequence per spec: 2 sentences + command list
    const welcomeSpeech = `${phrases.welcome} ${phrases.commandHelp}`;
    setStatusMessage('SightLine Ready');
    speech.speak(welcomeSpeech, { priority: 'normal' });
  };

  const startMode = (mode: ActiveMode, spokenConfirmation: string) => {
    haptics.pulseConfirm();
    setActiveMode(mode);
    setStatusMessage(spokenConfirmation);
    speech.speak(spokenConfirmation, { priority: 'normal' });
  };

  const stopMode = () => {
    haptics.pulseInfo();
    setActiveMode('idle');
    const msg = phrases.stopped;
    setStatusMessage(msg);
    speech.speak(msg, { priority: 'normal' });
  };

  const speakButton = (name: string) => {
    speech.speak(name, { priority: 'low' });
  };

  if (!hasStarted) {
    return (
      <main className="h-screen w-screen flex flex-col items-center justify-center p-4 bg-black select-none">
        <video ref={videoRef} className="hidden" playsInline muted autoPlay />
        <button
          type="button"
          onClick={handleStartExperience}
          className="touch-target w-full h-full max-w-lg max-h-[85vh] bg-yellow-400 text-black font-black text-4xl sm:text-5xl rounded-3xl border-8 border-yellow-200 shadow-[0_0_60px_rgba(255,221,0,0.6)] flex flex-col items-center justify-center gap-6 p-6 active:scale-98 transition-transform focus:ring-8 focus:ring-white"
          aria-label="Start SightLine Assistant. Tap anywhere on this giant button to unlock camera and audio."
        >
          <span className="text-8xl">👁️🔊</span>
          <span className="text-center">START SIGHTLINE</span>
          <span className="text-base sm:text-lg font-medium text-zinc-900 bg-yellow-300 px-4 py-2 rounded-full">
            Tap screen to unlock audio & camera
          </span>
        </button>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-black text-white select-none">
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      <header>
        <StatusBanner
          status={statusMessage}
          isListening={isListening}
          isSpeaking={isSpeaking}
        />
      </header>

      {activeMode === 'idle' && (
        <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full justify-between gap-4 py-6">
          <div className="grid grid-cols-1 gap-4 flex-1">
            <BigButton
              label="Around Me"
              variant="primary"
              className="h-28 text-2xl"
              onClick={() => startMode('around_me', 'Starting Around Me mode.')}
              onFocus={() => speakButton('Around Me button')}
              icon="🧭"
              ariaDescription="Announces nearby objects with direction and distance"
            />
            <BigButton
              label="Read Text / Signs"
              variant="primary"
              className="h-28 text-2xl"
              onClick={() => startMode('read', 'Starting Read mode. Point camera at sign.')}
              onFocus={() => speakButton('Read Text button')}
              icon="📖"
              ariaDescription="Reads room labels, exit signs, and directional boards"
            />
            <BigButton
              label="Find Washroom"
              variant="warning"
              className="h-28 text-2xl"
              onClick={() => startMode('find_washroom', phrases.washroomScanning)}
              onFocus={() => speakButton('Find Washroom button')}
              icon="🚻"
              ariaDescription="Scans for restroom signs and provides directional guidance"
            />
            <BigButton
              label="Obstacle Alert"
              variant="danger"
              className="h-28 text-2xl"
              onClick={() => startMode('obstacle_alert', 'Obstacle alert activated.')}
              onFocus={() => speakButton('Obstacle Alert button')}
              icon="🛡️"
              ariaDescription="Real-time warning for fast-approaching obstacles in walking path"
            />
          </div>

          <footer className="pt-2">
            <BigButton
              label="Stop / Help"
              variant="neutral"
              className="w-full h-18 text-xl"
              onClick={() => speech.speak(phrases.commandHelp, { priority: 'normal' })}
              ariaDescription="Speak command instructions and options"
            />
          </footer>
        </main>
      )}

      {activeMode === 'around_me' && (
        <AroundMe
          onStop={stopMode}
          onDescribeOnce={() => {
            speech.speak(phrases.looking, { priority: 'normal' });
            setStatusMessage('Capturing scene...');
          }}
        />
      )}

      {activeMode === 'read' && <Read onStop={stopMode} />}

      {activeMode === 'find_washroom' && <FindWashroom onStop={stopMode} />}

      {activeMode === 'obstacle_alert' && <ObstacleAlert onStop={stopMode} />}
    </div>
  );
};
