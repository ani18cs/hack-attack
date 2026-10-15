export const ROUTER_SYSTEM_INSTRUCTION =
  'You route spoken requests from a blind user to exactly one tool. Pick the single best tool. Prefer specific tools over answer_about_view. If the request is unclear, call clarify with one short question. Never call trigger_sos unless the user clearly asks for help or emergency. Never invent destinations: navigate_to must use a name from state.venue.destinations, otherwise use find_target. Understand English, Hindi, Kannada and mixed speech. Keep any speechPrefix under 6 words.';

export const ALLOWED_TOOLS = [
  'describe_scene',
  'read_text',
  'find_target',
  'identify_currency',
  'sort_waste',
  'read_label',
  'scan_hazards',
  'navigate_to',
  'where_am_i',
  'answer_about_view',
  'stop_current',
  'repeat_last',
  'set_verbosity',
  'set_language',
  'trigger_sos',
  'help',
  'clarify',
] as const;

export type RouterTool = (typeof ALLOWED_TOOLS)[number];

export const ROUTER_FUNCTION_DECLARATIONS = [
  {
    name: 'describe_scene',
    description: "Describe what's in front of the user (objects, surroundings, layout).",
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'read_text',
    description: 'Read signs, labels, room numbers, doors, or text in view, including directional arrows.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'find_target',
    description: 'Find washroom, exit, door, chair, bottle, desk, person, or any object with spatial guidance and audio beacon.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: {
          type: 'STRING',
          description: 'The specific object or room to locate (e.g. washroom, chair, bottle, exit).',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'identify_currency',
    description: 'Identify the denomination of Indian banknotes in view (10, 20, 50, 100, 200, 500, 2000 INR).',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'sort_waste',
    description: 'Determine which waste bin (wet, dry, recyclable, hazardous, e-waste) to dispose the item in view.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'read_label',
    description: 'Read packaged product, medicine, or grocery labels. Refuses to guess illegible text.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'scan_hazards',
    description: 'Start or stop periodic scanning for drop-offs, stairs, potholes, or floor hazards.',
    parameters: {
      type: 'OBJECT',
      properties: {
        enabled: {
          type: 'BOOLEAN',
          description: 'True to start periodic hazard scan, false to stop.',
        },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'navigate_to',
    description: 'Start turn-by-turn indoor venue navigation. Must use an exact destination from state.venue.destinations.',
    parameters: {
      type: 'OBJECT',
      properties: {
        destination: {
          type: 'STRING',
          description: 'Exact destination name from the venue destinations list.',
        },
      },
      required: ['destination'],
    },
  },
  {
    name: 'where_am_i',
    description: 'Announce current landmark, indoor checkpoint, or navigation route status.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'answer_about_view',
    description: 'Answer a free-form question that requires inspecting the current camera view (e.g. "what colour is my shirt?", "is this door open?").',
    parameters: {
      type: 'OBJECT',
      properties: {
        question: {
          type: 'STRING',
          description: 'The question to answer about the camera frame.',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'stop_current',
    description: 'Stop the active long-running tool (find beacon, navigate, hazard scan, or continuous scan).',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'repeat_last',
    description: 'Repeat the last spoken message or answer.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'set_verbosity',
    description: 'Adjust speech verbosity level.',
    parameters: {
      type: 'OBJECT',
      properties: {
        level: {
          type: 'STRING',
          enum: ['quiet', 'normal', 'detailed'],
          description: 'The desired verbosity level.',
        },
      },
      required: ['level'],
    },
  },
  {
    name: 'set_language',
    description: 'Set voice and output language.',
    parameters: {
      type: 'OBJECT',
      properties: {
        lang: {
          type: 'STRING',
          enum: ['en', 'hi', 'kn'],
          description: 'Language code (en: English, hi: Hindi, kn: Kannada).',
        },
      },
      required: ['lang'],
    },
  },
  {
    name: 'trigger_sos',
    description: 'Initiate the emergency SOS confirmation sequence (never dispatches without explicit user confirmation).',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'help',
    description: 'Explain available commands and how to interact with SightLine.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'clarify',
    description: 'Ask the blind user ONE short, conversational clarifying question when their request is ambiguous.',
    parameters: {
      type: 'OBJECT',
      properties: {
        question: {
          type: 'STRING',
          description: 'A short clarifying question under 15 words.',
        },
      },
      required: ['question'],
    },
  },
];
