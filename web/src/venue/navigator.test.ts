import { describe, expect, it } from 'vitest';
import { matchLandmarkByVoice, matchLandmarkByQr, matchLandmarkBySignText } from './localize';
import { VenueNavigator } from './navigator';
import { VenuePack, VenuePackSchema } from './types';

const mockVenue: VenuePack = {
  venue: {
    id: 'test-amc',
    name: 'AMC Engineering College Test',
    defaultLang: 'en',
  },
  landmarks: [
    {
      id: 'entrance',
      name: 'Main Entrance',
      aliases: ['gate', 'entry', 'main door', 'foyer'],
      signText: ['WELCOME', 'AMC'],
      qr: 'LM-ENTRANCE',
      type: 'entrance',
      names: {
        hi: 'मुख्य प्रवेशद्वार',
        kn: 'ಮುಖ್ಯ ದ್ವಾರ',
      },
    },
    {
      id: 'washroom-g',
      name: 'Washroom Ground Floor',
      aliases: ['toilet', 'restroom', 'wc', 'gents', 'ladies', 'washroom'],
      signText: ['WC', 'GENTS'],
      qr: 'LM-WASH1',
      type: 'washroom',
      names: {
        hi: 'शौचालय',
        kn: 'ಶೌಚಾಲಯ',
      },
    },
  ],
  routes: [
    {
      from: 'entrance',
      to: 'washroom-g',
      steps: [
        {
          text: 'Walk straight about 20 steps.',
          steps: 20,
          turn: 'straight',
        },
        {
          text: 'Turn left.',
          turn: 'left',
          headingChange: -90,
        },
        {
          text: 'Walk about 10 steps. The washroom door is on your right.',
          steps: 10,
          checkpoint: {
            landmarkId: 'washroom-g',
            expectSignText: ['WC', 'GENTS'],
          },
        },
      ],
    },
  ],
};

describe('Venue Schema Validation', () => {
  it('validates a correct venue pack against Zod schema', () => {
    const parsed = VenuePackSchema.safeParse(mockVenue);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid venue pack missing required fields', () => {
    const invalid = { venue: { id: 'x' } };
    const parsed = VenuePackSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe('Landmark Alias & Multilingual Resolution', () => {
  it('resolves standard English aliases', () => {
    const lm1 = matchLandmarkByVoice('take me to the toilet', mockVenue);
    expect(lm1?.id).toBe('washroom-g');

    const lm2 = matchLandmarkByVoice("I'm standing at the gate", mockVenue);
    expect(lm2?.id).toBe('entrance');

    const lm3 = matchLandmarkByVoice('where is the wc', mockVenue);
    expect(lm3?.id).toBe('washroom-g');
  });

  it('resolves Hindi name variants', () => {
    const lm = matchLandmarkByVoice('मुझे शौचालय जाना है', mockVenue);
    expect(lm?.id).toBe('washroom-g');

    const lmEntrance = matchLandmarkByVoice('मुख्य प्रवेशद्वार', mockVenue);
    expect(lmEntrance?.id).toBe('entrance');
  });

  it('resolves Kannada name variants', () => {
    const lm = matchLandmarkByVoice('ಶೌಚಾಲಯ', mockVenue);
    expect(lm?.id).toBe('washroom-g');

    const lmEntrance = matchLandmarkByVoice('ಮುಖ್ಯ ದ್ವಾರ', mockVenue);
    expect(lmEntrance?.id).toBe('entrance');
  });

  it('resolves QR codes accurately', () => {
    const lm = matchLandmarkByQr('LM-WASH1', mockVenue);
    expect(lm?.id).toBe('washroom-g');
  });

  it('matches detected visual sign texts', () => {
    const res = matchLandmarkBySignText(['CAMPUS', 'GENTS', 'BLOCK A'], mockVenue);
    expect(res?.landmark.id).toBe('washroom-g');
    expect(res?.evidence).toContain('GENTS');
  });
});

describe('VenueNavigator State Machine', () => {
  it('starts navigation along valid route', () => {
    const nav = new VenueNavigator();
    const entrance = mockVenue.landmarks[0];

    const evt = nav.startNavigation({
      fromLandmark: entrance,
      destinationQuery: 'washroom',
      venue: mockVenue,
      currentSteps: 0,
    });

    expect(nav.getState()).toBe('STEP_WALKING');
    expect(evt.stepIndex).toBe(0);
    expect(evt.currentStep?.steps).toBe(20);
    expect(evt.instruction).toContain('Walk straight about 20 steps');
  });

  it('handles route not found gracefully with fallbackToFind flag', () => {
    const nav = new VenueNavigator();
    const entrance = mockVenue.landmarks[0];

    const evt = nav.startNavigation({
      fromLandmark: entrance,
      destinationQuery: 'unknown laboratory',
      venue: mockVenue,
    });

    expect(nav.getState()).toBe('ROUTE_NOT_FOUND');
    expect(evt.fallbackToFind).toBe(true);
    expect(evt.instruction).toContain('I can scan for signs instead');
  });

  it('evaluates step-advance tolerance (+-25%) correctly', () => {
    const nav = new VenueNavigator();
    const entrance = mockVenue.landmarks[0];

    nav.startNavigation({
      fromLandmark: entrance,
      destinationQuery: 'washroom',
      venue: mockVenue,
      currentSteps: 100, // baseline
    });

    // Target is 20 steps. 75% threshold is 15 steps.
    // User walked 10 steps (total 110): not reached
    expect(nav.isStepTargetReached(110)).toBe(false);

    // User walked 15 steps (total 115): reached
    expect(nav.isStepTargetReached(115)).toBe(true);

    // User walked 20 steps (total 120): reached
    expect(nav.isStepTargetReached(120)).toBe(true);
  });

  it('advances through steps to checkpoint and completes arrival on verification', () => {
    const nav = new VenueNavigator();
    const entrance = mockVenue.landmarks[0];

    nav.startNavigation({
      fromLandmark: entrance,
      destinationQuery: 'washroom',
      venue: mockVenue,
      currentSteps: 0,
    });

    // Step 0 -> Step 1 (turn left)
    const evtStep1 = nav.advanceStep(20);
    expect(evtStep1.stepIndex).toBe(1);
    expect(nav.getState()).toBe('STEP_TURN');
    expect(evtStep1.currentStep?.turn).toBe('left');

    // Step 1 -> Step 2 (walk 10 steps to checkpoint)
    const evtStep2 = nav.advanceStep(20);
    expect(evtStep2.stepIndex).toBe(2);
    expect(nav.getState()).toBe('STEP_WALKING');

    // Step 2 has a checkpoint: advancing enters CHECKPOINT_VERIFYING
    const evtCheckpoint = nav.advanceStep(30);
    expect(nav.getState()).toBe('CHECKPOINT_VERIFYING');
    expect(evtCheckpoint.isCheckpoint).toBe(true);

    // If checkpoint fails verification
    const failEvt = nav.handleCheckpointResult(false);
    expect(failEvt.fallbackToFind).toBe(true);
    expect(failEvt.instruction).toContain("I can't confirm the sign yet");

    // Once checkpoint succeeds
    const successEvt = nav.handleCheckpointResult(true, 'Matched WC sign');
    expect(nav.getState()).toBe('ARRIVED');
    expect(successEvt.isArrived).toBe(true);
    expect(successEvt.instruction).toContain('You have arrived');
  });

  it('supports voice commands: where am I, repeat, stop', () => {
    const nav = new VenueNavigator();
    const entrance = mockVenue.landmarks[0];

    nav.startNavigation({
      fromLandmark: entrance,
      destinationQuery: 'washroom',
      venue: mockVenue,
      currentSteps: 0,
    });

    const status = nav.getStatusDescription(10);
    expect(status).toContain('Navigating to Washroom Ground Floor');
    expect(status).toContain('walked about 10 of 20 steps');

    const repeated = nav.repeatInstruction();
    expect(repeated).toBe('Walk straight about 20 steps.');

    const stopEvt = nav.stop();
    expect(nav.getState()).toBe('CANCELLED');
    expect(stopEvt.instruction).toBe('Navigation stopped.');
  });
});
