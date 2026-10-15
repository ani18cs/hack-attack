# SightLine 👁️🔊

> **AI-Powered Environmental Awareness & Navigation for the Visually Impaired**  
> Built for HackAttack 2026 (Sustainability & Social Impact Track).

SightLine is a voice-first Progressive Web App (PWA) designed to turn any standard smartphone into a continuous sensory assistant. By pairing fast on-device computer vision with Google Gemini vision intelligence, SightLine translates the visual world into clear, spatial speech and haptic feedback.

---

## 🌟 Key Features

1. **Around Me (Object Awareness)**: Real-time on-device spatial announcements (direction + distance).
2. **Read (Signs & Text)**: High-accuracy OCR for exit signs, room names, and warnings via Gemini Vision with offline Tesseract.js fallback.
3. **Find Washroom (Flagship Demo)**: Scans surroundings for restroom signs, gender pictograms, and guides left/right/ahead.
4. **Obstacle Alert (Safety Guard)**: Low-latency warning for fast-approaching or hazardous objects in the walking path with urgent haptics.
5. **Universal Accessibility**: Giant 56px+ tactile buttons, high-contrast WCAG AA+ styling, and 100% voice-driven controls.

---

## 🛠️ Architecture & Tech Stack

```
Phone Browser (PWA)
 ├─ Camera Stream (rear camera)
 ├─ Local Detection: TensorFlow.js COCO-SSD (~10 FPS on-device)
 ├─ Spatial Engine: Bounding Box → Direction + Distance + Danger Calculation
 ├─ Speech Out: SpeechSynthesis Priority Queue (Interrupt on Danger)
 ├─ Speech In: Web Speech Recognition Intent Router
 ├─ Haptics: Vibration API ([200, 100, 200] ms danger pulse)
 └─ On-Demand Server Proxy ──► Express API (Node.js/TypeScript)
                                └─► Google Gemini 2.5 Flash Vision Model
```

- **Frontend**: Vite, React 19, TypeScript, Tailwind CSS, `vite-plugin-pwa`
- **Vision & ML**: `@tensorflow/tfjs`, `@tensorflow-models/coco-ssd`, `tesseract.js`
- **Backend Proxy**: Node 20+, Express, `@google/genai`, TypeScript (`tsx`)
- **Safety**: API keys are isolated exclusively to the backend proxy; images are processed in-memory and never persisted.

---

## 🚀 Quickstart

### Prerequisites
- Node.js 20+
- npm 10+
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Installation
```bash
git clone https://github.com/[MY_GITHUB_USERNAME]/sightline.git
cd sightline
npm install
```

### 2. Configure Environment Variables
```bash
# Backend setup
cp server/.env.example server/.env
# Edit server/.env and add your GEMINI_API_KEY

# Frontend setup
cp web/.env.example web/.env
```

### 3. Run Development Servers
```bash
npm run dev
```
- Web App: `http://localhost:5173`
- Server Proxy: `http://localhost:8787`

### 4. Testing on Mobile Device (HTTPS Required)
Mobile camera and microphone require an HTTPS context. Expose the frontend using Cloudflare Tunnel or ngrok:
```bash
# Cloudflare Tunnel
cloudflared tunnel --url http://localhost:5173
```
Scan the resulting HTTPS URL on your phone's browser.

---

## 📜 Team & Module Ownership

| Role | Lead | Focus |
|---|---|---|
| **Role A** | App & Accessibility | App Shell, Giant UI, Speech Queue, Voice Intent Router, Haptics, PWA |
| **Role B** | Vision | Camera, COCO-SSD, Spatial Calculation, Announcer Cooldown, Obstacle Alert |
| **Role C** | AI & Server | Express Proxy, Gemini Prompts & Schemas, Read Mode, Find Washroom |

---

## ⚠️ Important Note
*SightLine is designed as a supplementary navigational and environmental awareness aid. It does not replace a white cane or guide dog.*
