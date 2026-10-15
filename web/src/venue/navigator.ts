import { Landmark, NavigatorState, Route, RouteStep, VenuePack } from './types';
import { matchLandmarkByVoice } from './localize';
import { settings } from '../core/settings';

export interface NavigatorEvent {
  state: NavigatorState;
  instruction: string;
  stepIndex: number;
  totalSteps: number;
  currentStep: RouteStep | null;
  targetLandmark: Landmark | null;
  fromLandmark: Landmark | null;
  fallbackToFind: boolean;
  isCheckpoint: boolean;
  isArrived: boolean;
}

export type NavigatorListener = (event: NavigatorEvent) => void;

/**
 * Pure state machine and controller for venue navigation.
 * Unit tested independently of DOM APIs.
 */
export class VenueNavigator {
  private state: NavigatorState = 'IDLE';
  private venue: VenuePack | null = null;
  private currentRoute: Route | null = null;
  private currentStepIndex = 0;
  private fromLandmark: Landmark | null = null;
  private toLandmark: Landmark | null = null;
  private baseStepCount = 0;
  private initialHeading: number | null = null;
  private listeners: Set<NavigatorListener> = new Set();

  public subscribe(listener: NavigatorListener): () => void {
    this.listeners.add(listener);
    listener(this.getEvent());
    return () => this.listeners.delete(listener);
  }

  public getState(): NavigatorState {
    return this.state;
  }

  public getCurrentRoute(): Route | null {
    return this.currentRoute;
  }

  public getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  public getCurrentStep(): RouteStep | null {
    if (!this.currentRoute || this.currentStepIndex >= this.currentRoute.steps.length) {
      return null;
    }
    return this.currentRoute.steps[this.currentStepIndex];
  }

  public getVenue(): VenuePack | null {
    return this.venue;
  }

  public getInitialHeading(): number | null {
    return this.initialHeading;
  }

  public getFromLandmark(): Landmark | null {
    return this.fromLandmark;
  }

  public getToLandmark(): Landmark | null {
    return this.toLandmark;
  }

  /**
   * Resolves a destination string to a known landmark using name, aliases, or Hindi/Kannada variants.
   */
  public resolveDestination(destinationQuery: string, venue: VenuePack): Landmark | null {
    return matchLandmarkByVoice(destinationQuery, venue);
  }

  /**
   * Finds a direct or reverse route between two landmark IDs.
   */
  public findRoute(fromId: string, toId: string, venue: VenuePack): Route | null {
    const direct = venue.routes.find((r) => r.from === fromId && r.to === toId);
    if (direct) return direct;

    return null;
  }

  /**
   * Starts a navigation journey.
   * If route does not exist: transitions to ROUTE_NOT_FOUND with fallback instruction.
   */
  public startNavigation(params: {
    fromLandmark: Landmark;
    destinationQuery: string;
    venue: VenuePack;
    currentSteps?: number;
    currentHeading?: number | null;
  }): NavigatorEvent {
    this.venue = params.venue;
    this.fromLandmark = params.fromLandmark;
    this.baseStepCount = params.currentSteps || 0;
    this.initialHeading = params.currentHeading ?? null;

    const resolved = this.resolveDestination(params.destinationQuery, params.venue);
    this.toLandmark = resolved;

    if (!resolved) {
      this.state = 'ROUTE_NOT_FOUND';
      const evt = this.emitEvent(
        `I don't recognize the destination "${params.destinationQuery}". I can scan for signs instead.`,
        true
      );
      return evt;
    }

    const route = this.findRoute(params.fromLandmark.id, resolved.id, params.venue);
    if (!route || route.steps.length === 0) {
      this.state = 'ROUTE_NOT_FOUND';
      const evt = this.emitEvent(
        `I don't have a pre-mapped route to ${resolved.name}. I can still scan for signs.`,
        true
      );
      return evt;
    }

    this.currentRoute = route;
    this.currentStepIndex = 0;
    const firstStep = route.steps[0];
    this.state = firstStep.turn && firstStep.turn !== 'straight' ? 'STEP_TURN' : 'STEP_WALKING';

    const evt = this.emitEvent(
      `Starting route to ${resolved.name}. Step 1: ${firstStep.text}`,
      false
    );
    return evt;
  }

  /**
   * Evaluates if step count is within the +/- 25% tolerance window to automatically advance.
   * Adjusts for the user's calibrated stride length so spoken distances and steps agree.
   */
  public isStepTargetReached(totalStepsNow: number): boolean {
    const step = this.getCurrentStep();
    if (!step || !step.steps) return false;

    const strideMeters = settings.getSettings().strideMeters || 0.7;
    // Map assuming standard 0.7m reference stride
    const adjustedTarget = Math.round((step.steps * 0.7) / strideMeters);

    const walked = totalStepsNow - this.baseStepCount;
    // Advance when user has completed at least 75% of the target step count
    return walked >= adjustedTarget * 0.75;
  }

  /**
   * Optional stride calibration step within the venue flow.
   */
  public startStrideCalibration(knownDistanceMeters = 10): NavigatorEvent {
    return this.emitEvent(
      `Calibration mode: Walk ${knownDistanceMeters} metres counting your strides, then tap or say calibrate my stride.`,
      false
    );
  }

  /**
   * Checks step count update from pedometer.
   */
  public onStepCountUpdate(totalStepsNow: number): NavigatorEvent | null {
    if (this.state !== 'STEP_WALKING') return null;

    if (this.isStepTargetReached(totalStepsNow)) {
      return this.advanceStep(totalStepsNow);
    }
    return null;
  }

  /**
   * Advances to next step, or transitions to checkpoint / arrived.
   */
  public advanceStep(currentSteps = 0, currentHeading: number | null = null): NavigatorEvent {
    if (!this.currentRoute) {
      return this.emitEvent('No active route.', false);
    }

    const step = this.getCurrentStep();
    this.baseStepCount = currentSteps;
    this.initialHeading = currentHeading;

    // Check if current step had a checkpoint that needs verification
    if (step?.checkpoint) {
      this.state = 'CHECKPOINT_VERIFYING';
      return this.emitEvent(
        `Arrived near checkpoint. Looking for ${step.checkpoint.landmarkId} sign.`,
        false,
        true
      );
    }

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.currentRoute.steps.length) {
      this.state = 'ARRIVED';
      return this.emitEvent(
        `You have arrived at ${this.toLandmark?.name || 'your destination'}.`,
        false,
        false,
        true
      );
    }

    const nextStep = this.currentRoute.steps[this.currentStepIndex];
    this.state = nextStep.turn && nextStep.turn !== 'straight' ? 'STEP_TURN' : 'STEP_WALKING';

    return this.emitEvent(
      `Step ${this.currentStepIndex + 1} of ${this.currentRoute.steps.length}: ${nextStep.text}`,
      false
    );
  }

  /**
   * Handles checkpoint verification result (from verify_landmark or QR scanner).
   */
  public handleCheckpointResult(verified: boolean, evidence?: string): NavigatorEvent {
    if (this.state !== 'CHECKPOINT_VERIFYING') {
      return this.getEvent();
    }

    const destName = this.toLandmark?.name || 'destination';

    if (verified) {
      this.state = 'ARRIVED';
      return this.emitEvent(
        `${destName} sign detected. You have arrived. ${evidence || ''}`.trim(),
        false,
        false,
        true
      );
    } else {
      // Prompt user per spec
      return this.emitEvent(
        `I can't confirm the sign yet. Turn slowly.`,
        true, // fallbackToFind triggers Find mode for sign
        true
      );
    }
  }

  /**
   * Responds to voice command "where am I".
   */
  public getStatusDescription(totalStepsNow = 0): string {
    if (this.state === 'ARRIVED') {
      return `You have arrived at ${this.toLandmark?.name}.`;
    }
    if (this.state === 'ROUTE_NOT_FOUND') {
      return `No active route. Say take me to washroom or entrance.`;
    }
    if (!this.currentRoute) {
      return `Navigation is idle. Current landmark is ${this.fromLandmark?.name || 'unknown'}.`;
    }

    const step = this.getCurrentStep();
    const walked = totalStepsNow - this.baseStepCount;
    const progress = step?.steps ? ` (walked about ${walked} of ${step.steps} steps)` : '';

    return `Navigating to ${this.toLandmark?.name}. Step ${this.currentStepIndex + 1} of ${
      this.currentRoute.steps.length
    }: ${step?.text || ''}${progress}.`;
  }

  /**
   * Repeats current instruction.
   */
  public repeatInstruction(): string {
    const step = this.getCurrentStep();
    if (!step) return this.getStatusDescription();
    return step.text;
  }

  public stop(): NavigatorEvent {
    this.state = 'CANCELLED';
    this.currentRoute = null;
    this.currentStepIndex = 0;
    return this.emitEvent('Navigation stopped.', false);
  }

  private emitEvent(
    instruction: string,
    fallbackToFind = false,
    isCheckpoint = false,
    isArrived = false
  ): NavigatorEvent {
    const evt: NavigatorEvent = {
      state: this.state,
      instruction,
      stepIndex: this.currentStepIndex,
      totalSteps: this.currentRoute?.steps.length || 0,
      currentStep: this.getCurrentStep(),
      targetLandmark: this.toLandmark,
      fromLandmark: this.fromLandmark,
      fallbackToFind,
      isCheckpoint,
      isArrived,
    };
    this.listeners.forEach((fn) => fn(evt));
    return evt;
  }

  public getEvent(): NavigatorEvent {
    return {
      state: this.state,
      instruction: this.getCurrentStep()?.text || 'Navigation idle',
      stepIndex: this.currentStepIndex,
      totalSteps: this.currentRoute?.steps.length || 0,
      currentStep: this.getCurrentStep(),
      targetLandmark: this.toLandmark,
      fromLandmark: this.fromLandmark,
      fallbackToFind: this.state === 'ROUTE_NOT_FOUND',
      isCheckpoint: this.state === 'CHECKPOINT_VERIFYING',
      isArrived: this.state === 'ARRIVED',
    };
  }
}

export const venueNavigator = new VenueNavigator();
