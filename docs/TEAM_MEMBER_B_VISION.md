# 👁️ Team Member B: Computer Vision & Spatial Lead

> **Assigned to:** Hrishita Shenvi (Team CLOVER Vision Lead)  
> **Role Scope:** Camera Stream Integration, On-Device COCO-SSD Object Detection, Spatial Calculations (Direction/Distance/Danger), Anti-Chatter Announcer, Obstacle Alert Mode, and Continuous Around Me Mode.  
> **Working Branch:** `feat/vision-spatial`  
> **Primary Directory Ownership:** `web/src/vision/detector.ts`, `spatial.ts`, `announcer.ts`, `web/src/modes/ObstacleAlert.tsx`, `web/src/modes/AroundMe.tsx`

---

## 1. Quickstart & Machine Setup

Run these commands in your terminal to set up the project:

```bash
# 1. Clone repository
git clone https://github.com/ani18cs/hack-attack.git
cd hack-attack

# 2. Switch to your feature branch
git checkout feat/vision-spatial

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
```

---

## 2. Your Module Ownership

### Files You OWN (Only you edit these):
- `web/src/vision/detector.ts` (TensorFlow.js COCO-SSD model loader and inference loop)
- `web/src/vision/spatial.ts` & `spatial.test.ts` (Spatial bounding box conversion, direction, distance, danger)
- `web/src/vision/announcer.ts` (Anti-chatter throttling, deduplication, 8s cooldown, 2.5s danger alert cooldown)
- `web/src/modes/ObstacleAlert.tsx` (Continuous hazard detection safety mode)
- `web/src/modes/AroundMe.tsx` (Continuous scene object announcing mode)

### Files You MUST NOT Edit:
- `web/src/app/*` (Owned by Team Member A)
- `web/src/core/*` (Owned by Team Member A)
- `server/*` (Owned by Team Member C)
- `web/src/modes/Read.tsx` & `FindWashroom.tsx` (Owned by Team Member C)

---

## 3. What Was Built in Milestone 1

1. **Spatial Calculations Engine (`web/src/vision/spatial.ts`):**
   - **Direction:** Based on horizontal center `centerX`:
     - `< 0.25`: `"left"`
     - `0.25 - 0.38`: `"slightly left"`
     - `0.38 - 0.62`: `"ahead"`
     - `0.62 - 0.75`: `"slightly right"`
     - `> 0.75`: `"right"`
   - **Distance:** Estimated from normalized bounding box area ratio `(w * h) / (frameW * frameH)`:
     - `> 0.35`: `"very close"`
     - `0.12 - 0.35`: `"close"`
     - `0.03 - 0.12`: `"a few steps away"`
     - `< 0.03`: `"far"` (filtered out from announcements)
   - **Danger / Hazard Rule:** Object in walking corridor (`0.25 <= centerX <= 0.75` and `centerY >= 0.35`) with `area >= 0.22`, OR growing rapidly (>40% across frames).
2. **Comprehensive Unit Tests (`web/src/vision/spatial.test.ts`):**
   - 14 automated Vitest unit tests verifying all boundary conditions, distance thresholds, and obstacle hazard rules.
3. **Detector Loop (`web/src/vision/detector.ts`):**
   - Loads `lite_mobilenet_v2` model once.
   - Throttles detection to 8 FPS to prevent mobile device heating and battery drain.
4. **Anti-Chatter Announcer (`web/src/vision/announcer.ts`):**
   - Batches top 3 closest items.
   - General cooldown of 8 seconds per object label.
   - Danger alerts bypass queue, trigger haptic pattern `[200, 100, 200]`, and speak `"Stop. {label} ahead."` with a 2.5s safety cooldown.

---

## 4. What You Need to Do Next (Milestones 2, 3 & 4)

### Task B1: Connect Live Video Stream to Detector in `ObstacleAlert.tsx`
- In `web/src/modes/ObstacleAlert.tsx`:
  1. Access the active video element from `camera.getVideoElement()`.
  2. Start the detector: `detector.startDetection(videoEl)`.
  3. Subscribe to raw detections: `detector.subscribe(handleDetections)`.
  4. For each detection, run `processSpatialObject(raw, width, height)`.
  5. If `object.danger === true`:
     - Update UI state to show visual red warning `"HAZARD AHEAD"`.
     - Dispatch urgent spoken warning via `speech.speak("Stop. " + object.label + " ahead.", { priority: 'danger' })`.
     - Trigger urgent vibration: `haptics.pulseDanger()`.
  6. Clean up on unmount: `detector.stopDetection()`.

### Task B2: Connect Announcer in `AroundMe.tsx`
- In `web/src/modes/AroundMe.tsx`:
  1. Start detection when the mode mounts.
  2. Map detections to `SceneObject`s.
  3. Pass objects into `announcer.process(objects)`.
  4. Reset announcer state when leaving the mode: `announcer.reset()`.

### Task B3: Visual Debug Canvas for Live Demo
- Add an optional toggleable `<canvas>` overlay showing:
  - Bounding boxes around detected objects.
  - Direction/distance label badges above each box.
  - Central 50% "walking corridor" boundary line in green/red.
- **Why this matters for the judges:** Sighted judges will watch the phone screen while a blindfolded teammate demonstrates navigating obstacles. Seeing the bounding box track the obstacle in real-time builds instant credibility!

### Task B4: Tune Detection Sensitivity on Real Phones
- Test with common indoor obstacles: chairs, backpacks, desks, doors, people walking toward you.
- Calibrate `minScore` (currently `0.55`) and area thresholds so there are zero false alarms for small distant objects.

---

## 5. Git Workflow & How to Push

Follow these steps for every feature or fix:

```bash
# 1. Switch to your feature branch
git checkout feat/vision-spatial

# 2. Rebase with main before starting work
git fetch origin
git rebase origin/main

# 3. Write your vision code and update modes

# 4. Run unit tests and verification
npm run test --workspace=web
npm run lint --workspace=web
npm run build --workspace=web

# 5. Commit using Conventional Commits
git add .
git commit -m "feat(vision): wire real-time camera detections to ObstacleAlert mode"

# 6. Push to GitHub
git push origin feat/vision-spatial
```

### Opening a Pull Request:
1. Go to: [https://github.com/ani18cs/hack-attack/compare/main...feat/vision-spatial?expand=1](https://github.com/ani18cs/hack-attack/compare/main...feat/vision-spatial?expand=1)
2. Title your PR: `feat: vision detector and spatial engine`
3. Request a review from Team Member A before merging into `main`.

---

## 6. How to Test on a Mobile Device (HTTPS)

```powershell
# Start Cloudflare Tunnel:
cloudflared tunnel --url http://localhost:5173
```
- Open on phone.
- Start **Obstacle Alert** mode.
- Walk towards a chair or desk: confirm phone announces *"Stop. Chair ahead."* and vibrates vigorously before you collide with it!

---

## 7. Instructions to Give to Your Antigravity AI Agent

When opening this workspace in Antigravity IDE, paste this prompt to your agent:

> *"I am working as Team Member B (Role B: Computer Vision & Spatial Lead) on branch `feat/vision-spatial`. Read `docs/KNOWLEDGE_BASE.md` and `docs/TEAM_MEMBER_B_VISION.md`. I own `web/src/vision/detector.ts`, `spatial.ts`, `announcer.ts`, `web/src/modes/ObstacleAlert.tsx`, and `web/src/modes/AroundMe.tsx`. Do not edit files owned by Role A or Role C. Help me implement [YOUR_TASK_NAME], run the vitest test suite, and commit using Conventional Commits."*
