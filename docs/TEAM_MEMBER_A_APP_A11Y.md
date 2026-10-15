# 📱 Team Member A: App & Accessibility Lead

> **Assigned to:** Team Member A (Repo Owner / App Lead)  
> **Role Scope:** App Shell, Touch Targets, Voice Commands, Speech Priority Queue, Multilingual Support (Sarvam AI), Haptics, PWA Configuration, and Deployment.  
> **Working Branch:** `feat/app-shell`  
> **Primary Directory Ownership:** `web/src/app/`, `web/src/components/`, `web/src/core/`

---

## 1. Quickstart & Machine Setup

Run these commands in your terminal to set up the project:

```bash
# 1. Clone repository
git clone https://github.com/ani18cs/hack-attack.git
cd hack-attack

# 2. Switch to your feature branch
git checkout feat/app-shell

# 3. Install dependencies
npm install

# 4. Set up environment variables
cp server/.env.example server/.env
cp web/.env.example web/.env
```
*(Ask the repo owner for the `GEMINI_API_KEY` and `SARVAM_API_KEY` to populate `server/.env`).*

```bash
# 5. Start dev servers (Web on 5173, Server on 8787)
npm run dev
```

---

## 2. Your Module Ownership

### Files You OWN (Only you edit these):
- `web/src/app/*` (`App.tsx`, app state, mode navigation, high-contrast layouts)
- `web/src/components/*` (`BigButton.tsx`, `ModeScreen.tsx`, `StatusBanner.tsx`)
- `web/src/core/*` (`speech.ts`, `voice.ts`, `haptics.ts`, `i18n.ts`, `camera.ts`)
- `web/vite.config.ts` & `web/index.html` (PWA manifest, viewport, icons)

### Files You MUST NOT Edit:
- `web/src/vision/*` (Owned by Team Member B)
- `web/src/modes/*` (Shared — see coordination notes below)
- `server/*` (Owned by Team Member C)

---

## 3. What Was Built in Milestone 1

1. **Giant Start Screen:** One fullscreen high-contrast button (56px+ touch target) that unlocks mobile browser audio/camera permissions on tap.
2. **Speech Priority Queue (`web/src/core/speech.ts`):**
   - `danger`: Halts any active utterance or audio immediately and speaks danger alert.
   - `normal`: Queues up to 3 announcements; drops oldest if overloaded.
   - `low`: Spoken only if completely idle (e.g., button hover/focus).
   - **Sarvam AI Indic Audio Integration:** Streams natural Hindi/Kannada voices via `/api/tts` with immediate fallback to native `SpeechSynthesis`.
3. **Continuous Voice Recognition & Intent Router (`web/src/core/voice.ts`):**
   - Web Speech API continuous recognition with auto-restart.
   - Matches voice commands in English, Hindi, and Kannada.
   - Dispatches: `AROUND_ME`, `READ`, `FIND_WASHROOM`, `OBSTACLE_ON`, `OBSTACLE_OFF`, `STOP`, `HELP`, `LANG_EN`, `LANG_HI`, `LANG_KN`.
4. **Haptics (`web/src/core/haptics.ts`):**
   - `pulseInfo()`: Short 80ms pulse for status changes.
   - `pulseConfirm()`: Double pulse `[100, 50, 100]` for mode changes.
   - `pulseDanger()`: Urgent pattern `[200, 100, 200]` for immediate hazards.
5. **Multilingual Switcher:** Tactile header buttons (English / हिंदी / ಕನ್ನಡ) + voice commands.

---

## 4. What You Need to Do Next (Milestones 2, 3 & 4)

### Task A1: Blindfold & Audio-Only UX Polish
- **Requirement:** A blindfolded person must be able to use the app with zero visual feedback.
- Every state transition must speak:
  - When switching modes: Speak confirmation immediately (e.g., *"Starting Read mode. Point camera at sign."*).
  - When leaving a mode: Speak *"Stopped."*
  - When returning to main menu: Speak the active mode list if requested by saying *"Help"*.
- Test TalkBack (Android) and VoiceOver (iOS) compatibility: ensure all interactive elements have descriptive `aria-label`s.

### Task A2: PWA Offline Support & Mobile Icons
- Configure `web/public/` with high-contrast app icons (`pwa-192x192.png`, `pwa-512x512.png`).
- Ensure `vite-plugin-pwa` precaches the core bundle so obstacle alerts and speech synthesis work offline without Wi-Fi.

### Task A3: Ambient Proximity Audio Beep (Stretch Goal)
- In `web/src/core/speech.ts` or a new `web/src/core/audioCues.ts`:
- Implement a synthetic Web Audio API oscillator beep for obstacle proximity.
- As an object gets closer, increase the beep frequency/repetition rate.

### Task A4: Deployment to Vercel / Netlify
- Build the production web bundle: `npm run build --workspace=web`.
- Deploy the frontend to Vercel/Netlify for the final live hackathon demo.
- Ensure the production URL points `VITE_API_BASE` to Team Member C's deployed server proxy.

---

## 5. Git Workflow & How to Push

Follow these steps for every feature or fix:

```bash
# 1. Ensure you are on your branch
git checkout feat/app-shell

# 2. Pull latest changes from main before starting new work
git fetch origin
git rebase origin/main

# 3. Make small, focused edits in your owned files

# 4. Verify tests, type check, and build pass
npm run test --workspace=web
npm run lint --workspace=web
npm run build --workspace=web

# 5. Stage and commit using Conventional Commits
git add .
git commit -m "feat(a11y): enhance talkback labels and sound cues"

# 6. Push to GitHub
git push origin feat/app-shell
```

### Opening a Pull Request:
1. Go to: [https://github.com/ani18cs/hack-attack/compare/main...feat/app-shell?expand=1](https://github.com/ani18cs/hack-attack/compare/main...feat/app-shell?expand=1)
2. Title your PR: `feat: app shell, speech, camera, voice`
3. Fill in the PR checklist and request a review from teammates before merging.

---

## 6. How to Test on a Real Mobile Phone (HTTPS)

Because mobile browsers restrict camera and microphone access on non-secure origins, you must test over HTTPS:

```powershell
# In a separate terminal, expose port 5173 with Cloudflare Tunnel:
cloudflared tunnel --url http://localhost:5173
```
- Open the resulting `https://...trycloudflare.com` URL in **Chrome on Android** or **Safari on iOS**.
- Tap the giant **Start SightLine** button.
- Speak commands: *"What is around me"*, *"Find washroom"*, *"हिंदी"*, *"Stop"*.

---

## 7. Instructions to Give to Your Antigravity AI Agent

When opening this workspace in Antigravity IDE, paste this exact prompt to your agent:

> *"I am working as Team Member A (Role A: App & Accessibility Lead) on branch `feat/app-shell`. Read `docs/KNOWLEDGE_BASE.md` and `docs/TEAM_MEMBER_A_APP_A11Y.md`. I own `web/src/app/`, `web/src/components/`, and `web/src/core/`. Do not edit files owned by Role B or Role C. Help me implement [YOUR_TASK_NAME], ensure all linting and vitest tests pass, and commit using Conventional Commits."*
