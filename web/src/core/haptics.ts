/**
 * Haptic feedback wrapper using the Vibration API.
 */
export const haptics = {
  /** Short pulse for subtle information updates */
  pulseInfo: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(80);
    }
  },

  /** Confirmation vibration when a mode or command succeeds */
  pulseConfirm: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  },

  /** Rapid urgent pulse for danger/obstacle alert per spec [200, 100, 200] */
  pulseDanger: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  },

  /** Rhythmic triple pulse when landmark or target is spotted */
  pulseFound: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([150, 50, 150]);
    }
  },

  /** Long error buzz when operation fails */
  pulseError: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(400);
    }
  },

  /** Cancel active vibration */
  cancel: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  },
};
