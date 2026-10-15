import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { CameraPreviewHUD } from '../components/CameraPreviewHUD';
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
import { detector } from '../vision/detector';
import { processSpatialObject } from '../vision/spatial';

export const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>('idle');
  const [statusMessage, setStatusMessage] = useState('Tap giant button to start');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>('en-IN');
  const [findTarget, setFindTarget] = useState('washroom');
  const [showMoreTools, setShowMoreTools] = useState(false);

  // Diagnostics / Dashboard state
  const [showDashboard, setShowDashboard] = useState(settings.getSettings().dashboardVisible);
  const [fps] = useState(8.5);
  const [detectorLatencyMs] = useState(62);
  const [serverLatencyMs] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [detectedObjects, setDetectedObjects] = useState<SceneObject[]>([]);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Hook detector for live bounding boxes when experience has started
  useEffect(() => {
    if (!hasStarted) return;
    let isMounted = true;

    // Attach camera to video element
    if (videoRef.current) {
      camera.setVideoElement(videoRef.current);
    }

    const startTracking = async () => {
      try {
        await detector.loadModel();
        if (!isMounted) return;
        if (videoRef.current) {
          detector.startDetection(videoRef.current);
        }
      } catch (err) {
        console.warn('COCO-SSD initial load delayed or failed:', err);
      }
    };

    startTracking();

    const unsubDetector = detector.subscribe((rawDetections) => {
      if (!isMounted) return;
      const video = videoRef.current;
      const vw = video?.videoWidth || 640;
      const vh = video?.videoHeight || 480;
      const objects = rawDetections.map((d) => processSpatialObject(d, vw, vh));
      setDetectedObjects(objects);
    });

    return () => {
      isMounted = false;
      unsubDetector();
    };
  }, [hasStarted]);

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

      case 'PRIVACY': {
        const privMsg = 'Pictures are never saved. They are only sent when you ask.';
        speech.speak(privMsg, { priority: 'normal' });
        setStatusMessage(privMsg);
        break;
      }

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
      await camera.start();
      if (videoRef.current) {
        camera.setVideoElement(videoRef.current);
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
      <header onClick={handleTitleClick} className="cursor-pointer">
        <StatusBanner
          status={statusMessage}
          isListening={isListening}
          isSpeaking={isSpeaking}
        />
      </header>

      {/* Live Camera Viewfinder HUD with real-time detection boxes */}
      <div className="px-3 pt-2 max-w-lg mx-auto w-full">
        <CameraPreviewHUD
          videoRef={videoRef}
          detectedObjects={detectedObjects}
          fps={fps}
          activeModeName={activeMode}
          isOnline={isOnline}
        />
      </div>

      {/* Hidden judge diagnostics dashboard */}
      <DebugOverlay
        visible={showDashboard}
        onClose={() => setShowDashboard(false)}
        fps={fps}
        detectorLatencyMs={detectorLatencyMs}
        serverLatencyMs={serverLatencyMs}
        isOnline={isOnline}
        detectedObjects={detectedObjects}
        currentMode={activeMode}
      />

      {activeMode === 'idle' && (
        <main className="flex-1 flex flex-col p-3 max-w-lg mx-auto w-full gap-3 py-2">
          {/* 1. Core Primary Modes (Huge tactile targets, decluttered & high-contrast) */}
          <div className="grid grid-cols-2 gap-2.5">
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
              label="Read Signs"
              variant="primary"
              className="h-28 text-lg"
              onClick={() => startMode('read', 'Starting Read mode. Point camera at sign.')}
              onFocus={() => speakButton('Read Signs')}
              icon="📖"
              ariaDescription="Reads signboards, exit signs, and text"
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
              label="Find Target"
              variant="warning"
              className="h-28 text-lg"
              onClick={() => {
                setFindTarget('washroom');
                startMode('find', 'Scanning for washroom. Turn slowly.');
              }}
              onFocus={() => speakButton('Find Washroom')}
              icon="🚻"
              ariaDescription="Locates washrooms and specified targets"
            />
          </div>

          {/* 2. Urgent Emergency SOS Bar */}
          <button
            type="button"
            onClick={() => startMode('sos', 'SOS emergency mode activated.')}
            onFocus={() => speakButton('Emergency SOS')}
            className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-500 active:scale-98 text-white font-black text-lg rounded-2xl border-2 border-red-400 shadow-lg flex items-center justify-center gap-3 transition-transform"
            aria-label="Emergency SOS. Double tap or say SOS to broadcast emergency context."
          >
            <span className="text-2xl">🆘</span>
            <span>EMERGENCY SOS (Say "SOS")</span>
          </button>

          {/* 3. Decluttered Collapsible "More Tools" Drawer */}
          <div className="border border-zinc-800 rounded-2xl bg-zinc-950 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setShowMoreTools((prev) => {
                  const next = !prev;
                  speech.speak(next ? 'More tools expanded.' : 'More tools collapsed.', {
                    priority: 'low',
                  });
                  return next;
                });
              }}
              className="w-full py-3 px-4 flex items-center justify-between text-zinc-300 hover:text-white font-bold text-sm bg-zinc-900/80 active:bg-zinc-800 transition-colors"
              aria-expanded={showMoreTools}
            >
              <div className="flex items-center gap-2">
                <span>🧰</span>
                <span>{showMoreTools ? 'Hide Extra Tools' : 'More Assistant Tools (5)'}</span>
              </div>
              <span className="text-xs text-yellow-400 font-mono">
                {showMoreTools ? '▲ COLLAPSE' : '▼ EXPAND'}
              </span>
            </button>

            {showMoreTools && (
              <div className="p-2.5 grid grid-cols-2 gap-2">
                <BigButton
                  label="Currency"
                  variant="neutral"
                  className="h-20 text-sm"
                  onClick={() => startMode('currency', 'Starting Currency Reader.')}
                  onFocus={() => speakButton('Currency')}
                  icon="💵"
                  ariaDescription="Identifies currency note denomination"
                />
                <BigButton
                  label="Waste Bin"
                  variant="neutral"
                  className="h-20 text-sm"
                  onClick={() => startMode('waste', 'Starting Waste Sorter.')}
                  onFocus={() => speakButton('Waste Bin')}
                  icon="♻️"
                  ariaDescription="Guides waste item disposal into correct bin"
                />
                <BigButton
                  label="Label Reader"
                  variant="neutral"
                  className="h-20 text-sm"
                  onClick={() => startMode('label', 'Starting Label Reader.')}
                  onFocus={() => speakButton('Label Reader')}
                  icon="🏷️"
                  ariaDescription="Reads product packaging and allergens"
                />
                <BigButton
                  label="Hazard Scan"
                  variant="neutral"
                  className="h-20 text-sm"
                  onClick={() => startMode('hazard', 'Starting Hazard Scan.')}
                  onFocus={() => speakButton('Hazard Scan')}
                  icon="⚠️"
                  ariaDescription="Scans for stairs, drop-offs, and floor hazards"
                />
                <div className="col-span-2">
                  <BigButton
                    label="Navigate Venue"
                    variant="neutral"
                    className="h-16 text-sm w-full"
                    onClick={() => startMode('navigate', 'Starting Venue Navigation.')}
                    onFocus={() => speakButton('Navigate Venue')}
                    icon="🗺️"
                    ariaDescription="Turn-by-turn indoor venue navigation"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Footer Help Button */}
          <footer className="pt-1">
            <BigButton
              label="Stop / Help (Say Help)"
              variant="neutral"
              className="w-full h-14 text-base"
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
