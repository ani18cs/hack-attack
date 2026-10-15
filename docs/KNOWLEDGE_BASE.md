# SightLine — Project Knowledge Base

> Working name: **SightLine** (rename freely). Voice-first, phone-based assistant that helps visually impaired people perceive and navigate their surroundings.
> This file is the single source of truth for humans and for the Antigravity agent. Read it fully before writing code. If code and this file disagree, ask, then update this file.

---

## 1. Context

- **Event:** HackAttack, AMC Engineering College (Autonomous), Dept. of CSE (AIML). Track: Sustainability and Social Impact.
- **Problem statement:** *AI-Powered Environmental Awareness and Navigation for the Visually Impaired.* Build a functional prototype that helps visually impaired people perceive, interpret and interact with their surroundings.
- **Build window:** 5 hours. Scope everything to what can be built **and demoed** in that time.
- **Team:** 3 people. Work in parallel on separate modules, merge often.
- **Allowed:** any AI/ML, computer vision, OCR, voice, mobile/web app, IoT. Open-source libraries, pretrained models and APIs are permitted.
- **Must do:** clearly communicate capabilities **and limitations**.

### Judging criteria (every decision should serve these)
| Criterion | What we do about it |
|---|---|
| Problem relevance | Target real scenarios: washroom, signs, obstacles, objects |
| Functionality | Working live demo on a phone; fewer features, all reliable |
| Innovation | Hybrid on-device + vision-LLM pipeline, multilingual voice, low cost (no special hardware) |
| Accessibility | Voice-first, huge touch targets, haptics, no visual-only feedback |
| Technical execution | Clean modules, real-time detection, graceful fallbacks |
| Real-world impact | Works on any smartphone; offline-capable core; roadmap to sensors |
| Demonstration | Eyes-closed / blindfold demo, scripted flow, limitations slide |

---

## 2. Product summary

A **Progressive Web App** opened on a phone. The camera is the sensor; **audio and vibration are the interface**. One core loop: **see → interpret → speak**.

### Modes
1. **Around Me** (object awareness): announces nearby objects with direction and rough distance.
2. **Read** (signs and text): reads exit signs, room labels, store names, directional boards.
3. **Find Washroom** (headline demo): user asks, app scans for restroom signs/icons and guides left/right/ahead.
4. **Obstacle Alert** (continuous safety): warns when something is close in the walking path.
5. **Find Item** (stretch): "find my bottle/phone/chair" using detection.

### Non-goals (do NOT build)
- Turn-by-turn GPS/indoor mapping, user accounts, databases, payments.
- Anything that claims to replace a white cane or guide dog. We say this explicitly.
- Custom model training (no time). Use pretrained models and APIs.

---

## 3. Accessibility principles (hard requirements)

1. **Voice-first.** Every action reachable by voice command AND by a very large button. Never require reading the screen.
2. **Audio feedback for everything**: mode changes, errors, "nothing found", loading states ("Looking…").
3. **Haptics** via `navigator.vibrate` where supported: short pulse = new info, long/rapid = danger.
4. **No chatter.** Speak only on meaningful change. Rules in section 7.
5. **Priority queue for speech**: danger alerts interrupt everything; normal info queues; stale info is dropped.
6. **High-contrast UI** (WCAG AA+), minimum 56px touch targets, full-screen mode buttons, ARIA labels and live regions, works with TalkBack/VoiceOver.
7. **Short phrases.** "Door ahead, left." not paragraphs.
8. **Honest uncertainty.** If confidence is low say "I'm not sure" instead of guessing.
9. **Start experience**: on load, speak a 2-sentence welcome and the available commands (requires one user tap to unlock audio/camera on mobile browsers; make that tap a giant "Start" button covering the screen).

---

## 4. Architecture

Hybrid pipeline: fast local detection for real-time safety, vision LLM for understanding and reading.

```
Phone browser (PWA, HTTPS)
 ├─ Camera (getUserMedia, rear camera)
 ├─ Local detector: TensorFlow.js COCO-SSD  → objects, boxes (real-time, offline)
 ├─ Spatial engine: box → direction + distance bucket + danger
 ├─ Speech out: SpeechSynthesis queue (priority)
 ├─ Speech in: Web Speech API (SpeechRecognition) → intent router
 ├─ Haptics: Vibration API
 └─ On-demand calls ─────────────────────────────┐
                                                 ▼
                                   Node/Express proxy (server/)
                                   holds GEMINI_API_KEY, never exposed to client
                                                 │
                                                 ▼
                                   Gemini vision model (scene / OCR / washroom)
                                   Fallback: Tesseract.js OCR in browser
```

### Why this split
- COCO-SSD runs ~10+ FPS on phones, works offline, great for obstacles. **Limitation:** only 80 classes (no "door", no "restroom sign").
- Gemini vision handles doors, signs, restroom icons, multilingual text and natural descriptions, but costs latency (1–3 s), so it is **on demand**, never per-frame.
- Tesseract.js is the offline fallback for plain text.

### Stack
- **Frontend:** Vite + React + TypeScript, Tailwind CSS, `vite-plugin-pwa`.
- **Detection:** `@tensorflow/tfjs`, `@tensorflow-models/coco-ssd`.
- **OCR fallback:** `tesseract.js`.
- **Voice:** browser Web Speech API (SpeechSynthesis + SpeechRecognition). Locale configurable: `en-IN`, `hi-IN`, `kn-IN`.
- **Server:** Node 20+, Express, `@google/genai` SDK (or REST), `cors`, `dotenv`, `multer` or JSON base64 body (limit 5 MB).
- **Tooling:** ESLint, Prettier, GitHub Actions (lint + build).
- **Hosting for demo:** camera needs HTTPS. Use a Cloudflare Tunnel / ngrok during dev, and Vercel/Netlify (web) + Render/Railway (server) for the final demo link.

### Env vars
`server/.env` (never commit):
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash   # check Google AI docs for the newest Flash-class model
PORT=8787
ALLOWED_ORIGIN=http://localhost:5173
```
`web/.env`:
```
VITE_API_BASE=http://localhost:8787
```
Commit `.env.example` files only.

---

## 5. Repository layout (monorepo)

```
sightline/
├─ README.md
├─ AGENTS.md                 # rules for AI agents (short; points to this file)
├─ docs/
│  ├─ KNOWLEDGE_BASE.md      # this file
│  ├─ DEMO_SCRIPT.md
│  └─ LIMITATIONS.md
├─ web/
│  ├─ src/
│  │  ├─ app/                # App shell, routing between modes
│  │  ├─ components/         # BigButton, ModeScreen, StatusBanner
│  │  ├─ core/
│  │  │  ├─ camera.ts        # stream + frame capture
│  │  │  ├─ speech.ts        # TTS queue with priorities
│  │  │  ├─ voice.ts         # STT + intent router
│  │  │  ├─ haptics.ts
│  │  │  └─ i18n.ts          # phrase tables en/hi/kn
│  │  ├─ vision/
│  │  │  ├─ detector.ts      # COCO-SSD loop
│  │  │  ├─ spatial.ts       # direction/distance/danger logic
│  │  │  ├─ announcer.ts     # dedupe + cooldown logic
│  │  │  ├─ ocr.ts           # Tesseract fallback
│  │  │  └─ api.ts           # calls to server
│  │  └─ modes/
│  │     ├─ AroundMe.tsx
│  │     ├─ Read.tsx
│  │     ├─ FindWashroom.tsx
│  │     └─ ObstacleAlert.tsx
│  └─ public/ (icons, manifest)
├─ server/
│  ├─ src/index.ts           # Express app
│  ├─ src/routes/vision.ts   # /api/describe /api/read /api/find
│  └─ src/prompts.ts         # Gemini prompts
└─ .github/
   ├─ workflows/ci.yml
   ├─ pull_request_template.md
   └─ ISSUE_TEMPLATE/
```

---

## 6. Module specs

### 6.1 `core/speech.ts`: speech output
- `speak(text, {priority: 'danger'|'normal'|'low', lang?})`.
- `danger` cancels current speech immediately and speaks. `normal` queues (max queue 3, drop oldest). `low` only speaks if queue empty.
- Expose `isSpeaking`, `stop()`, `setRate()`, `setLang()`.
- Handle the Chrome bug where long utterances cut off: keep phrases short.

### 6.2 `core/voice.ts`: voice commands
Continuous recognition with auto-restart. Intent router with fuzzy keyword matching (English, Hindi, Kannada keywords in `i18n.ts`):

| Intent | Example phrases |
|---|---|
| `AROUND_ME` | "what's around me", "describe", "look around" |
| `READ` | "read this", "read sign", "what does it say" |
| `FIND_WASHROOM` | "find washroom", "restroom", "toilet", "where is the bathroom" |
| `OBSTACLE_ON/OFF` | "start obstacle alert", "stop alerts" |
| `FIND_ITEM` | "find my bottle / chair / phone" (stretch) |
| `STOP` | "stop", "quiet", "cancel" |
| `HELP` | "help", "what can you do" |
| `REPEAT` | "repeat", "say again" |

Always confirm: "Okay, reading." Unknown command: "Sorry, say help for options."

### 6.3 `vision/detector.ts`: local detection
- Load COCO-SSD (`lite_mobilenet_v2` for speed) once; show/speak "Getting ready" until loaded.
- Run detection on the video element at ~5–10 FPS (throttle by `requestAnimationFrame` + time gate). Pause when tab hidden.
- Output: `{label, score, bbox:[x,y,w,h]}[]`, filter `score >= 0.55`.

### 6.4 `vision/spatial.ts`: direction, distance, danger
Frame normalised to 0–1.
- **Direction** from box center x: `<0.33` → "left", `0.33–0.66` → "ahead", `>0.66` → "right". (Use "slightly left/right" for 0.25–0.4 and 0.6–0.75 if you want finer wording.)
- **Distance (rough)** from box area ratio `area = (w*h)/(frameW*frameH)`:
  - `> 0.35` → "very close"
  - `0.12–0.35` → "close"
  - `0.03–0.12` → "a few steps away"
  - `< 0.03` → "far" (usually not announced)
  - Per-class tuning is allowed (a person looks bigger than a bottle at same distance). Document any tuning here.
- **Danger rule:** object in the central 50% of the frame, in the lower-center zone (walking path), with area ratio `> 0.25`, OR area growing quickly across 3 consecutive frames (approaching). Ignore small items.
- Output a `SceneObject {label, direction, distance, danger}`.

### 6.5 `vision/announcer.ts`: anti-chatter
- Maintain a map of last-announced state per `label+direction`.
- Re-announce only if: new object, direction changed, distance bucket got closer, or cooldown (8 s) expired.
- Batch: at most **3 objects** per announcement, sorted by danger then closeness. Example: "Chair close, right. Person ahead."
- Danger alerts bypass cooldown but have their own 2.5 s cooldown to avoid spamming.
- Pair danger with a vibration pattern `[200,100,200]`.

### 6.6 `modes/ObstacleAlert`
Runs the detector continuously. Only speaks on `danger`. Message: "Stop. {label} ahead." + vibrate. Also optionally a looping beep whose rate increases with proximity (Web Audio API; stretch).

### 6.7 `modes/AroundMe`
Two behaviours:
1. **Continuous** (local): COCO-SSD announcements via announcer.
2. **On demand** ("describe"): capture a frame, send to `/api/describe`, speak the short answer (doors, signs, layout). Say "Looking" first.

### 6.8 `modes/Read`
1. Capture frame (downscale to max 1024px wide, JPEG q≈0.7).
2. POST `/api/read`. Gemini returns JSON `{texts:[{text, kind}], summary}` where `kind` ∈ `exit|room|store|direction|warning|other`.
3. Speak summary first ("Exit sign. Arrow pointing right."), then details if asked.
4. If server unreachable or offline → Tesseract.js fallback, speak raw text, say "Offline mode, may be less accurate."

### 6.9 `modes/FindWashroom` (flagship)
State machine: `IDLE → SCANNING → FOUND → GUIDING | NOT_FOUND`.
1. Speak "Scanning for washroom. Slowly turn around."
2. Every ~2 s send a frame to `/api/find` with `target="restroom"`. Response: `{found:boolean, direction:"left|ahead|right|unknown", gender:"men|women|unisex|unknown", confidence:0-1, cue:string}`.
3. If found with confidence ≥ 0.6: "Restroom sign, {gender}, on your {direction}." Vibrate once. Then GUIDING: re-check every 2 s and update ("Still ahead", "Now on your left, very close").
4. After 20 s with nothing: "Not found yet. Try turning more, or move forward and say find washroom again."
5. Must handle common sign variations: text (WC, Toilet, Restroom, Washroom, Gents, Ladies, Men, Women), pictograms, and Hindi/Kannada labels.
6. Limit API call rate: one in-flight request at a time; skip frames while waiting.

### 6.10 `server/`
Endpoints (JSON, base64 image in body, `{image:string(base64 jpeg), lang?:string}`):
- `POST /api/describe` → `{summary:string, objects:[{label,direction,distance}]}`
- `POST /api/read` → `{summary:string, texts:[{text,kind,direction?}]}`
- `POST /api/find` → `{found,direction,gender,confidence,cue}`
- `GET /api/health` → `{ok:true}`

Requirements: validate body size (≤5 MB), CORS restricted to `ALLOWED_ORIGIN`, per-IP rate limit (e.g. 30/min), 10 s timeout, Gemini called with `responseMimeType: application/json` and a response schema; strict try/catch returning `{error}` with a spoken-friendly message; never log images or keys.

### 6.11 Gemini prompts (in `server/src/prompts.ts`)
Common system instruction: *"You assist a blind user. Be concise, factual and spatial. Use left/ahead/right and rough distance. Never invent text you cannot read. If unsure, say so. Output JSON matching the schema."*
- **describe:** list up to 5 most relevant things for safe navigation (doors, stairs, people, furniture, hazards) + one-sentence summary ≤ 20 words.
- **read:** transcribe all legible text, classify, say which side of the frame it is on, translate to `lang` if requested.
- **find:** detect restroom indicators (text or pictogram), return direction and gender indicator.

---

## 7. Spoken output style guide
- ≤ 12 words for normal alerts. Lead with the object, then direction, then distance.
- Examples: "Door ahead." "Chair close, left." "Stop. Person ahead."
- Don't say percentages or technical terms. Say "I'm not sure" for low confidence.
- Always announce mode start and stop.

---

## 8. Team and workflow (3 people)

| Role | Owns | Primary files |
|---|---|---|
| **A: App and Accessibility lead** | App shell, big UI, voice in/out, haptics, i18n, PWA, deploy | `web/src/app`, `components`, `core/*` |
| **B: Vision lead** | Camera, COCO-SSD, spatial logic, announcer, Obstacle + AroundMe modes | `web/src/vision/detector,spatial,announcer`, `modes/ObstacleAlert,AroundMe` |
| **C: AI and Server lead** | Express proxy, Gemini prompts, Read + FindWashroom modes, OCR fallback, demo script and slides | `server/*`, `vision/api,ocr`, `modes/Read,FindWashroom`, `docs/*` |

### Git rules
- `main` is protected: PR required, 1 approval, CI green. Never push directly to `main`.
- Branch naming: `feat/<area>-<short>`, `fix/<short>`, `docs/<short>`. Example: `feat/vision-spatial`.
- Small commits, Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Open PRs early (draft is fine), merge at least **every 45–60 minutes** to avoid big conflicts.
- Stay in your owned folders; if you need to change a shared file (`core/speech.ts` etc.), tell the owner.
- Shared contracts to agree on in the first 20 minutes: `SceneObject` type, server response shapes (section 6.10), `speak()` signature. Put them in `web/src/types.ts` and merge immediately.
- Never commit secrets.

### Milestones (5 hours)
| Time | Goal | Done when |
|---|---|---|
| 0:00–0:30 | Repo, scaffold, CI, contracts, deploy tunnel | All three can run `npm run dev` and see the Start screen on a phone over HTTPS |
| 0:30–1:30 | Shell + speech + camera + detector skeleton + server `/health` and `/describe` | Phone speaks, camera shows, boxes logged, server answers |
| 1:30–3:00 | Spatial + announcer + Obstacle mode; Read mode; FindWashroom v1 | Obstacle alert works on a walk-through; read works on a printed sign |
| 3:00–4:00 | Voice commands, haptics, FindWashroom polish, Hindi/Kannada phrases, offline fallback | Hands-free flow works end to end |
| 4:00–4:30 | Bug bash on real phones, tune thresholds, README, LIMITATIONS | No crashes in 5-min continuous run |
| 4:30–5:00 | Deploy, rehearse demo twice, final slides | Public HTTPS link works |

**Scope rule:** if behind schedule, cut Find Item, Hindi/Kannada, and beeps first. Never cut: Start screen, speech, Obstacle, Read, Washroom.

---

## 9. Quality checklist (Definition of Done)
- [ ] Works on Android Chrome over HTTPS (primary demo device); also tested on iOS Safari if available
- [ ] Rear camera used by default
- [ ] Start button unlocks audio + camera in one tap
- [ ] Every mode can be started and stopped by voice
- [ ] No speech overlap or repeated spam in a 2-minute run
- [ ] Danger alerts interrupt and vibrate
- [ ] Server failure produces a spoken message, not silence
- [ ] No API key in the client bundle or git history
- [ ] `npm run lint && npm run build` pass in CI
- [ ] README has run instructions and a demo GIF/screenshot
- [ ] LIMITATIONS.md is honest and complete

---

## 10. Known limitations (state these in the demo)
- Distance is **estimated from object size**, not measured. Not reliable for exact distances.
- COCO-SSD recognises 80 common classes only; doors and signs rely on the vision LLM.
- Vision LLM calls need internet and add 1–3 s latency; offline mode supports obstacle detection and basic OCR only.
- Low light, motion blur, glare and unusual signs reduce accuracy.
- Speech recognition accuracy varies with noise and accent; Kannada/Hindi support depends on the browser.
- Phone camera only sees forward; no side or ground-level hazard detection (stairs, kerbs, holes).
- **Not a replacement for a white cane or guide dog.** It is a supplementary aid.

**Roadmap (Real-World Impact):** ultrasonic/LiDAR sensor via ESP32 for true distance; wearable chest/glasses mount; indoor landmark maps; on-device small VLM for offline reading; local-language TTS voices; user testing with blind-community organisations.

---

## 11. Demo script (3–4 minutes)
1. 15 s: problem framing (one stat or story, cost of existing devices).
2. Blindfolded teammate opens the link, taps the giant Start button, hears the welcome.
3. "What's around me" → hears chair/person with direction.
4. Walk toward a table/person → "Stop. Table ahead." + vibration.
5. "Read this" on a printed Exit / room sign → hears it.
6. "Find washroom" → turns slowly → "Restroom sign, women, on your left."
7. 20 s: limitations and roadmap (ESP32 sensor, offline VLM).
8. Q&A prep: privacy (frames not stored), cost (any smartphone), why not only an LLM (latency, offline safety).

**Privacy statement:** frames are processed transiently, never stored or logged; only sent to the vision API on explicit user request (Read/Describe/Find).
