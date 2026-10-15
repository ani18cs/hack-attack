# ðŸŽ¬ SightLine â€” Live Hackathon Demo Script

> **Event:** HackAttack 2026 (Sustainability & Social Impact Track)
> **Team Role:** Team Member C (AI, Server Proxy & Flagship Modes Lead)
> **Scope:** Demonstrates the implemented flagship modes: **Read Mode** and **Find Washroom Mode**.
> **Target Duration:** 3â€“4 Minutes
> **Demo Device:** Smartphone or laptop with camera connected over HTTPS / local tunnel

---

## 1. Pre-Demo Setup Checklist

Complete this checklist before presenting to the judges:

- [ ] **1. Verify Environment Variables:**
  Ensure `server/.env` exists and contains:
  ```env
  PORT=8787
  ALLOWED_ORIGIN=http://localhost:5173
  GEMINI_MODEL=gemini-3.8-flash
  GEMINI_API_KEY=your_actual_key_here
  ```
  *(Note: `server/.env.example` provides the template. Never commit real keys).*

- [ ] **2. Start the Development Servers:**
  From the repository root (`hack-attack/`), run:
  ```bash
  # Starts both web (port 5173) and server (port 8787) concurrently
  npm run dev
  ```
  Or run them in separate terminals:
  ```bash
  # Terminal 1: Backend proxy
  npm run dev --workspace=server

  # Terminal 2: Frontend client
  npm run dev --workspace=web
  ```

- [ ] **3. Check Server Status & Key Configuration:**
  - Health check endpoint:
    ```bash
    curl http://localhost:8787/api/health
    ```
    Expected output:
    ```json
    {"ok":true,"model":"gemini-3.8-flash","hasApiKey":true,"hasSarvamKey":false}
    ```
    *(Note: `/api/health` verifies that `GEMINI_API_KEY` is set in `.env`, not that the key is valid with Google).*
  - **To verify active Gemini API credentials with Google's servers**, run the test script:
    ```bash
    npx tsx server/scripts/try-find.ts
    ```
    Verify it returns HTTP 200 with a structured JSON response.

- [ ] **4. Mobile Access via HTTPS (Required for mobile camera):**
  Mobile browsers restrict `navigator.mediaDevices.getUserMedia` to secure contexts (HTTPS or localhost).
  Expose the frontend via a tunnel:
  ```bash
  cloudflared tunnel --url http://localhost:5173
  ```
  Open the resulting `https://*.trycloudflare.com` URL on the phone browser.

- [ ] **5. Prepare Physical Demo Props:**
  - One printed high-contrast text sign (e.g., **"EMERGENCY EXIT âž¡ï¸"** or **"ROOM 101"**).
  - One printed restroom icon / sign (e.g., **"ðŸš» Restroom"** or **"Women â¬…ï¸"**).

---

## 2. Presenter Demo Flow (3â€“4 Minutes)

### Phase 1: Problem Framing & The "Giant Start" (0:00 â€“ 0:45)

* **Presenter Action:**
  Show the phone screen. The app displays a giant yellow button filling the screen: **"START SIGHTLINE"**.
* **What Presenter Says:**
  > *"For visually impaired people, navigating unfamiliar indoor spaces like campuses or transit hubs is challenging, while specialized assistive hardware is often expensive.*
  > *SightLine is a voice-first, eyes-free assistant designed to run directly in a smartphone browser. It uses the camera as a sensor and translates surroundings into speech and tactile feedback."*
* **Presenter Action:**
  Tap the giant Start button without looking at the screen.
* **What Happens in the App (Implemented & Verified):**
  - The single tap satisfies the browser's user-gesture requirement for audio autoplay and camera access.
  - `camera.start()` requests the rear camera (`facingMode: { ideal: 'environment' }`) and connects the video stream.
  - Speech synthesis announces the welcome message:
    `"Welcome to SightLine. Your eyes-free assistant is active. Available commands: What is around me, Read this, Find washroom, Obstacle alert, or Stop."`
  - Haptic feedback pulses (`haptics.pulseConfirm()`).
  - Screen transitions to the high-contrast mode dashboard.

---

### Phase 2: Read Mode â€” Signs & Navigation Text (0:45 â€“ 1:45)

* **Presenter Action:**
  Aim the camera at the printed **"EMERGENCY EXIT âž¡ï¸"** sign. Tap the **"Read Text / Signs"** button (or speak *"Read this"*).
* **What Happens in the App (Implemented & Verified):**
  - Spoken audio announces: `"Looking..."` with a subtle tactile pulse.
  - Visual status pulses: `Reading signs with AI...`
  - `Read.tsx` captures a frame via `camera.captureFrame(1024, 0.75)` and sends it to `POST /api/read`.
  - Gemini Vision analyzes the frame and returns structured JSON:
    - `summary`: Short spoken description.
    - `texts`: Array of detected text items with `kind` (`exit`, `room`, `store`, `direction`, `warning`, `other`) and `direction` (`left`, `ahead`, `right`).
  - App speaks the summary aloud (e.g., `"Emergency exit sign with arrow pointing right"`).
  - High-contrast summary card and categorized pills appear on screen.
* **Presenter Action:**
  Tap an individual detected item or tap **"Read All"**.
* **What Happens in the App:**
  - Previous speech stops immediately (`speech.stop()`), and the tapped item's text, category, and direction are read aloud without queuing delay.

---

### Phase 3: Offline Tesseract.js Fallback (1:45 â€“ 2:15)

* **Presenter Action:**
  Explain the offline fallback architecture.
* **What Presenter Says:**
  > *"Cloud vision models provide rich scene context, but users can lose connectivity in basements or stairwells. If the proxy server is unreachable or offline, SightLine automatically falls back to an on-device Tesseract.js engine."*
* **What Happens if the Server is Offline / Unreachable (Implemented & Verified):**
  - If `api.readText()` fails or returns an error, `Read.tsx` announces:
    `"Server offline. Trying on-device text reader."`
  - Invokes `recognizeTextFallback(frameBase64)` using in-browser Tesseract OCR (`eng` model).
  - Displays amber badge: `âš ï¸ Offline reader used (lower accuracy)`.
  - Announces: `"Offline mode. Found text: {rawText}"`.

---

### Phase 4: Find Washroom â€” Flagship State Machine (2:15 â€“ 3:15)

* **Presenter Action:**
  Tap **"Find Washroom"** (or say *"Find washroom"*).
* **What Happens in the App (Implemented & Verified):**
  - Enters **`SCANNING`** state.
  - Spoken audio: `"Scanning for washroom. Slowly turn around."`
  - UI displays an animated 360Â° indicator and a 20-second countdown bar.
  - An interval triggers `performScan()` every 2 seconds (`SCAN_INTERVAL_MS = 2000`).
  - In-flight request lock (`inFlightRef`) drops ticks if a previous API request is still resolving, preventing overlapping network calls.
* **Presenter Action:**
  Slowly rotate toward the printed restroom sign.
* **What Happens in the App (Implemented & Verified):**
  - Once Gemini detects a restroom indicator with confidence `â‰¥ 0.6`:
    - Confirmation vibration fires (`haptics.pulseConfirm()`).
    - State transitions to **`FOUND`**.
    - App announces: `"Restroom sign, {gender}, on your {direction}."` (e.g., `"Restroom sign, women's, on your left."`).
    - UI updates to a green guidance card showing directional arrows (`â¬…ï¸`, `â¬†ï¸`, `âž¡ï¸`), gender category, and confidence score.
    - Transitions to **`GUIDING`**: subsequent 2-second scans announce direction updates as the user turns (`"Restroom now on your ahead"`).

---

### Phase 5: Timeout & Honest Failure Handling (3:15 â€“ 3:35)

* **What Happens if No Restroom is Detected within 20s (Implemented & Verified):**
  - The 20-second timer expires.
  - State transitions to **`NOT_FOUND`**.
  - Audio announces: `"Not found yet. Try turning more, or move forward and say find washroom again."`
  - Screen displays a **"Scan Again"** retry button, allowing the user to restart scanning.

---

### Phase 6: Closing (3:35 â€“ 4:00)

* **Presenter Action:**
  Tap **"Stop Mode (Exit)"** to stop the active mode and return to the main dashboard.
* **What Presenter Says:**
  > *"SightLine demonstrates how commodity smartphone browsers can provide voice-first spatial assistance without proprietary hardware. While cloud vision adds latency and requires network access, graceful degradation and honest confidence gating ensure the user is informed rather than misled.*
  > *Thank you, and we look forward to your questions."*

---

## 3. Fallback Plan for Demo Contingencies

| Issue During Demo | What the Code Does | What the Presenter Should Say / Do |
|---|---|---|
| **Wi-Fi Slow or Drops** | Gemini calls time out after 10s (`timeoutMs = 10000`). `Read.tsx` automatically invokes `recognizeTextFallback()` on-device. | Explain that the system is demonstrating its built-in offline degradation. Show the offline text readout. |
| **API Key Missing / Server Not Running** | Proxy returns HTTP 503 (`GEMINI_API_KEY missing in server/.env`). | Run `npx tsx server/scripts/try-find.ts` before the demo to verify credentials with Google. If the key is unavailable, demonstrate the offline OCR fallback path. |
| **Camera Permission Blocked** | `camera.start()` throws; app announces `"Camera permission denied or unavailable"`. | Ensure permissions are granted in browser site settings before taking the stage. |
| **No Washroom Found in 20s** | Times out to `NOT_FOUND` state after 20 seconds. | Highlight this as a safety design feature: SightLine enforces a strict `0.6` confidence threshold to avoid hallucinating directions when uncertain. Tap "Scan Again" closer to the target. |
| **Ambient Noise Disables Voice Commands** | Web Speech recognition may mishear intents in a noisy room. | Do not struggle with voice input: all modes are directly accessible via the high-contrast touch buttons (>56px) on screen. |

---

## 4. Note on Modes Owned by Other Team Members

* **Around Me (Object Awareness) & Obstacle Alert:**
  * These components (`web/src/modes/AroundMe.tsx` and `ObstacleAlert.tsx`) are owned by Team Member B.
  * Their UI screens exist in `web/src/modes/`, but continuous COCO-SSD object loop integration into `App.tsx` is owned by Role B.
  * **For Role C's presentation, focus exclusively on the verified end-to-end modes: Read Mode and Find Washroom Mode.**
