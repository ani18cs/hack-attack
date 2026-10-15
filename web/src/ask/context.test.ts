import { beforeEach, describe, expect, it } from 'vitest';
import { askContext } from './context';

describe('AskContextManager', () => {
  beforeEach(() => {
    askContext.clear();
  });

  it('keeps strictly at most 3 conversation turns in memory', () => {
    askContext.addTurn('user', 'turn 1');
    askContext.addTurn('assistant', 'turn 2');
    askContext.addTurn('user', 'turn 3');
    expect(askContext.getHistory()).toHaveLength(3);
    expect(askContext.getHistory()[0].text).toBe('turn 1');

    askContext.addTurn('assistant', 'turn 4');
    expect(askContext.getHistory()).toHaveLength(3);
    expect(askContext.getHistory()[0].text).toBe('turn 2');
    expect(askContext.getHistory()[1].text).toBe('turn 3');
    expect(askContext.getHistory()[2].text).toBe('turn 4');
  });

  it('tracks active and last tool transitions', () => {
    expect(askContext.getActiveTool()).toBeNull();

    askContext.setActiveTool('find_target');
    expect(askContext.getActiveTool()).toBe('find_target');

    askContext.setActiveTool('navigate_to');
    expect(askContext.getActiveTool()).toBe('navigate_to');
    const state = askContext.getState();
    expect(state.lastTool).toBe('find_target');
    expect(state.activeTool).toBe('navigate_to');
  });

  it('tracks last answer summary and venue state', () => {
    askContext.setLastAnswer('Chair on your right.');
    expect(askContext.getLastAnswer()).toBe('Chair on your right.');

    askContext.setVenue({
      id: 'amc-hackattack',
      currentLandmarkId: 'entrance',
      destinations: ['Washroom', 'Cafeteria'],
    });

    const state = askContext.getState(true);
    expect(state.online).toBe(true);
    expect(state.lastAnswerSummary).toBe('Chair on your right.');
    expect(state.venue?.destinations).toContain('Washroom');
  });
});
