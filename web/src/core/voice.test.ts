import { describe, expect, it } from 'vitest';
import { voice } from './voice';

describe('Voice Intent Router & Target Extraction', () => {
  it('extracts target for FIND commands', () => {
    const res1 = voice.routeIntent('find my bottle');
    expect(res1.intent).toBe('FIND');
    expect(res1.target).toBe('bottle');

    const res2 = voice.routeIntent('where is the washroom');
    expect(res2.intent).toBe('FIND');
    expect(res2.target).toBe('washroom');

    const res3 = voice.routeIntent('find chair');
    expect(res3.intent).toBe('FIND');
    expect(res3.target).toBe('chair');
  });

  it('extracts target for NAVIGATE commands', () => {
    const res = voice.routeIntent('take me to entrance');
    expect(res.intent).toBe('NAVIGATE');
    expect(res.target).toBe('entrance');
  });

  it('routes Part 1 and Part 2 utility tasks', () => {
    expect(voice.routeIntent('read this sign').intent).toBe('READ');
    expect(voice.routeIntent('what is around me').intent).toBe('AROUND_ME');
    expect(voice.routeIntent('count currency').intent).toBe('CURRENCY');
    expect(voice.routeIntent('which dustbin for this waste').intent).toBe('WASTE');
    expect(voice.routeIntent('read product label').intent).toBe('LABEL');
    expect(voice.routeIntent('check for floor hazard').intent).toBe('HAZARD');
    expect(voice.routeIntent('emergency sos').intent).toBe('SOS');
  });

  it('handles verbosity and language changes', () => {
    expect(voice.routeIntent('quiet mode').intent).toBe('VERBOSITY_QUIET');
    expect(voice.routeIntent('detailed mode').intent).toBe('VERBOSITY_DETAILED');
    expect(voice.routeIntent('speak hindi').intent).toBe('LANGUAGE_HI');
    expect(voice.routeIntent('speak kannada').intent).toBe('LANGUAGE_KN');
    expect(voice.routeIntent('speak english').intent).toBe('LANGUAGE_EN');
  });

  it('returns UNKNOWN for random noise', () => {
    expect(voice.routeIntent('gibberish babble 12345').intent).toBe('UNKNOWN');
  });
});
