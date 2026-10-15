# 🧠 Team Member C: AI, Server Proxy & Flagship Modes Lead

> **Assigned to:** Team Member C (AI & Server Lead)  
> **Role Scope:** Express Proxy Server, Google Gemini 3.8 Flash Vision Prompts & Schemas, Sarvam AI Indic TTS & Translation, Read Mode (Signs/Text), Find Washroom (Flagship Demo State Machine), Tesseract Offline Fallback, Demo Script, and Slides.  
> **Working Branch:** `feat/server-gemini`  
> **Primary Directory Ownership:** `server/*`, `web/src/vision/api.ts`, `web/src/vision/ocr.ts`, `web/src/modes/Read.tsx`, `web/src/modes/FindWashroom.tsx`, `docs/DEMO_SCRIPT.md`, `docs/LIMITATIONS.md`

---

## 1. Quickstart & Machine Setup

Run these commands in your terminal to set up the project:

```bash
# 1. Clone repository
git clone https://github.com/ani18cs/hack-attack.git
cd hack-attack

# 2. Switch to your feature branch
git checkout feat/server-gemini

# 3. Install dependencies
npm install

# 4. Set up environment variables
cp server/.env.example server/.env
cp web/.env.example web/.env
```
*(Ask the repo owner for the `GEMINI_API_KEY` and `SARVAM_API_KEY` to populate `server/.env`).*

```bash
# 5. Start dev servers
npm run dev

# 6. Test Gemini connection directly with local script:
npx tsx server/scripts/try-find.ts
```

---

## 2. Your Module Ownership

### Files You OWN (Only you edit these):
- `server/*` (`src/index.ts`, `src/routes/vision.ts`, `src/routes/tts.ts`, `src/prompts.ts`, `scripts/try-find.ts`)
- `web/src/vision/api.ts` (Frontend HTTP client to backend proxy)
- `web/src/vision/ocr.ts` (On-device Tesseract.js offline fallback)
- `web/src/modes/Read.tsx` (Sign & document reading mode)
- `web/src/modes/FindWashroom.tsx` (Flagship washroom guidance state machine)
- `docs/DEMO_SCRIPT.md` & `docs/LIMITATIONS.md` (Judging criteria, presentation script, honest limitations)

### Files You MUST NOT Edit:
- `web/src/app/*` (Owned by Team Member A)
- `web/src/core/*` (Owned by Team Member A)
- `web/src/vision/detector.ts`, `spatial.ts`, `announcer.ts` (Owned by Team Member B)
- `web/src/modes/ObstacleAlert.tsx` (Owned by Team Member B)

---

## 3. What Was Built in Milestone 1

1. **Express Server Proxy (`server/src/index.ts`):**
   - Configured with CORS for `localhost`, `127.0.0.1`, and all Cloudflare Tunnel (`*.trycloudflare.com`) domains.
   - Body parser limit of 5MB for high-resolution base64 images.
   - Per-IP rate limiting (60 requests/min).
   - `GET /api/health`: Returns server status, model name, and API key statuses.
2. **Gemini Vision Endpoints (`server/src/routes/vision.ts`):**
   - Model: **`gemini-3.8-flash`** via official `@google/genai` SDK.
   - Strict JSON response schema enforcement using `responseMimeType: "application/json"`.
   - `POST /api/describe`: Returns `{ summary: string, objects: [{ label, direction, distance }] }`.
   - `POST /api/read`: Returns `{ summary: string, texts: [{ text, kind, direction }] }`.
   - `POST /api/find`: Returns `{ found, direction, gender, confidence, cue }`.
3. **Sarvam AI Indic Speech & Translation (`server/src/routes/tts.ts`):**
   - `POST /api/tts`: High-fidelity Indic voice generation (Hindi `hi-IN`, Kannada `kn-IN`, English `en-IN`).
   - `POST /api/translate`: Real-time translation to Indic languages.
4. **Offline OCR Engine (`web/src/vision/ocr.ts`):**
   - Tesseract.js client ready as an automatic fallback if the server is offline or unreachable.

---

## 4. What You Need to Do Next (Milestones 2, 3 & 4)

### Task C1: Build `web/src/modes/Read.tsx`
- **User Experience:**
  1. User enters Read mode or says *"Read this"* / *"What does it say"*.
  2. Speak: `"Looking..."`
  3. Capture high-res frame via `camera.captureFrame(1024, 0.75)`.
  4. Call `api.readText(frameBase64, currentLang)`.
  5. If Gemini succeeds: Speak the `summary` immediately (e.g., *"Emergency exit sign with arrow pointing right."*). If user asks for details or taps screen, read the individual items.
  6. If server is unreachable or offline:
     - Invoke `recognizeTextFallback(frameBase64)`.
     - Speak: `"Offline mode. Found text: {rawText}"`.

### Task C2: Build `web/src/modes/FindWashroom.tsx` (The Hackathon Flagship Demo!)
- **State Machine Architecture:**
  `IDLE` ➡️ `SCANNING` ➡️ `FOUND` ➡️ `GUIDING` (or `NOT_FOUND` after 20 seconds timeout).
- **Behavior:**
  1. On mode start, speak: *"Scanning for washroom. Slowly turn around."*
  2. Start an interval timer checking every **2 seconds**:
     - Ensure only one in-flight request at a time (skip frame if previous call still processing).
     - Capture current video frame.
     - Call `api.findTarget(frameBase64, 'restroom', currentLang)`.
  3. When `found === true` with `confidence >= 0.6`:
     - Trigger confirmation vibration: `haptics.pulseConfirm()`.
     - Announce: *"Restroom sign, {gender}, on your {direction}."*
     - Transition state to `GUIDING`: re-check every 2 seconds to update direction (*"Still ahead"*, *"Now on your left, very close"*).
  4. If nothing is detected after 20 seconds:
     - Speak: *"Not found yet. Try turning more, or move forward and say find washroom again."*
  5. Sign variation support: Must reliably recognize pictograms (male/female/accessible icon), text variations (*WC, Toilet, Restroom, Washroom, Gents, Ladies*), and Hindi (*शौचालय*) / Kannada (*ಶೌಚಾಲಯ*).

### Task C3: Deploy Server Proxy (Render / Railway / Cloud Run)
- Deploy `server/` to a cloud host so judges can test the app from anywhere without running a local terminal.
- Provide the production backend URL to Team Member A to update `VITE_API_BASE`.

### Task C4: Write Presentation Scripts & Limitations Docs
- Create [docs/DEMO_SCRIPT.md](file:///a:/hackattack/docs/DEMO_SCRIPT.md) (timed 3-4 minute presentation script for blindfolded demonstration).
- Create [docs/LIMITATIONS.md](file:///a:/hackattack/docs/LIMITATIONS.md) (honest, credible limitations to impress judges per judging criteria: supplementary aid, distance estimated from bounding box area, 80 COCO classes vs vision LLM latency).

---

## 5. Git Workflow & How to Push

Follow these steps for every feature or fix:

```bash
# 1. Switch to your feature branch
git checkout feat/server-gemini

# 2. Rebase with main before starting work
git fetch origin
git rebase origin/main

# 3. Write your AI and mode logic

# 4. Verify compilation
npm run lint --workspace=server
npm run build --workspace=server
npm run build --workspace=web

# 5. Commit using Conventional Commits
git add .
git commit -m "feat(washroom): implement 2s scanning state machine and directional cues"

# 6. Push to GitHub
git push origin feat/server-gemini
```

### Opening a Pull Request:
1. Go to: [https://github.com/ani18cs/hack-attack/compare/main...feat/server-gemini?expand=1](https://github.com/ani18cs/hack-attack/compare/main...feat/server-gemini?expand=1)
2. Title your PR: `feat: server vision proxy routes and flagship modes`
3. Request a review from Team Member A before merging into `main`.

---

## 6. How to Test End-to-End

1. **Test Washroom Finder Locally:**
   - Run `npx tsx server/scripts/try-find.ts`
   - Point your webcam or camera at a restroom icon on your computer screen or door.
2. **Test Read Mode on Real Sign:**
   - Print out an "EXIT" or "ROOM 101" sign or open one on a second monitor.
   - Use the phone app over Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:5173`).
   - Tap "Read Now" or say *"Read this"*. Confirm it speaks the text aloud in <= 2 seconds!

---

## 7. Instructions to Give to Your Antigravity AI Agent

When opening this workspace in Antigravity IDE, paste this prompt to your agent:

> *"I am working as Team Member C (Role C: AI, Server Proxy & Flagship Modes Lead) on branch `feat/server-gemini`. Read `docs/KNOWLEDGE_BASE.md` and `docs/TEAM_MEMBER_C_AI_SERVER.md`. I own `server/*`, `web/src/vision/api.ts`, `web/src/vision/ocr.ts`, `web/src/modes/Read.tsx`, and `web/src/modes/FindWashroom.tsx`. Do not edit files owned by Role A or Role B. Help me implement [YOUR_TASK_NAME], ensure type-checking and builds pass, and commit using Conventional Commits."*
