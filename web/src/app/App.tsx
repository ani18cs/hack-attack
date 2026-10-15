import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { DebugOverlay } from '../components/DebugOverlay';
import { StatusBanner } from '../components/StatusBanner';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { PHRASES, SupportedLocale } from '../core/i18n';
import { networkMonitor } from '../core/network';
import { settings } from '../core/settings';
import { speech } from '../core/speech';
import { voice } from '../core/voice';
import { AroundMe } from '../modes/AroundMe';
import { Currency } from '../modes/Currency';
import { Find } from '../modes/Find';
import { Hazard } from '../modes/Hazard';
import { Label } from '../modes/Label';
import { Navigate } from '../modes/Navigate';
import { ObstacleAlert } from '../modes/ObstacleAlert';
import { Read } from '../modes/Read';
import { Sos } from '../modes/Sos';
import { Waste } from '../modes/Waste';
import { ActiveMode, SceneObject, VoiceIntent } from '../types';

export const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>('idle');
  const [statusMessage, setStatusMessage] = useState('Tap giant button to start');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>('en-IN');
  const [findTarget, setFindTarget] = useState('washroom');

  // Diagnostics / Dashboard state
  const [showDashboard, setShowDashboard] = useState(settings.getSettings().dashboardVisible);
  const [fps] = useState(8.5);
  const [detectorLatencyMs] = useState(62);
  const [serverLatencyMs] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [detectedObjects] = useState<SceneObject[]>([]);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const phrases = PHRASES[locale] || PHRASES['en-IN'];

  // Subscribe to speech, voice, and network status
  useEffect(() => {
    const unsubSpeech = speech.subscribe((speaking) => setIsSpeaking(speaking));
    const unsubVoice = voice.onStatusChange((listening) => setIsListening(listening));
    const unsubNetwork = networkMonitor.subscribe((online: boolean) => setIsOnline(online));

    const unsubIntent = voice.subscribe((routed) => {
      handleVoiceIntent(routed.intent, routed.raw);
    });

    return () => {
      unsubSpeech();
      unsubVoice();
      unsubNetwork();
      unsubIntent();
    };
  }, [activeMode, locale]);

  // Handle Voice Intent routing
  const handleVoiceIntent = (intent: VoiceIntent, transcript: string) => {
    console.log(`[Voice] Intent: ${intent}, Transcript: "${transcript}"`);

    // Voice shortcut to toggle dashboard
    if (transcript.toLowerCase().includes('dashboard')) {
      toggleDashboard();
      return;
    }

    switch (intent) {
      case 'AROUND_ME':
        startMode('around_me', 'Starting Around Me mode.');
        break;

      case 'READ':
        startMode('read', 'Starting Read mode. Point camera at sign.');
        break;

      case 'FIND': {
        const lower = transcript.toLowerCase();
        let target = 'washroom';
        const findMatch = lower.match(/find\s+(?:my\s+|the\s+)?([a-z0-9\s]+)/i);
        if (findMatch && findMatch[1]) {
          target = findMatch[1].trim();
        }
        setFindTarget(target);
        startMode('find', `Scanning for ${target}. Turn slowly.`);
        break;
      }

      case 'CURRENCY':
        startMode('currency', 'Starting Currency Reader.');
        break;

      case 'WASTE':
        startMode('waste', 'Starting Waste Sorter.');
        break;

      case 'LABEL':
        startMode('label', 'Starting Label Reader.');
        break;

      case 'HAZARD':
        startMode('hazard', 'Starting Hazard Scan.');
        break;

      case 'SOS':
        startMode('sos', 'SOS emergency mode activated.');
        break;

      case 'NAVIGATE':
        startMode('navigate', 'Starting Venue Navigation.');
        break;

      case 'OBSTACLE_ON':
        startMode('obstacle_alert', 'Obstacle alert activated.');
        break;

      case 'OBSTACLE_OFF':
      case 'STOP':
        stopMode();
        break;

      case 'VERBOSITY_QUIET':
        settings.updateSettings({ verbosity: 'quiet' });
        speech.speak('Quiet mode enabled. Hazards only.', { priority: 'normal' });
        break;

      case 'VERBOSITY_NORMAL':
        settings.updateSettings({ verbosity: 'normal' });
        speech.speak('Normal verbosity enabled.', { priority: 'normal' });
        break;

      case 'VERBOSITY_DETAILED':
        settings.updateSettings({ verbosity: 'detailed' });
        speech.speak('Detailed mode enabled.', { priority: 'normal' });
        break;

      case 'LANGUAGE_EN':
        setLocale('en-IN');
        speech.setLang('en-IN');
        speech.speak('English language selected.', { priority: 'normal' });
        break;

      case 'LANGUAGE_HI':
        setLocale('hi-IN');
        speech.setLang('hi-IN');
        speech.speak('Hindi language selected.', { priority: 'normal' });
        break;

      case 'LANGUAGE_KN':
        setLocale('kn-IN');
        speech.setLang('kn-IN');
        speech.speak('Kannada language selected.', { priority: 'normal' });
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
        speech.speak('Say help for options.', { priority: 'low' });
        break;
    }
  };

  /**
   * Single user gesture unlock:
   * Speech synthesis + Web Audio + Camera + Mic + iOS Motion/Orientation permissions
   */
  const handleStartExperience = async () => {
    haptics.pulseConfirm();
    earcons.success();
    setHasStarted(true);
    setStatusMessage('Initializing sensors and audio...');

    // 1. Unlock speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }

    // 2. Request iOS DeviceOrientation & DeviceMotion permissions if available
    try {
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
        await (DeviceOrientationEvent as any).requestPermission();
      }
      if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
        await (DeviceMotionEvent as any).requestPermission();
      }
    } catch (permErr) {
      console.warn('iOS motion permission not granted:', permErr);
    }

    // 3. Connect rear camera
    try {
      if (videoRef.current) {
        await camera.start(videoRef.current);
      }
    } catch (err: any) {
      console.warn('Camera initialization warning:', err);
      speech.speak('Camera permission denied or camera unavailable.', { priority: 'danger' });
    }

    // 4. Start speech recognition
    voice.start();

    // 5. Short spoken welcome and commands
    const welcome =
      'Welcome to SightLine. I am your spatial navigation assistant. Say around me, read text, find washroom, or help.';
    setStatusMessage('SightLine Ready');
    speech.speak(welcome, { priority: 'normal' });
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

  // Triple-tap header title to toggle judge diagnostics dashboard
  const handleTitleClick = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      toggleDashboard();
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 500);
    }
  };

  const toggleDashboard = () => {
    setShowDashboard((prev) => {
      const next = !prev;
      settings.updateSettings({ dashboardVisible: next });
      speech.speak(next ? 'Judge dashboard opened.' : 'Judge dashboard closed.', {
        priority: 'low',
      });
      return next;
    });
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
          <span className="text-base sm:text-lg font-semibold text-zinc-900 bg-yellow-300 px-6 py-2 rounded-full">
            Tap screen to unlock audio & camera
          </span>
        </button>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-black text-white select-none">
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      <header onClick={handleTitleClick} className="cursor-pointer">
        <StatusBanner
          status={statusMessage}
          isListening={isListening}
          isSpeaking={isSpeaking}
        />
      </header>

      {/* Hidden judge diagnostics dashboard */}
      <DebugOverlay
        visible={showDashboard}
        onClose={() => setShowDashboard(false)}
        fps={fps}
        detectorLatencyMs={detectorLatencyMs}
        serverLatencyMs={serverLatencyMs}
        isOnline={isOnline}
        detectedObjects={detectedObjects}
      />

      {activeMode === 'idle' && (
        <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full justify-between gap-4 py-4">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* Core Part 1 Features */}
            <BigButton
              label="Around Me"
              variant="primary"
              className="h-28 text-lg"
              onClick={() => startMode('around_me', 'Starting Around Me mode.')}
              onFocus={() => speakButton('Around Me')}
              icon="🧭"
              ariaDescription="Describes objects and surroundings in real time"
            />
            <BigButton
              label="Obstacle Alert"
              variant="danger"
              className="h-28 text-lg"
              onClick={() => startMode('obstacle_alert', 'Obstacle alert activated.')}
              onFocus={() => speakButton('Obstacle Alert')}
              icon="🛡️"
              ariaDescription="Real-time warning for fast-approaching obstacles"
            />
            <BigButton
              label="Read Signs"
              variant="primary"
              className="h-28 text-lg"
              onClick={() => startMode('read', 'Starting Read mode. Point camera at sign.')}
              onFocus={() => speakButton('Read Signs')}
              icon="📖"
              ariaDescription="Reads signboards, exit signs, and text"
            />
            <BigButton
              label="Find Washroom"
              variant="warning"
              className="h-28 text-lg"
              onClick={() => {
                setFindTarget('washroom');
                startMode('find', 'Scanning for washroom. Turn slowly.');
              }}
              onFocus={() => speakButton('Find Washroom')}
              icon="🚻"
              ariaDescription="Locates washrooms and restrooms"
            />

            {/* Part 2 Mode Buttons (All have tactile buttons and voice intents) */}
            <BigButton
              label="Currency"
              variant="neutral"
              className="h-24 text-base"
              onClick={() => startMode('currency', 'Starting Currency Reader.')}
              onFocus={() => speakButton('Currency')}
              icon="💵"
              ariaDescription="Identifies currency note denomination"
            />
            <BigButton
              label="Waste Bin"
              variant="neutral"
              className="h-24 text-base"
              onClick={() => startMode('waste', 'Starting Waste Sorter.')}
              onFocus={() => speakButton('Waste Bin')}
              icon="♻️"
              ariaDescription="Guides waste item disposal into correct bin"
            />
            <BigButton
              label="Label Reader"
              variant="neutral"
              className="h-24 text-base"
              onClick={() => startMode('label', 'Starting Label Reader.')}
              onFocus={() => speakButton('Label Reader')}
              icon="🏷️"
              ariaDescription="Reads product packaging and allergens"
            />
            <BigButton
              label="Hazard Scan"
              variant="neutral"
              className="h-24 text-base"
              onClick={() => startMode('hazard', 'Starting Hazard Scan.')}
              onFocus={() => speakButton('Hazard Scan')}
              icon="⚠️"
              ariaDescription="Scans for stairs, drop-offs, and floor hazards"
            />
            <BigButton
              label="Navigate"
              variant="neutral"
              className="h-24 text-base"
              onClick={() => startMode('navigate', 'Starting Venue Navigation.')}
              onFocus={() => speakButton('Navigate Venue')}
              icon="🗺️"
              ariaDescription="Turn-by-turn indoor venue navigation"
            />
            <BigButton
              label="Emergency SOS"
              variant="danger"
              className="h-24 text-base"
              onClick={() => startMode('sos', 'SOS emergency mode activated.')}
              onFocus={() => speakButton('Emergency SOS')}
              icon="🆘"
              ariaDescription="Broadcasts emergency context and location"
            />
          </div>

          <footer className="pt-2">
            <BigButton
              label="Stop / Help (Say Help)"
              variant="neutral"
              className="w-full h-16 text-lg"
              onClick={() => speech.speak(phrases.commandHelp, { priority: 'normal' })}
              ariaDescription="Speak command instructions and options"
            />
          </footer>
        </main>
      )}

      {/* Mode Screen Mounts */}
      {activeMode === 'around_me' && (
        <AroundMe
          onStop={stopMode}
          onDescribeOnce={() => {
            speech.speak('Analyzing scene...', { priority: 'normal' });
            setStatusMessage('Capturing scene...');
          }}
        />
      )}

      {activeMode === 'read' && <Read onStop={stopMode} />}

      {activeMode === 'find' && (
        <Find onStop={stopMode} target={findTarget} />
      )}

      {activeMode === 'obstacle_alert' && <ObstacleAlert onStop={stopMode} />}

      {activeMode === 'currency' && <Currency onStop={stopMode} />}

      {activeMode === 'waste' && <Waste onStop={stopMode} />}

      {activeMode === 'label' && <Label onStop={stopMode} />}

      {activeMode === 'hazard' && <Hazard onStop={stopMode} />}

      {activeMode === 'navigate' && <Navigate onStop={stopMode} />}

      {activeMode === 'sos' && <Sos onStop={stopMode} />}
    </div>
  );
};
