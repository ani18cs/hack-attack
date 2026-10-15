# âš ï¸ SightLine â€” System Limitations & Engineering Constraints

> **Document Status:** Authoritative Technical Disclosure
> **Role Scope:** Team Member C (AI, Server Proxy & Flagship Modes Lead)
> **Repository:** `hack-attack`

Per the competition criteria for the Sustainability & Social Impact track, **SightLine is explicitly designed as a supplementary navigational aid**. It is not a replacement for a white cane, guide dog, or orientation and mobility training.

---

## 1. Hardware, Device & Sensor Constraints

1. **2D Monocular Camera (No Hardware Depth / LiDAR):**
   * SightLine relies on standard 2D RGB video frames from the browser's `navigator.mediaDevices.getUserMedia`.
   * Direction (`left`, `ahead`, `right`) is calculated from 2D bounding-box horizontal position relative to the camera frame.
   * The app cannot measure true physical distance. Any distance labels (`very close`, `close`, `a few steps away`) are rough estimates based on bounding-box area ratios, not depth sensors.

2. **Field of View & Ground Hazard Blindspots:**
   * A forward-facing smartphone camera only captures obstacles directly in its field of view.
   * Ground-level drop-offs (curbs, holes, descending stairs, wet floors) and overhead obstacles (tree branches, low overhangs) outside the forward camera angle **cannot be detected**.

3. **Camera Selection & Environment:**
   * `camera.start()` requests `facingMode: { ideal: 'environment' }`. While mobile browsers typically assign this to the rear camera, implementations vary. If unavailable, it falls back to any available video stream (such as a laptop webcam).
   * Motion blur during rapid turning, low-light indoor environments, and glare on signage significantly degrade Gemini Vision and Tesseract character recognition.

---

## 2. Network, Backend Proxy & Cloud AI Dependency

1. **Cloud Latency & In-Flight Dropping:**
   * Modes relying on Google Gemini (`/api/describe`, `/api/read`, `/api/find`) require active internet connectivity.
   * Cloud vision inference introduces latency that varies with network bandwidth, cellular reception, and Google API processing time. The client enforces a **10-second timeout** (`fetchWithTimeout(..., 10000)`).
   * Due to cloud latency, Gemini Vision is strictly used on-demand (e.g., Read mode capture, or 2-second polling in Find Washroom). It is not used for continuous, per-frame safety navigation.
   * In Find Washroom mode, the 2-second scan interval drops frames if the previous request is still in-flight, which can lead to delayed directional announcements if network latency spikes.

2. **Server-Side Rate Limiting & Body Limits:**
   * The Express proxy server enforces an IP rate limit of **60 requests per minute** (`express-rate-limit` in `server/src/index.ts`). Exceeding this rate returns HTTP 429 (`"Too many requests. Please slow down."`).
   * Express body parsing is limited to **5 MB** (`express.json({ limit: '5mb' })`). Client-side frame downscaling (`maxWidth: 1024`, quality: 0.75) keeps JPEG payloads well under this limit.

3. **API Key Configuration & Health Endpoint Scope:**
   * The health endpoint (`GET /api/health`) checks whether `GEMINI_API_KEY` is present in `process.env` and not a placeholder. **It does not perform a live authentication handshake with Google.**
   * If `GEMINI_API_KEY` is invalid, expired, or depleted, the proxy returns HTTP 500 or 503 errors when calling vision endpoints.
   * Live connectivity must be confirmed by running `npx tsx server/scripts/try-find.ts`.

---

## 3. OCR & Language Scope (Online vs. Offline Fallback)

1. **Online Gemini Vision OCR:**
   * Transcribes visible text and classifies it into predefined categories: `exit`, `room`, `store`, `direction`, `warning`, `other`.
   * Accepts a target language parameter (`lang`), but translation fidelity depends on the Gemini model's multilingual capabilities.

2. **On-Device Tesseract.js Fallback Scope:**
   * Worker is initialized with the English model only: `createWorker('eng')` in `web/src/vision/ocr.ts`.
   * **Language Limitation:** Does not recognize non-Latin Indic scripts (Hindi, Kannada, Tamil, etc.) in offline fallback mode.
   * **Semantic Limitation:** Offline OCR extracts raw characters only. It cannot categorize text into semantic kinds (`exit`, `room`, etc.) or determine directional placement. All detected lines default to `kind: 'other'` and `direction: 'ahead'`.
   * **Processing Time:** Client-side WebAssembly OCR on mobile CPUs can take several seconds depending on device hardware, during which the UI displays an active reading state.

---

## 4. Find Washroom Guidance Boundaries

1. **Confidence Threshold & Gating:**
   * A washroom detection is only accepted if `response.found === true` and `response.confidence >= 0.6`.
   * Signs with low contrast, unusual iconography, or partial occlusions may fail to clear the 0.6 threshold, leading to non-detection.

2. **Directional Latency:**
   * Directional updates (`"Restroom now on your left"`) update every 2 seconds at maximum. Rapid 180Â° turns will result in a brief lag before the audio updates to reflect the new direction.

3. **20-Second Timeout (`NOT_FOUND`):**
   * If no restroom is detected within 20 seconds, the state machine transitions to `not_found` to prevent indefinite battery and quota drain.
   * Users must manually tap "Scan Again" or issue a voice command to restart scanning.

---

## 5. Accessibility, Speech & Audio Limitations

1. **Web Speech API Browser Variance:**
   * The quality, naturalness, rate, and pitch of `window.speechSynthesis` depend entirely on the host operating system's installed voices.
   * Mobile browsers enforce strict autoplay policies: audio context and speech synthesis are muted until an explicit user touch gesture unlocks them. SightLine handles this via the full-screen Start button, but direct page loads without touching the screen cannot produce audio.
   * Web Speech Recognition (`webkitSpeechRecognition`) requires an internet connection on many mobile devices and is susceptible to background noise.

2. **Haptic Feedback Platform Support:**
   * Vibration feedback relies on `navigator.vibrate` (`web/src/core/haptics.ts`).
   * Supported on Android Chrome.
   * **Unsupported on iOS Safari** (Apple does not expose the Web Vibration API to browser applications). On iOS, haptic calls fail silently without throwing an error.

---

## 6. Privacy & Security Considerations

1. **Image Transmission:**
   * Captured camera frames are converted to Base64 JPEG strings and transmitted over HTTP/HTTPS to the backend proxy (`POST /api/describe`, `/api/read`, `/api/find`), which forwards them over TLS to Google's Gemini API.
   * The SightLine proxy server processes frames in-memory and does not write images to disk or persist them in a database.
   * **Third-Party Processing:** Frames sent to the Google Gemini API are subject to Google's API Terms of Service and data retention policies depending on the API tier used (e.g., AI Studio free tier vs. Google Cloud paid enterprise tier). SightLine does not claim control over third-party cloud provider logging.

2. **Credential Isolation:**
   * `GEMINI_API_KEY` and `SARVAM_API_KEY` reside exclusively on the server in `server/.env`.
   * No API secrets are bundled into client-side Vite builds or exposed to client network traffic.

---

## 7. Verified vs. Unverified Status Matrix

| Component / Feature | Build / Static Code Verification | Live Device & Runtime Status |
|---|---|---|
| Web Production Bundle | âœ… **Verified** (`tsc && vite build` passed, PWA manifest & service worker generated) | N/A |
| Server Build & Lint | âœ… **Verified** (`tsc` and `tsc --noEmit` passed with 0 errors) | N/A |
| Read Mode Logic | âœ… **Verified** (In-flight guard, auto-trigger, speech, UI badges, unmount cleanup) | Requires live camera & active `GEMINI_API_KEY` |
| Tesseract.js Fallback | âœ… **Verified** (Worker invocation, raw text normalization, offline UI badge) | Verified code path; requires browser runtime to download language data |
| Find Washroom State Machine | âœ… **Verified** (`SCANNING` âž” `FOUND` âž” `GUIDING` / `NOT_FOUND` 20s timeout, interval cancellation) | Requires live camera & active `GEMINI_API_KEY` |
| Mobile Rear-Camera Capture | âœ… **Code-verified** (`facingMode: { ideal: 'environment' }`) | Requires testing on a physical phone over HTTPS |
| Mobile Vibration (`navigator.vibrate`) | âœ… **Code-verified** | Confirmed supported on Android; unsupported on iOS Safari |
| Obstacle Alert & Around Me Continuous Loops | âš ï¸ **Not Yet Connected in App Shell** | Owned by Team Member B; UI screens exist, but live COCO-SSD continuous detection loop in `App.tsx` is not wired |
