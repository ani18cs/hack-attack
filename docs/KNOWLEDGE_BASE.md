# SightLine — Project Knowledge Base

> Working name: **SightLine**. Voice-first, phone-based assistant that helps visually impaired people perceive and navigate their surroundings.
> This file is the single source of truth for humans and for the AI agents. Read it fully before writing code.

---

## 1. Context

- **Event:** HackAttack, AMC Engineering College (Autonomous), Dept. of CSE (AIML). Track: Sustainability and Social Impact.
- **Problem statement:** *AI-Powered Environmental Awareness and Navigation for the Visually Impaired.* Build a functional prototype that helps visually impaired people perceive, interpret and interact with their surroundings.
- **Build window:** 5 hours. Scope everything to what can be built **and demoed** in that time.
- **Team:** 3 people. Work in parallel on separate feature branches, merge often.
- **Allowed:** open-source libraries, pretrained models, and official cloud APIs.
- **Must do:** clearly communicate capabilities **and limitations**.

### Judging criteria
| Criterion | What we do about it |
|---|---|
| Problem relevance | Target real scenarios: washrooms, signs with arrows, obstacles, objects |
| Functionality | Working live demo on a phone; core features must work reliably |
| Innovation | Hybrid on-device + unified VLM task registry, spatial audio beacon, multilingual voice, zero custom hardware |
| Accessibility | Voice-first, huge touch targets (min 56px), haptics, synthesised earcons, no visual-only feedback |
| Technical execution | Clean modules, real-time COCO-SSD detection, unified `POST /api/analyze` registry, graceful offline fallbacks |
| Real-world impact | Works on any smartphone browser; offline-capable obstacle guard; roadmap to sensors |
| Demonstration | Eyes-closed / blindfold demo, scripted flow, limitations slide, judge diagnostics dashboard |

---

## 2. Product Summary & Scope

A **Progressive Web App** opened on a smartphone. The camera is the sensor; **audio and vibration are the interface**. One core loop: **see → interpret → speak**.

### Core Features (Part 1 Must Work)
1. **Scene Description (`describe`)**: announces key objects with direction and distance; detailed on-demand scene summary <= 25 words.
2. **Sign/Text Reading with Arrow Fusion (`read`)**: transcribes legible text, identifies kind (exit, room, store, warning, direction), and fuses arrows with text (e.g. *"Exit, arrow points right"*).
3. **Real-time Obstacle Alerts with Accelerating Beeps + Vibration (`obstacle_alert`)**: continuous COCO-SSD detection with distance buckets, rapid growth tracking, accelerating proximity earcons, and haptics.
4. **Washroom / Destination Finder (`find`)**: recognizes English/Hindi/Kannada restroom signs, male/female/accessible pictograms, and returns spatial cues and direction.

### Extra Features (Part 2)
- Spatial audio beacon (Web Audio HRTF `PannerNode` with distance scaling)
- Currency reader (`currency`: 10, 20, 50, 100, 200, 500, 2000 INR)
- Waste-bin mode (`waste`: wet, dry, recyclable, hazardous, e-waste + bin hint)
- Label reader (`label`: product name, expiry, allergens, refuse to guess)
- Emergency SOS context (`sos_context`)
- Dedicated hazard scan (`hazard`: stairs, drop-offs, open manholes)
- Find-my-belongings (objects beyond washroom)
- Offline venue map pack & turn-by-turn steps (`web/public/venues/`)
- Judge diagnostics dashboard (hidden triple-tap toggle or voice "dashboard")
- Verbosity modes (`quiet`, `normal`, `detailed`)

### Explicitly OUT of Scope
- Teach-a-landmark via CLIP
- Scene memory & spatial graphs
- Any face identification or biometric tracking
- Any persistent image storage or server telemetry capture

### Safety Posture
- Be completely honest about uncertainty ("I'm not sure" instead of hallucinating).
- Never claim to replace a white cane or guide dog.
- Hazard detection is strictly "best-effort".
- Label reading must refuse to guess if text is blurry or illegible.

---

## 3. Accessibility Principles (Hard Requirements)

1. **Voice-First**: every action reachable by voice command AND by a large tactile button.
2. **Audio feedback for everything**: mode switches, errors, "nothing found", loading cues ("Analyzing scene...").
3. **Haptics** via `navigator.vibrate`: info pulse, found confirmation, rapid danger warning.
4. **Anti-Chatter Rules**: deduplicate per label+direction, re-announce on closer bucket, new direction, or 8s cooldown. Max 3 objects per batch.
5. **Priority Queue for Speech**: `danger` cancels everything and speaks; `normal` queues up to 3 (drops oldest); `low` speaks only when idle.
6. **High-Contrast UI**: WCAG AA+, min 56px touch targets, ARIA live regions.
7. **Short Phrases**: <= 12 words for alerts. Format: `Object -> Direction -> Distance`.
8. **Single-Gesture Start Screen**: giant button unlocks SpeechSynthesis, rear camera, microphone, and iOS motion/orientation permissions in a single tap.

---

## 4. Architecture

Hybrid architecture: local on-device detection for real-time safety + unified Vision LLM server for contextual perception.

```
Phone Browser (PWA, HTTPS)
 ├─ Camera (getUserMedia rear camera, 1024px JPEG)
 ├─ Local detector: TensorFlow.js COCO-SSD (lite_mobilenet_v2) → 5–10 FPS time-gated
 ├─ Spatial engine: box center x → direction ('left' | 'slightly-left' | 'ahead' | 'slightly-right' | 'right')
 │                  area ratio  → distance ('very-close' | 'close' | 'near' | 'far')
 │                  corridor    → danger rule (central 50% + lower path + area growth)
 ├─ 3D Audio Beacon: Web Audio PannerNode (HRTF) + stereo fallback + proximity beeping
 ├─ Speech Out: SpeechSynthesis priority queue with verbosity filtering
 ├─ Voice In: SpeechRecognition continuous listener with fuzzy keyword routing
 ├─ Haptics: navigator.vibrate patterns (info, danger, found)
 ├─ Offline Fallback: Tesseract.js in browser
 └─ On-Demand Requests (One in-flight per task, abort on mode change)
       │
       ▼
 Node/Express Server (server/)
 ├─ GET /api/health → Server status, model, API key checks, mock status
 └─ POST /api/analyze → Unified task registry (Zod validated, 30 req/min/IP limit, 5MB body)
       │
       ▼
 Task Registry (server/src/tasks/)
 ├─ describe        → Up to 5 items + spoken summary <= 25 words
 ├─ read            → Transcribe text, classify kind, fuse directional arrows
 ├─ find            → Detect targets (restrooms, objects), text + pictograms + cue
 ├─ currency, waste, label, hazard, verify_landmark, sos_context (scaffolded presets)
 └─ Gemini wrapper (@google/genai, JSON mode, 10s timeout, 1 retry, zero image/key logging)
```

---

## 5. Repository Layout (Monorepo)

```
sightline/
├─ package.json              # npm workspaces: web, server
├─ docs/
│  ├─ KNOWLEDGE_BASE.md      # Source of truth
│  ├─ DEMO_SCRIPT.md
│  └─ LIMITATIONS.md
├─ web/
│  ├─ src/
│  │  ├─ app/App.tsx         # Full-screen start screen, mode router
│  │  ├─ components/         # BigButton, ModeScreen, StatusBanner, DebugOverlay
│  │  ├─ core/
│  │  │  ├─ camera.ts        # Rear camera stream + frame capture (1024px, q=0.7)
│  │  │  ├─ speech.ts        # Priority queue TTS with verbosity support
│  │  │  ├─ voice.ts         # Voice recognition & fuzzy intent router
│  │  │  ├─ haptics.ts       # Haptic patterns (info, danger, found, error)
│  │  │  ├─ i18n.ts          # Multilingual phrase tables (en, hi, kn)
│  │  │  ├─ earcons.ts       # Synthesised Web Audio sound cues & proximity beeper
│  │  │  ├─ spatialAudio.ts  # HRTF 3D audio beacon with distance scaling
│  │  │  ├─ settings.ts      # LocalStorage settings manager
│  │  │  └─ network.ts       # Online/offline network status listener
│  │  ├─ vision/
│  │  │  ├─ detector.ts      # COCO-SSD loop with time-gating
│  │  │  ├─ spatial.ts       # Pure spatial math, distance buckets, danger rules
│  │  │  ├─ announcer.ts     # Anti-chatter deduplication & batching
│  │  │  ├─ ocr.ts           # Tesseract.js offline fallback
│  │  │  └─ api.ts           # Typed client for POST /api/analyze with aborts
│  │  ├─ modes/              # AroundMe, ObstacleAlert, Read, Find, Currency, Waste, Label, Hazard, Sos, Navigate
│  │  ├─ venue/              # Offline venue packs, loader, navigator, compass, steps
│  │  └─ types.ts            # Shared interface contracts
│  └─ public/venues/         # JSON venue packs
├─ server/
│  ├─ src/
│  │  ├─ index.ts            # Express server entry point
│  │  ├─ gemini.ts           # Client wrapper (JSON mode, 10s timeout, 1 retry)
│  │  ├─ types.ts            # Server-side contract mirror
│  │  ├─ routes/
│  │  │  ├─ analyze.ts       # POST /api/analyze unified route
│  │  │  ├─ health.ts        # GET /api/health route
│  │  │  └─ tts.ts           # Multilingual Sarvam AI proxy
│  │  ├─ tasks/              # registry.ts + task preset handlers
│  │  ├─ config/waste-map.json
│  │  └─ mock/fixtures.ts    # Fixtures for offline dev & test (MOCK_VLM=true)
│  └─ scripts/try-analyze.ts # Local CLI test runner
└─ .github/
   ├─ workflows/ci.yml
   └─ pull_request_template.md
```

---

## 6. Shared Interface Contracts (`web/src/types.ts` & `server/src/types.ts`)

```typescript
export type Direction =
  | 'left'
  | 'slightly-left'
  | 'ahead'
  | 'slightly-right'
  | 'right'
  | 'unknown';

export type DistanceBucket = 'very-close' | 'close' | 'near' | 'far';
export type SpeakPriority = 'danger' | 'normal' | 'low';
export type Verbosity = 'quiet' | 'normal' | 'detailed';

export interface SceneObject {
  label: string;
  score: number;
  direction: Direction;
  distance: DistanceBucket;
  danger: boolean;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export type VisionTask =
  | 'describe'
  | 'read'
  | 'find'
  | 'currency'
  | 'waste'
  | 'label'
  | 'hazard'
  | 'verify_landmark'
  | 'sos_context';

export interface AnalyzeRequest {
  task: VisionTask;
  image: string; // Base64 JPEG data
  lang?: string;
  target?: string;
  context?: any;
}

export interface AnalyzeResponse<T = any> {
  task: VisionTask;
  ok: boolean;
  summary: string; // Spoken text (<= 25 words)
  confidence: number; // 0 to 1
  data: T;
  hazards?: Array<{ type: string; direction: Direction; urgency: 'low' | 'medium' | 'high' }>;
  error?: string;
  latencyMs?: number;
}
```

---

## 7. Team & Role Distribution

| Role | Focus | Primary Directories | Feature Branch |
|---|---|---|---|
| **Role A** (App / A11y Lead) | App shell, big buttons, voice router, speech priority queue, earcons, settings, SOS, venue nav | `web/src/app`, `web/src/components`, `web/src/core/*` | `feat/app-shell` |
| **Role B** (Vision Lead) | COCO-SSD detector, spatial math, danger heuristics, announcer, 3D audio beacon, obstacle alert, judge overlay | `web/src/vision/detector,spatial,announcer`, `web/src/core/spatialAudio.ts`, `web/src/modes/ObstacleAlert,AroundMe` | `feat/vision-core` |
| **Role C** (AI & Server Lead) | Express app, Gemini wrapper, task registry (`describe`, `read`, `find`), offline mock fixtures, OCR fallback | `server/*`, `web/src/vision/api.ts,ocr.ts`, `docs/*` | `feat/server-analyze` |

### Git & Collaboration Directives
1. Never push directly to `main`.
2. Work strictly in feature branches: `feat/app-shell`, `feat/vision-core`, `feat/server-analyze`.
3. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
4. Never commit `.env` or API keys.
5. All PRs require review and passing CI.

---

## 8. Definition of Done (Part 1 Core Baseline)

- [x] Preflight checks pass (Node 20+, npm, git, gh).
- [x] Monorepo scaffolded with npm workspaces (`web`, `server`).
- [x] Unified `POST /api/analyze` endpoint operational with task registry.
- [x] Core tasks (`describe`, `read` with arrow fusion, `find`) implemented.
- [x] Scaffolded tasks (`currency`, `waste`, `label`, `hazard`, `verify_landmark`, `sos_context`) in place with mock fixtures.
- [x] App shell single-gesture start screen unlocks audio, rear camera, mic, and sensors.
- [x] Priority speech queue with verbosity filtering and anti-chatter logic.
- [x] Real-time COCO-SSD detector + pure spatial math tested (15/15 unit tests pass).
- [x] Voice intent router with target extraction tested (5/5 unit tests pass).
- [x] Server task registry and schema validation tested (14/14 unit tests pass).
- [x] Judge diagnostics dashboard overlay operable.
- [x] Full monorepo builds and tests pass cleanly.
