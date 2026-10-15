import { KEYWORD_INTENTS } from '../core/i18n';
import type { AskState, ToolCall } from './types';

/**
 * Fast local phrase matcher for common blind user voice commands.
 * Runs in 0ms with zero network calls. Supports English, Hindi, and Kannada.
 */
export function matchFastPath(rawTranscript: string, state?: AskState): ToolCall | null {
  if (!rawTranscript) return null;
  const transcript = rawTranscript.trim().toLowerCase();

  // 1. Direct emergency override
  if (
    transcript === 'sos' ||
    transcript.includes('emergency') ||
    transcript.includes('help me') ||
    transcript.includes('ತುರ್ತು') ||
    transcript.includes('ತುರ್ತ್ತು') ||
    transcript.includes('आपातकालीन')
  ) {
    return {
      tool: 'trigger_sos',
      args: {},
      speechPrefix: 'SOS',
      confidence: 1.0,
      source: 'local',
    };
  }

  // 2. Direct stop & repeat controls
  if (
    transcript === 'stop' ||
    transcript === 'quiet' ||
    transcript === 'cancel' ||
    transcript === 'pause' ||
    transcript === 'रुकें' ||
    transcript === 'ನಿಲ್ಲಿಸಿ'
  ) {
    return {
      tool: 'stop_current',
      args: {},
      confidence: 1.0,
      source: 'local',
    };
  }

  if (
    transcript === 'repeat' ||
    transcript === 'say again' ||
    transcript === 'again' ||
    transcript === 'what was that'
  ) {
    return {
      tool: 'repeat_last',
      args: {},
      confidence: 1.0,
      source: 'local',
    };
  }

  // 3. Units and height settings
  if (transcript === 'use metres' || transcript === 'use meters') {
    return {
      tool: 'set_units',
      args: { preference: 'metres' },
      confidence: 1.0,
      source: 'local',
    };
  }

  if (transcript === 'use strides') {
    return {
      tool: 'set_units',
      args: { preference: 'strides' },
      confidence: 1.0,
      source: 'local',
    };
  }

  if (
    transcript === 'calibrate my stride' ||
    transcript === 'calibrate stride' ||
    transcript.includes('calibrate stride')
  ) {
    return {
      tool: 'calibrate_stride',
      args: {},
      confidence: 1.0,
      source: 'local',
    };
  }

  const heightMatch = transcript.match(/(?:set\s+(?:my\s+)?height\s+(?:to\s+)?|height\s+is\s+)(\d{2,3})(?:\s*cm)?/i);
  if (heightMatch && heightMatch[1]) {
    const heightCm = parseInt(heightMatch[1], 10);
    if (heightCm >= 90 && heightCm <= 240) {
      return {
        tool: 'set_height',
        args: { heightCm },
        confidence: 1.0,
        source: 'local',
      };
    }
  }

  // 3. Where am I / location status
  if (
    transcript.includes('where am i') ||
    transcript.includes('my location') ||
    transcript.includes('current landmark') ||
    transcript.includes('current status')
  ) {
    return {
      tool: 'where_am_i',
      args: {},
      confidence: 1.0,
      source: 'local',
    };
  }

  // 4. Target finding ("find {target}", "where is {target}")
  const findMatch = transcript.match(/^(?:find|where is|ಹುಡುಕಿ|ढूंढो)\s+(?:the\s+|my\s+|a\s+)?([a-z0-9\s]+)$/i);
  if (findMatch && findMatch[1]) {
    const target = findMatch[1].trim();
    return {
      tool: 'find_target',
      args: { target },
      confidence: 0.95,
      source: 'local',
    };
  }

  // 5. Venue navigation ("navigate to {destination}", "take me to {destination}")
  const navMatch = transcript.match(/^(?:navigate to|take me to|go to)\s+(?:the\s+)?([a-z0-9\s]+)$/i);
  if (navMatch && navMatch[1]) {
    const rawDest = navMatch[1].trim();
    const destinations = state?.venue?.destinations || [];
    const matchedDest = destinations.find((d) => d.toLowerCase() === rawDest.toLowerCase());

    if (matchedDest) {
      return {
        tool: 'navigate_to',
        args: { destination: matchedDest },
        confidence: 0.95,
        source: 'local',
      };
    }
    // Fall back to find_target if destination not in venue pack
    return {
      tool: 'find_target',
      args: { target: rawDest },
      confidence: 0.85,
      source: 'local',
    };
  }

  // 6. Check existing KEYWORD_INTENTS table for exact or strong containment matches
  // Sort longer phrases first so "quiet mode" takes precedence over "quiet"
  const sortedIntents = Object.entries(KEYWORD_INTENTS).sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, intent] of sortedIntents) {
    if (transcript === phrase || transcript.startsWith(`${phrase} `) || transcript.endsWith(` ${phrase}`)) {
      switch (intent) {
        case 'AROUND_ME':
          return { tool: 'describe_scene', args: {}, confidence: 0.95, source: 'local' };
        case 'READ':
          return { tool: 'read_text', args: {}, confidence: 0.95, source: 'local' };
        case 'FIND':
          return { tool: 'find_target', args: { target: 'washroom' }, confidence: 0.9, source: 'local' };
        case 'CURRENCY':
          return { tool: 'identify_currency', args: {}, confidence: 0.95, source: 'local' };
        case 'WASTE':
          return { tool: 'sort_waste', args: {}, confidence: 0.95, source: 'local' };
        case 'LABEL':
          return { tool: 'read_label', args: {}, confidence: 0.95, source: 'local' };
        case 'HAZARD':
          return { tool: 'scan_hazards', args: { enabled: true }, confidence: 0.95, source: 'local' };
        case 'NAVIGATE':
          return { tool: 'navigate_to', args: { destination: state?.venue?.destinations?.[0] || 'Washroom' }, confidence: 0.9, source: 'local' };
        case 'SOS':
          return { tool: 'trigger_sos', args: {}, speechPrefix: 'SOS', confidence: 1.0, source: 'local' };
        case 'STOP':
        case 'OBSTACLE_OFF':
          return { tool: 'stop_current', args: {}, confidence: 1.0, source: 'local' };
        case 'REPEAT':
          return { tool: 'repeat_last', args: {}, confidence: 1.0, source: 'local' };
        case 'HELP':
          return { tool: 'help', args: {}, confidence: 1.0, source: 'local' };
        case 'VERBOSITY_QUIET':
          return { tool: 'set_verbosity', args: { level: 'quiet' }, confidence: 1.0, source: 'local' };
        case 'VERBOSITY_NORMAL':
          return { tool: 'set_verbosity', args: { level: 'normal' }, confidence: 1.0, source: 'local' };
        case 'VERBOSITY_DETAILED':
          return { tool: 'set_verbosity', args: { level: 'detailed' }, confidence: 1.0, source: 'local' };
        case 'LANGUAGE_EN':
          return { tool: 'set_language', args: { lang: 'en' }, confidence: 1.0, source: 'local' };
        case 'LANGUAGE_HI':
          return { tool: 'set_language', args: { lang: 'hi' }, confidence: 1.0, source: 'local' };
        case 'LANGUAGE_KN':
          return { tool: 'set_language', args: { lang: 'kn' }, confidence: 1.0, source: 'local' };
      }
    }
  }

  // No confident local fast-path match -> pass to Gemini text-only router
  return null;
}
