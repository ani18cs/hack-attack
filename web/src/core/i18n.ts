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
  notBuiltYet: string;
}

export const PHRASES: Record<SupportedLocale, PhraseTable> = {
  'en-IN': {
    welcome: 'Welcome to SightLine. Your eyes-free assistant is active.',
    commandHelp: 'Available commands: What is around me, Read this, Find washroom, Obstacle alert, or Stop.',
    looking: 'Looking...',
    dangerAhead: (label: string) => `Stop. ${label} ahead.`,
    stopped: 'Stopped.',
    unknownCommand: 'Sorry, say help for options.',
    offlineNotice: 'Offline mode, may be less accurate.',
    washroomScanning: 'Scanning for washroom. Slowly turn around.',
    washroomNotFound: 'Not found yet. Try turning more, or move forward and say find washroom again.',
    notBuiltYet: 'This mode is not built yet.',
  },
  'hi-IN': {
    welcome: 'साइटलाइन में आपका स्वागत है। आपका सहायक सक्रिय है।',
    commandHelp: 'उपलब्ध आदेश: आसपास क्या है, पढ़ें, शौचालय खोजें, या रुकें।',
    looking: 'देख रहे हैं...',
    dangerAhead: (label: string) => `रुकें। आगे ${label} है।`,
    stopped: 'रुक गया।',
    unknownCommand: 'माफ़ कीजिए, विकल्पों के लिए मदद कहें।',
    offlineNotice: 'ऑफ़लाइन मोड, सटीकता कम हो सकती है।',
    washroomScanning: 'शौचालय खोज रहे हैं। कृपया धीरे-धीरे घूमें।',
    washroomNotFound: 'शौचालय नहीं मिला। कृपया आगे बढ़ें और दोबारा कहें।',
    notBuiltYet: 'यह मोड अभी तैयार नहीं है।',
  },
  'kn-IN': {
    welcome: 'ಸೈಟ್‌ಲೈನ್‌ಗೆ ಸುಸ್ವಾಗತ. ನಿಮ್ಮ ಸಹಾಯಕ ಸಕ್ರಿಯವಾಗಿದೆ.',
    commandHelp: 'ಆದೇಶಗಳು: ಸುತ್ತಲೂ ಏನಿದೆ, ಓದಿ, ಶೌಚಾಲಯ ಹುಡುಕಿ, ಅಥವಾ ನಿಲ್ಲಿಸಿ.',
    looking: 'ನೋಡಲಾಗುತ್ತಿದೆ...',
    dangerAhead: (label: string) => `ನಿಲ್ಲಿಸಿ. ಮುಂದೆ ${label} ಇದೆ.`,
    stopped: 'ನಿಲ್ಲಿಸಲಾಗಿದೆ.',
    unknownCommand: 'ಕ್ಷಮಿಸಿ, ಆಯ್ಕೆಗಳಿಗಾಗಿ ಸಹಾಯ ಎಂದು ಹೇಳಿ.',
    offlineNotice: 'ಆಫ್‌ಲೈನ್ ಮೋಡ್, ನಿಖರತೆ ಕಡಿಮೆಯಿರಬಹುದು.',
    washroomScanning: 'ಶೌಚಾಲಯಕ್ಕಾಗಿ ಹುಡುಕಲಾಗುತ್ತಿದೆ. ನಿಧಾನವಾಗಿ ತಿರುಗಿ.',
    washroomNotFound: 'ಇನ್ನೂ ಸಿಕ್ಕಿಲ್ಲ. ಮುಂದುವರಿಯಿರಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    notBuiltYet: 'ಈ ಮೋಡ್ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ.',
  },
};

export const KEYWORD_INTENTS: Record<string, string> = {
  // English
  'around me': 'AROUND_ME',
  'what is around': 'AROUND_ME',
  'describe': 'AROUND_ME',
  'look around': 'AROUND_ME',
  'read': 'READ',
  'read sign': 'READ',
  'what does it say': 'READ',
  'find washroom': 'FIND_WASHROOM',
  'restroom': 'FIND_WASHROOM',
  'toilet': 'FIND_WASHROOM',
  'bathroom': 'FIND_WASHROOM',
  'start obstacle': 'OBSTACLE_ON',
  'obstacle alert': 'OBSTACLE_ON',
  'stop alert': 'OBSTACLE_OFF',
  'stop alerts': 'OBSTACLE_OFF',
  'stop': 'STOP',
  'quiet': 'STOP',
  'cancel': 'STOP',
  'help': 'HELP',
  'what can you do': 'HELP',
  'repeat': 'REPEAT',
  'say again': 'REPEAT',
  // Hindi
  'आसपास': 'AROUND_ME',
  'पढ़ो': 'READ',
  'शौचालय': 'FIND_WASHROOM',
  'रुकें': 'STOP',
  'मदद': 'HELP',
  // Kannada
  'ಸುತ್ತಲೂ': 'AROUND_ME',
  'ಓದಿ': 'READ',
  'ಶೌಚಾಲಯ': 'FIND_WASHROOM',
  'ನಿಲ್ಲಿಸಿ': 'STOP',
  'ಸಹಾಯ': 'HELP',
};
