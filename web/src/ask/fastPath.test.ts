import { describe, expect, it } from 'vitest';
import { matchFastPath } from './fastPath';

describe('matchFastPath', () => {
  it('returns null for empty or unrecognized phrases', () => {
    expect(matchFastPath('')).toBeNull();
    expect(matchFastPath('hello who are you')).toBeNull();
    expect(matchFastPath('what is the capital of France')).toBeNull();
  });

  it('matches SOS emergency keywords in English, Hindi, and Kannada', () => {
    expect(matchFastPath('sos')?.tool).toBe('trigger_sos');
    expect(matchFastPath('help me please')?.tool).toBe('trigger_sos');
    expect(matchFastPath('emergency')?.tool).toBe('trigger_sos');
    expect(matchFastPath('आपातकालीन')?.tool).toBe('trigger_sos');
    expect(matchFastPath('ತುರ್ತ್ತು')?.tool).toBe('trigger_sos');
  });

  it('matches stop and repeat controls', () => {
    expect(matchFastPath('stop')?.tool).toBe('stop_current');
    expect(matchFastPath('cancel')?.tool).toBe('stop_current');
    expect(matchFastPath('रुकें')?.tool).toBe('stop_current');
    expect(matchFastPath('ನಿಲ್ಲಿಸಿ')?.tool).toBe('stop_current');

    expect(matchFastPath('repeat')?.tool).toBe('repeat_last');
    expect(matchFastPath('say again')?.tool).toBe('repeat_last');
    expect(matchFastPath('again')?.tool).toBe('repeat_last');
  });

  it('matches where am i location status', () => {
    expect(matchFastPath('where am i')?.tool).toBe('where_am_i');
    expect(matchFastPath('my location')?.tool).toBe('where_am_i');
  });

  it('extracts find targets correctly', () => {
    const res = matchFastPath('find the washroom');
    expect(res?.tool).toBe('find_target');
    expect(res?.args.target).toBe('washroom');

    const chairRes = matchFastPath('find chair');
    expect(chairRes?.tool).toBe('find_target');
    expect(chairRes?.args.target).toBe('chair');

    const knRes = matchFastPath('ಹುಡುಕಿ bottle');
    expect(knRes?.tool).toBe('find_target');
    expect(knRes?.args.target).toBe('bottle');
  });

  it('matches navigate to valid destinations from venue pack', () => {
    const state = {
      activeTool: null,
      online: true,
      venue: { destinations: ['Washroom', 'Cafeteria', 'Entrance'] },
    };

    const navRes = matchFastPath('navigate to washroom', state);
    expect(navRes?.tool).toBe('navigate_to');
    expect(navRes?.args.destination).toBe('Washroom');

    // Destination not in venue pack falls back to find_target
    const unknownRes = matchFastPath('navigate to library', state);
    expect(unknownRes?.tool).toBe('find_target');
    expect(unknownRes?.args.target).toBe('library');
  });

  it('matches keyword intents from existing i18n table', () => {
    expect(matchFastPath('around me')?.tool).toBe('describe_scene');
    expect(matchFastPath('read text')?.tool).toBe('read_text');
    expect(matchFastPath('currency')?.tool).toBe('identify_currency');
    expect(matchFastPath('waste')?.tool).toBe('sort_waste');
    expect(matchFastPath('label')?.tool).toBe('read_label');
    expect(matchFastPath('hazard')?.tool).toBe('scan_hazards');
    expect(matchFastPath('help')?.tool).toBe('help');
    expect(matchFastPath('quiet mode')?.tool).toBe('set_verbosity');
    expect(matchFastPath('hindi')?.tool).toBe('set_language');
    expect(matchFastPath('kannada')?.tool).toBe('set_language');
    expect(matchFastPath('english')?.tool).toBe('set_language');
  });
});
