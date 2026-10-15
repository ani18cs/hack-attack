export type SupportedLocale = 'en-IN' | 'hi-IN' | 'kn-IN';

export interface PhraseTable {
  welcome: string;
  commandHelp: string;
  looking: string;
  dangerAhead: (label: string) => string;
  stopped: string;
  unknownCommand: string;
  offlineNotice: string;
  washroomScanning: string;
  washroomNotFound: string;
  currencyScanning: string;
  wasteScanning: string;
  labelScanning: string;
  hazardScanning: string;
  sosAlert: string;
  notBuiltYet: string;
}

export const PHRASES: Record<SupportedLocale, PhraseTable> = {
  'en-IN': {
    welcome: 'Welcome to SightLine. Your eyes-free sensory assistant is active.',
    commandHelp: 'Available commands: Around me, Read, Find, Currency, Waste, Label, Hazard, Navigate, or Stop.',
    looking: 'Looking...',
    dangerAhead: (label: string) => `Stop. ${label} ahead.`,
    stopped: 'Stopped.',
    unknownCommand: 'Say help for options.',
    offlineNotice: 'Offline mode, may be less accurate.',
    washroomScanning: 'Scanning for washroom. Slowly turn around.',
    washroomNotFound: 'Not found yet. Try turning more, or move forward and say find washroom again.',
    currencyScanning: 'Hold banknote in front of camera.',
    wasteScanning: 'Hold item in front of camera for bin sorting.',
    labelScanning: 'Point camera at product label or packaging.',
    hazardScanning: 'Scanning floor and pathway for ground hazards.',
    sosAlert: 'Emergency SOS activated. Announcing location and surroundings.',
    notBuiltYet: 'This mode is not built yet.',
  },
  'hi-IN': {
    welcome: 'साइटलाइन में आपका स्वागत है। आपका सहायक सक्रिय है।',
    commandHelp: 'उपलब्ध आदेश: आसपास, पढ़ें, खोजें, नोट पहचानें, कचरा सॉर्ट, लेबल, या रुकें।',
    looking: 'देख रहे हैं...',
    dangerAhead: (label: string) => `रुकें। आगे ${label} है।`,
    stopped: 'रुक गया।',
    unknownCommand: 'विकल्पों के लिए मदद कहें।',
    offlineNotice: 'ऑफ़लाइन मोड, सटीकता कम हो सकती है।',
    washroomScanning: 'शौचालय खोज रहे हैं। कृपया धीरे-धीरे घूमें।',
    washroomNotFound: 'शौचालय नहीं मिला। कृपया आगे बढ़ें और दोबारा कहें।',
    currencyScanning: 'कैमरे के सामने नोट पकड़ें।',
    wasteScanning: 'डस्टबिन चयन के लिए वस्तु दिखाएं।',
    labelScanning: 'उत्पाद लेबल की ओर कैमरा करें।',
    hazardScanning: 'फर्श और रास्ते के खतरों की जांच की जा रही है।',
    sosAlert: 'आपातकालीन सहायता सक्रिय। स्थान और परिवेश की घोषणा की जा रही है।',
    notBuiltYet: 'यह मोड अभी तैयार नहीं है।',
  },
  'kn-IN': {
    welcome: 'ಸೈಟ್‌ಲೈನ್‌ಗೆ ಸುಸ್ವಾಗತ. ನಿಮ್ಮ ಸಹಾಯಕ ಸಕ್ರಿಯವಾಗಿದೆ.',
    commandHelp: 'ಆದೇಶಗಳು: ಸುತ್ತಲೂ, ಓದಿ, ಹುಡುಕಿ, ನೋಟು ಗುರುತಿಸಿ, ಕಸ ವಿಂಗಡಣೆ, ಅಥವಾ ನಿಲ್ಲಿಸಿ.',
    looking: 'ನೋಡಲಾಗುತ್ತಿದೆ...',
    dangerAhead: (label: string) => `ನಿಲ್ಲಿಸಿ. ಮುಂದೆ ${label} ಇದೆ.`,
    stopped: 'ನಿಲ್ಲಿಸಲಾಗಿದೆ.',
    unknownCommand: 'ಆಯ್ಕೆಗಳಿಗಾಗಿ ಸಹಾಯ ಎಂದು ಹೇಳಿ.',
    offlineNotice: 'ಆಫ್‌ಲೈನ್ ಮೋಡ್, ನಿಖರತೆ ಕಡಿಮೆಯಿರಬಹುದು.',
    washroomScanning: 'ಶೌಚಾಲಯಕ್ಕಾಗಿ ಹುಡುಕಲಾಗುತ್ತಿದೆ. ನಿಧಾನವಾಗಿ ತಿರುಗಿ.',
    washroomNotFound: 'ಇನ್ನೂ ಸಿಕ್ಕಿಲ್ಲ. ಮುಂದುವರಿಯಿರಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    currencyScanning: 'ಕ್ಯಾಮೆರಾ ಮುಂದೆ ನೋಟನ್ನು ಹಿಡಿಯಿರಿ.',
    wasteScanning: 'ಕಸದ ತೊಟ್ಟಿ ಆಯ್ಕೆಗಾಗಿ ವಸ್ತುವನ್ನು ತೋರಿಸಿ.',
    labelScanning: 'ಉತ್ಪನ್ನ ಲೇಬಲ್ ಕಡೆಗೆ ಕ್ಯಾಮೆರಾವನ್ನು ಹಿಡಿಯಿರಿ.',
    hazardScanning: 'ನೆಲದ ಅಪಾಯಗಳಿಗಾಗಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಲಾಗುತ್ತಿದೆ.',
    sosAlert: 'ತುರ್ತು ಎಸ್‌ಒಎಸ್ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ.',
    notBuiltYet: 'ಈ ಮೋಡ್ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ.',
  },
};

export const KEYWORD_INTENTS: Record<string, string> = {
  // Navigation & Vision
  'around me': 'AROUND_ME',
  'what is around': 'AROUND_ME',
  'describe': 'AROUND_ME',
  'look around': 'AROUND_ME',
  'read': 'READ',
  'read sign': 'READ',
  'read this': 'READ',
  'what does it say': 'READ',
  'find': 'FIND',
  'where is': 'FIND',
  'currency': 'CURRENCY',
  'count money': 'CURRENCY',
  'read note': 'CURRENCY',
  'rupee': 'CURRENCY',
  'waste': 'WASTE',
  'bin': 'WASTE',
  'dustbin': 'WASTE',
  'which bin': 'WASTE',
  'label': 'LABEL',
  'read product label': 'LABEL',
  'product label': 'LABEL',
  'expiry': 'LABEL',
  'ingredients': 'LABEL',
  'allergens': 'LABEL',
  'hazard': 'HAZARD',
  'scan floor': 'HAZARD',
  'stairs': 'HAZARD',
  'navigate': 'NAVIGATE',
  'take me to': 'NAVIGATE',
  'sos': 'SOS',
  'emergency': 'SOS',
  'help me': 'SOS',
  'privacy': 'PRIVACY',
  'privacy policy': 'PRIVACY',

  // Controls
  'start obstacle': 'OBSTACLE_ON',
  'obstacle alert': 'OBSTACLE_ON',
  'stop alert': 'OBSTACLE_OFF',
  'stop': 'STOP',
  'quiet': 'STOP',
  'cancel': 'STOP',
  'help': 'HELP',
  'repeat': 'REPEAT',
  'say again': 'REPEAT',

  // Verbosity
  'quiet mode': 'VERBOSITY_QUIET',
  'normal mode': 'VERBOSITY_NORMAL',
  'detailed mode': 'VERBOSITY_DETAILED',

  // Languages
  'english': 'LANGUAGE_EN',
  'speak english': 'LANGUAGE_EN',
  'hindi': 'LANGUAGE_HI',
  'speak hindi': 'LANGUAGE_HI',
  'kannada': 'LANGUAGE_KN',
  'speak kannada': 'LANGUAGE_KN',

  // Hindi Phrases
  'आसपास': 'AROUND_ME',
  'पढ़ो': 'READ',
  'ढूंढो': 'FIND',
  'शौचालय': 'FIND',
  'नोट': 'CURRENCY',
  'कचरा': 'WASTE',
  'खतरा': 'HAZARD',
  'मदद': 'HELP',
  'रुकें': 'STOP',
  'हिंदी': 'LANGUAGE_HI',

  // Kannada Phrases
  'ಸುತ್ತಲೂ': 'AROUND_ME',
  'ಓದಿ': 'READ',
  'ಹುಡುಕಿ': 'FIND',
  'ಶೌಚಾಲಯ': 'FIND',
  'ನೋಟು': 'CURRENCY',
  'ಕಸ': 'WASTE',
  'ಅಪಾಯ': 'HAZARD',
  'ಸಹಾಯ': 'HELP',
  'ನಿಲ್ಲಿಸಿ': 'STOP',
  'ಕನ್ನಡ': 'LANGUAGE_KN',
};
