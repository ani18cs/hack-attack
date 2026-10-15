# Agent Instructions for AndhaDhun

Welcome, agent! You are working on **AndhaDhun**, an AI-powered environmental awareness and navigation PWA for the visually impaired.

## Core Directives

1. **Read Source of Truth First**: Always read `docs/KNOWLEDGE_BASE.md` before generating or modifying code. It defines architecture, stack, schemas, and non-goals.
2. **Follow Module Ownership**:
   - **Role A (App/A11y)**: `web/src/app`, `components`, `core/*`
   - **Role B (Vision)**: `web/src/vision/detector,spatial,announcer`, `modes/ObstacleAlert,AroundMe`
   - **Role C (AI/Server)**: `server/*`, `vision/api,ocr`, `modes/Read,FindWashroom`, `docs/*`
   - Work strictly within your assigned branch and module scope.
3. **Git & PR Rules**:
   - Never push directly to `main`. Work on feature branches (`feat/app-shell`, `feat/vision-spatial`, `feat/server-gemini`).
   - Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
   - Merge frequently (every 45–60 minutes).
4. **Security & Secrets**:
   - NEVER commit `.env` files or API keys. Only commit `.env.example`.
   - Never expose `GEMINI_API_KEY` to the client browser bundle. All vision LLM calls route through `server/`.
5. **Accessibility & Speech Output Style**:
   - Voice-first: every action must have a voice command and a large tactile button.
   - Keep spoken phrases short (<= 12 words). Format: Object -> Direction -> Distance (e.g., "Door ahead.", "Chair close, left.").
   - Danger interrupts everything and triggers vibration.
   - Do not hallucinate or state technical statistics; state honest uncertainty ("I'm not sure").
