import type { AskHistoryItem, AskState, VenueState } from './types';

class AskContextManager {
  private history: AskHistoryItem[] = [];
  private activeTool: string | null = null;
  private lastTool?: string;
  private lastAnswerSummary?: string;
  private venue?: VenueState;

  /**
   * Adds a conversational turn (text only, kept in memory only, max 3 turns).
   */
  public addTurn(role: 'user' | 'assistant', text: string): void {
    const cleanText = text.trim();
    if (!cleanText) return;

    this.history.push({ role, text: cleanText });

    // Strictly limit in-memory conversation history to the last 3 turns
    if (this.history.length > 3) {
      this.history = this.history.slice(-3);
    }
  }

  public getHistory(): AskHistoryItem[] {
    return [...this.history];
  }

  public setActiveTool(toolName: string | null): void {
    if (this.activeTool && this.activeTool !== toolName) {
      this.lastTool = this.activeTool;
    }
    this.activeTool = toolName;
  }

  public getActiveTool(): string | null {
    return this.activeTool;
  }

  public setLastAnswer(summary: string): void {
    this.lastAnswerSummary = summary;
  }

  public getLastAnswer(): string | undefined {
    return this.lastAnswerSummary;
  }

  public setVenue(venue: VenueState): void {
    this.venue = venue;
  }

  public getVenue(): VenueState | undefined {
    return this.venue;
  }

  public getState(online = true): AskState {
    return {
      activeTool: this.activeTool,
      online,
      lastTool: this.lastTool,
      lastAnswerSummary: this.lastAnswerSummary,
      venue: this.venue,
    };
  }

  public clear(): void {
    this.history = [];
    this.activeTool = null;
    this.lastTool = undefined;
    this.lastAnswerSummary = undefined;
  }
}

export const askContext = new AskContextManager();
