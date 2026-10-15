import type { VisionTask } from '../types.js';

export interface MockFixture {
  ok: boolean;
  summary: string;
  confidence: number;
  data: any;
  hazards?: Array<{
    type: string;
    direction: 'left' | 'slightly-left' | 'ahead' | 'slightly-right' | 'right' | 'unknown';
    urgency: 'low' | 'medium' | 'high';
  }>;
}

export const MOCK_FIXTURES: Record<VisionTask, MockFixture> = {
  describe: {
    ok: true,
    summary: 'A table straight ahead, two chairs to your right, a door on the left.',
    confidence: 0.95,
    data: {
      items: [
        { label: 'table', direction: 'ahead', distance: 'close' },
        { label: 'chair', direction: 'slightly-right', distance: 'close' },
        { label: 'chair', direction: 'right', distance: 'near' },
        { label: 'door', direction: 'left', distance: 'near' },
      ],
    },
    hazards: [],
  },

  read: {
    ok: true,
    summary: 'Exit sign ahead, arrow points right.',
    confidence: 0.98,
    data: {
      texts: [
        {
          text: 'Emergency Exit',
          kind: 'exit',
          direction: 'ahead',
          arrow: 'right',
        },
      ],
    },
    hazards: [],
  },

  find: {
    ok: true,
    summary: 'Restroom sign slightly left, four steps ahead.',
    confidence: 0.92,
    data: {
      found: true,
      direction: 'slightly-left',
      distance: 'close',
      gender: 'unisex',
      cue: 'Restroom sign on the left wall, turn slightly left.',
    },
    hazards: [],
  },

  currency: {
    ok: true,
    summary: 'Five hundred rupee note.',
    confidence: 0.96,
    data: {
      denomination: 500,
    },
    hazards: [],
  },

  waste: {
    ok: true,
    summary: 'Plastic water bottle. Put in blue recycling bin.',
    confidence: 0.94,
    data: {
      item: 'Plastic water bottle',
      category: 'recyclable',
      binHint: 'Blue recycling bin',
    },
    hazards: [],
  },

  label: {
    ok: true,
    summary: 'Whole milk. Expires October 20th. Contains milk.',
    confidence: 0.91,
    data: {
      product: 'Whole Milk',
      expiry: '2026-10-20',
      allergens: ['Milk', 'Lactose'],
      legible: true,
    },
    hazards: [],
  },

  hazard: {
    ok: true,
    summary: 'Caution: downward stairs directly ahead.',
    confidence: 0.95,
    data: {
      hazards: [
        {
          type: 'Downward stairs',
          direction: 'ahead',
          urgency: 'high',
        },
      ],
    },
    hazards: [
      {
        type: 'Downward stairs',
        direction: 'ahead',
        urgency: 'high',
      },
    ],
  },

  verify_landmark: {
    ok: true,
    summary: 'Reception counter confirmed straight ahead.',
    confidence: 0.89,
    data: {
      matches: true,
      evidence: 'Reception desk with blue sign visible ahead.',
    },
    hazards: [],
  },

  sos_context: {
    ok: true,
    summary: 'Third floor corridor near room 302, dimly lit hallway.',
    confidence: 0.9,
    data: {
      description: 'Third floor office corridor near room 302, dim lighting, no people nearby.',
    },
    hazards: [],
  },
};
