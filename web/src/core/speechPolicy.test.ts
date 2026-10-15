import { describe, it, expect, beforeEach } from 'vitest';
import { SpeechPolicy } from './speechPolicy';

describe('SpeechPolicy', () => {
  let policy: SpeechPolicy;

  beforeEach(() => {
    policy = new SpeechPolicy();
  });

  describe('Non-urgent minimum gap (5000ms)', () => {
    it('suppresses different non-urgent messages within 5000ms gap', () => {
      const now = 100000;
      const msg1 = { text: 'Clear forward.', timestamp: now };
      const msg2 = { text: 'Door ahead.', timestamp: now + 2000 };
      const msg3 = { text: 'Door ahead.', timestamp: now + 5100 };

      expect(policy.canSpeak(msg1, 'normal')).toBe(true);
      policy.recordSpoken(msg1, now);

      // Within 5000ms gap -> suppressed
      expect(policy.canSpeak(msg2, 'normal')).toBe(false);

      // After 5000ms gap -> allowed
      expect(policy.canSpeak(msg3, 'normal')).toBe(true);
    });
  });

  describe('Same message cooldown (12000ms)', () => {
    it('suppresses identical message within 12000ms cooldown even if gap passes', () => {
      const now = 100000;
      const msg = { text: 'Turn right.', timestamp: now };
      const repeatMsg = { text: 'Turn right.', timestamp: now + 6000 }; // past gap, before 12s cooldown
      const expiredMsg = { text: 'Turn right.', timestamp: now + 12100 }; // past 12s cooldown

      expect(policy.canSpeak(msg, 'normal')).toBe(true);
      policy.recordSpoken(msg, now);

      // Past 5s gap but within 12s cooldown -> suppressed
      expect(policy.canSpeak(repeatMsg, 'normal')).toBe(false);

      // Past 12s cooldown -> allowed
      expect(policy.canSpeak(expiredMsg, 'normal')).toBe(true);
    });
  });

  describe('STOP and Danger exemption & deduplication (2s)', () => {
    it('allows STOP and danger immediately even if non-urgent message was just spoken', () => {
      const now = 100000;
      const normalMsg = { text: 'Walking forward.', timestamp: now };
      policy.recordSpoken(normalMsg, now);

      const dangerMsg = {
        text: 'Stop. Chair ahead.',
        priority: 'danger' as const,
        timestamp: now + 500,
      };
      // Exempt from 5000ms gap
      expect(policy.canSpeak(dangerMsg, 'normal')).toBe(true);
    });

    it('deduplicates STOP and danger within 2000ms', () => {
      const now = 100000;
      const danger1 = {
        text: 'Stop. Table ahead.',
        priority: 'danger' as const,
        timestamp: now,
      };
      const danger2 = {
        text: 'Stop. Table ahead.',
        priority: 'danger' as const,
        timestamp: now + 1500,
      };
      const danger3 = {
        text: 'Stop. Table ahead.',
        priority: 'danger' as const,
        timestamp: now + 2100,
      };

      expect(policy.canSpeak(danger1, 'normal')).toBe(true);
      policy.recordSpoken(danger1, now);

      // Deduplicated within 2000ms
      expect(policy.canSpeak(danger2, 'normal')).toBe(false);

      // Allowed after 2000ms
      expect(policy.canSpeak(danger3, 'normal')).toBe(true);
    });
  });

  describe('User listening and tool answering guards', () => {
    it('never speaks non-urgent messages while user is listening', () => {
      policy.setUserListening(true);

      const normalMsg = { text: 'Door ahead.', priority: 'normal' as const };
      expect(policy.canSpeak(normalMsg, 'normal')).toBe(false);

      // Danger can still interrupt for safety
      const dangerMsg = { text: 'Stop. Hazard ahead.', priority: 'danger' as const };
      expect(policy.canSpeak(dangerMsg, 'normal')).toBe(true);
    });

    it('never talks over active tool answer unless it is the tool answer itself', () => {
      policy.setToolAnswering(true);

      const announcement = { text: 'Chair ahead.', category: 'announcement' as const };
      expect(policy.canSpeak(announcement, 'normal')).toBe(false);

      const toolAnswer = { text: 'Five hundred rupee note.', category: 'tool_answer' as const };
      expect(policy.canSpeak(toolAnswer, 'normal')).toBe(true);
    });
  });

  describe('Verbosity filtering', () => {
    it('quiet verbosity allows only danger and STOP', () => {
      const normalMsg = { text: 'Door ahead.', priority: 'normal' as const };
      expect(policy.canSpeak(normalMsg, 'quiet')).toBe(false);

      const dangerMsg = { text: 'Stop. Stairs ahead.', priority: 'danger' as const };
      expect(policy.canSpeak(dangerMsg, 'quiet')).toBe(true);
    });

    it('normal verbosity allows transitions and suppresses continuous unprompted announcements', () => {
      const transitionMsg = {
        text: 'Clear. Continue.',
        category: 'guidance' as const,
        isTransition: true,
      };
      expect(policy.canSpeak(transitionMsg, 'normal')).toBe(true);

      const continuousObj = {
        text: 'Chair about 3 strides ahead.',
        category: 'announcement' as const,
        isTransition: false,
      };
      expect(policy.canSpeak(continuousObj, 'normal')).toBe(false);
    });

    it('detailed verbosity allows object announcements', () => {
      const continuousObj = {
        text: 'Chair about 3 strides ahead.',
        category: 'announcement' as const,
        isTransition: false,
      };
      expect(policy.canSpeak(continuousObj, 'detailed')).toBe(true);
    });
  });
});
