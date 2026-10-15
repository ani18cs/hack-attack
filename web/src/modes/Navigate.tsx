import React, { useEffect, useRef, useState } from 'react';
import { BigButton } from '../components/BigButton';
import { ModeScreen } from '../components/ModeScreen';
import { camera } from '../core/camera';
import { earcons } from '../core/earcons';
import { haptics } from '../core/haptics';
import { speech } from '../core/speech';
import { voice } from '../core/voice';
import type { VerifyLandmarkData } from '../types';
import { api } from '../vision/api';
import { compass } from '../venue/compass';
import { loadVenuePack } from '../venue/loader';
import { detectQrFromCanvasOrVideo, matchLandmarkByVoice } from '../venue/localize';
import { NavigatorEvent, venueNavigator } from '../venue/navigator';
import { stepTracker, StepTracker } from '../venue/steps';
import type { Landmark, VenuePack } from '../venue/types';

interface NavigateProps {
  onStop: () => void;
  initialDestination?: string;
}

export const Navigate: React.FC<NavigateProps> = ({
  onStop,
  initialDestination = 'washroom',
}) => {
  const [venue, setVenue] = useState<VenuePack | null>(null);
  const [navEvent, setNavEvent] = useState<NavigatorEvent>(venueNavigator.getEvent());
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [stepCount, setStepCount] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [startLandmark, setStartLandmark] = useState<Landmark | null>(null);
  const [destinationInput] = useState(initialDestination);
  const [statusAnnouncement, setStatusAnnouncement] = useState('Loading AMC Engineering College venue pack...');

  const initialHeadingRef = useRef<number | null>(null);
  const lastSpokenInstructionRef = useRef<string>('');

  // 1. Load Venue Pack & Set Default Start Landmark
  useEffect(() => {
    let isMounted = true;

    async function initVenue() {
      const pack = await loadVenuePack('amc-hackattack');
      if (!isMounted || !pack) return;
      setVenue(pack);

      // Default start is main entrance
      const entrance = pack.landmarks.find((l) => l.id === 'entrance') || pack.landmarks[0];
      setStartLandmark(entrance);

      setStatusAnnouncement(`Venue loaded. Starting location: ${entrance.name}. Navigating to ${initialDestination}.`);
      speech.speak(`Venue map loaded. Starting from ${entrance.name}.`, { priority: 'normal' });

      // Start navigator
      const evt = venueNavigator.startNavigation({
        fromLandmark: entrance,
        destinationQuery: initialDestination,
        venue: pack,
        currentSteps: stepTracker.getSteps(),
        currentHeading: compass.getHeading(),
      });
      setNavEvent(evt);
      speakNavInstruction(evt.instruction);
    }

    initVenue();

    // Start sensors
    stepTracker.start();
    compass.start();

    const unsubSteps = stepTracker.onStep((steps) => {
      setStepCount(steps);
      const update = venueNavigator.onStepCountUpdate(steps);
      if (update) {
        setNavEvent(update);
        speakNavInstruction(update.instruction);
      }
    });

    const unsubCompass = compass.subscribe((heading) => {
      setCurrentHeading(heading);

      // Live turn guidance during STEP_TURN
      const currentStep = venueNavigator.getCurrentStep();
      if (
        venueNavigator.getState() === 'STEP_TURN' &&
        currentStep?.headingChange &&
        initialHeadingRef.current !== null
      ) {
        const turnCheck = compass.evaluateTurn(
          initialHeadingRef.current,
          heading,
          currentStep.headingChange
        );

        if (turnCheck.nudge) {
          speech.speak(turnCheck.nudge, { priority: 'low' });
        }

        if (turnCheck.isComplete) {
          haptics.pulseConfirm();
          earcons.success();
          // Advance turn step automatically
          const nextEvt = venueNavigator.advanceStep(stepTracker.getSteps(), heading);
          setNavEvent(nextEvt);
          speakNavInstruction(nextEvt.instruction);
          initialHeadingRef.current = null;
        }
      }
    });

    const unsubNavigator = venueNavigator.subscribe((evt) => {
      setNavEvent(evt);
      if (evt.state === 'STEP_TURN') {
        initialHeadingRef.current = compass.getHeading();
      }
    });

    return () => {
      isMounted = false;
      unsubSteps();
      unsubCompass();
      unsubNavigator();
      stepTracker.stop();
      compass.stop();
      venueNavigator.stop();
    };
  }, [initialDestination]);

  // 2. Subscribe to voice commands ("next", "repeat", "where am I", "stop navigation")
  useEffect(() => {
    const unsubVoice = voice.subscribe((routed) => {
      const lower = routed.raw.toLowerCase();

      if (lower.includes('next') || lower.includes('forward')) {
        handleManualNext();
      } else if (lower.includes('repeat') || lower.includes('say again')) {
        handleRepeat();
      } else if (lower.includes('where am i') || lower.includes('status')) {
        handleWhereAmI();
      } else if (lower.includes('stop navigation') || lower.includes('cancel')) {
        venueNavigator.stop();
        speech.speak('Navigation stopped.', { priority: 'normal' });
        onStop();
      } else if (lower.startsWith('i am at') || lower.startsWith("i'm at")) {
        if (venue) {
          const matched = matchLandmarkByVoice(lower, venue);
          if (matched) {
            setStartLandmark(matched);
            const msg = `Updated starting location to ${matched.name}.`;
            speech.speak(msg, { priority: 'normal' });
            setStatusAnnouncement(msg);
            const newEvt = venueNavigator.startNavigation({
              fromLandmark: matched,
              destinationQuery: destinationInput,
              venue,
              currentSteps: stepTracker.getSteps(),
              currentHeading: compass.getHeading(),
            });
            setNavEvent(newEvt);
            speakNavInstruction(newEvt.instruction);
          }
        }
      }
    });

    return () => unsubVoice();
  }, [venue, destinationInput]);

  const speakNavInstruction = (text: string) => {
    if (text && text !== lastSpokenInstructionRef.current) {
      lastSpokenInstructionRef.current = text;
      setStatusAnnouncement(text);
      speech.speak(text, { priority: 'normal' });
    }
  };

  const handleManualNext = () => {
    haptics.pulseConfirm();
    const nextEvt = venueNavigator.advanceStep(stepTracker.getSteps(), compass.getHeading());
    setNavEvent(nextEvt);
    speakNavInstruction(nextEvt.instruction);

    if (nextEvt.isCheckpoint) {
      triggerCheckpointVerification();
    }
  };

  const handleRepeat = () => {
    haptics.pulseInfo();
    const text = venueNavigator.repeatInstruction();
    speech.speak(text, { priority: 'normal' });
  };

  const handleWhereAmI = () => {
    haptics.pulseInfo();
    const desc = venueNavigator.getStatusDescription(stepCount);
    speech.speak(desc, { priority: 'normal' });
    setStatusAnnouncement(desc);
  };

  // Checkpoint verification via visual sign recognition and QR scan
  const triggerCheckpointVerification = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    speech.speak('Verifying checkpoint signs and QR codes...', { priority: 'normal' });

    try {
      const frame = camera.captureFrame(1024, 0.7);
      const step = navEvent.currentStep;
      const expectedSigns = step?.checkpoint?.expectSignText || ['WC', 'GENTS'];

      let verified = false;
      let evidence = '';

      // Check native QR if available on video element
      const videoEl = camera.getVideoElement();
      if (videoEl) {
        const qr = await detectQrFromCanvasOrVideo(videoEl);
        if (qr && qr.includes(step?.checkpoint?.landmarkId || '')) {
          verified = true;
          evidence = `Scanned QR ${qr}`;
        }
      }

      // If not QR, run /api/analyze task="verify_landmark"
      if (!verified && frame) {
        const res = await api.analyze<VerifyLandmarkData>({
          task: 'verify_landmark',
          image: frame,
          context: `Looking for signs with text: ${expectedSigns.join(', ')}`,
          lang: speech.getLang(),
        });

        if (res.ok && res.data?.matches) {
          verified = true;
          evidence = res.data.evidence || 'Sign matched visual checkpoint';
        }
      }

      const resEvt = venueNavigator.handleCheckpointResult(verified, evidence);
      setNavEvent(resEvt);

      if (verified) {
        earcons.found();
        haptics.pulseFound();
        speakNavInstruction(resEvt.instruction);
      } else {
        earcons.error();
        speakNavInstruction(resEvt.instruction);
      }
    } catch (err) {
      console.warn('Checkpoint verification error:', err);
      const failEvt = venueNavigator.handleCheckpointResult(false);
      setNavEvent(failEvt);
      speakNavInstruction(failEvt.instruction);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <ModeScreen
      title="Venue Navigation"
      description="Voice-guided turn-by-turn navigation with checkpoint verification"
      onStop={() => {
        venueNavigator.stop();
        onStop();
      }}
    >
      <div className="w-full flex flex-col gap-4">
        {/* Navigation Step Card */}
        <div
          className={`p-6 rounded-3xl border-4 text-center min-h-[160px] flex flex-col items-center justify-center shadow-lg transition-colors ${
            navEvent.isArrived
              ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
              : navEvent.isCheckpoint
              ? 'bg-amber-950 border-amber-400 text-amber-200 animate-pulse'
              : 'bg-zinc-900 border-yellow-400 text-yellow-300'
          }`}
          aria-live="assertive"
        >
          <span className="text-5xl block mb-2">
            {navEvent.isArrived
              ? '🏁'
              : navEvent.isCheckpoint
              ? '🔍'
              : navEvent.currentStep?.turn === 'left'
              ? '⬅️'
              : navEvent.currentStep?.turn === 'right'
              ? '➡️'
              : navEvent.currentStep?.turn === 'u_turn'
              ? '🔄'
              : '⬆️'}
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-1">
            {navEvent.isArrived
              ? 'ARRIVED AT DESTINATION'
              : `Step ${navEvent.stepIndex + 1} of ${navEvent.totalSteps || 1}`}
          </h2>

          <p className="text-base sm:text-lg font-bold text-zinc-100 mt-1">
            {statusAnnouncement}
          </p>

          {navEvent.currentStep?.steps && (
            <p className="text-xs text-yellow-400 mt-2 font-mono">
              Target: {StepTracker.formatSteps(navEvent.currentStep.steps)}
            </p>
          )}
        </div>

        {/* Live Diagnostics Dashboard */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs text-zinc-300">
          <div>
            <span className="text-zinc-400 block">From:</span>
            <span className="font-bold text-white">{startLandmark?.name || 'Entrance'}</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Destination:</span>
            <span className="font-bold text-white">{navEvent.targetLandmark?.name || destinationInput}</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Steps Counted:</span>
            <span className="font-bold text-yellow-400 font-mono">
              {StepTracker.formatSteps(stepCount)}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block">Compass Heading:</span>
            <span className="font-bold text-yellow-400 font-mono">
              {currentHeading !== null ? `${currentHeading}°` : 'Sensor calibrating...'}
            </span>
          </div>
        </div>

        {/* Checkpoint verification banner if active */}
        {navEvent.isCheckpoint && (
          <BigButton
            label={isVerifying ? 'Verifying Sign...' : 'Verify Checkpoint Sign'}
            variant="warning"
            onClick={triggerCheckpointVerification}
            disabled={isVerifying}
            className="w-full py-6 text-xl"
            icon="🔎"
            ariaDescription="Scans camera for destination sign or QR code"
          />
        )}

        {/* Navigation Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <BigButton
            label="Next Step"
            variant="primary"
            onClick={handleManualNext}
            className="py-5 text-lg"
            icon="⏩"
            ariaDescription="Advances to the next turn or walking step"
          />
          <BigButton
            label="Repeat Step"
            variant="neutral"
            onClick={handleRepeat}
            className="py-5 text-lg"
            icon="🔁"
            ariaDescription="Repeats the current navigation direction"
          />
        </div>

        <BigButton
          label="Where Am I?"
          variant="neutral"
          onClick={handleWhereAmI}
          className="w-full py-4 text-base"
          icon="📍"
          ariaDescription="Speaks your current location and navigation progress"
        />

        <div className="text-center text-xs text-zinc-400">
          Voice shortcuts: "Next", "Repeat", "Where am I", or "I am at [location]"
        </div>
      </div>
    </ModeScreen>
  );
};
