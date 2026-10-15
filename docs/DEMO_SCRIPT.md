# SightLine: 4-Minute Hero Demo Script & Judge Q&A Playbook

**Target Audience:** Hackathon Judges (Sustainability & Social Impact Track)  
**Total Running Time:** Exactly 4 minutes (240 seconds)  
**Equipment Ready:** Phone running SightLine PWA over HTTPS, Bluetooth earpiece / speaker, printed exit sign with arrow, water bottle, 100/500 Rupee note, clean plastic bottle or paper cup.

---

## ⏱️ Minute-by-Minute Run Sheet

### [0:00 - 0:30] Hook & Single-Gesture Start
- **Speaker Action:** Tap the giant yellow tactile button on phone screen.
- **Audio Output:** Success chime + *"Welcome to SightLine. I am your spatial navigation assistant. Say around me, read text, find washroom, or help."*
- **Spoken Pitch (15s):**  
  > *"Judges, 285 million visually impaired individuals face constant physical anxiety navigating unfamiliar indoor spaces. SightLine turns any commodity smartphone into an intelligent spatial guide with zero external hardware. Every action is voice-first, accompanied by distinct spatial audio cues."*

---

### [0:30 - 1:00] Scene Awareness & Obstacle Alert (Continuous Safety)
- **Speaker Action:** Say clearly: *"What's in front of me?"*
- **App Behavior:** Speaks *"Looking..."*, captures frame, calls cloud VLM, speaks: *"Open corridor with chairs on your left and a table ahead."*
- **Speaker Action:** Walk forward toward a table/chair.
- **App Behavior:** On-device COCO detector tracks obstacle at 8 FPS. As distance drops below 1.5m, accelerating audio beeps ping rapidly, phone vibrates (`pulseDanger`), and speaker immediately interrupts: *"Stop. Table ahead, close."*
- **Judge Commentary:**  
  > *"Notice that danger alerts instantly preempt speech within 80 milliseconds running 100% on-device."*
- **Plan B Fallback:** If camera view is blocked or too close, tap **Obstacle Alert** button directly to showcase the proximity beeper.

---

### [1:00 - 1:30] 3D Spatial Audio Beacon (Find Object)
- **Speaker Action:** Say: *"Find bottle."*
- **App Behavior:** Speaks *"Scanning for bottle. Turn slowly."* Local COCO detector spots bottle on a desk 45 degrees to the right.
- **Audio Output:** Plays target-found earcon + begins spatial audio beacon panning directly to the right ear. As speaker pivots toward the bottle, the audio centers.
- **App Behavior:** At 0.8m, announces: *"Bottle ahead, very close."* -> *"You have arrived."* Beacon stops.
- **Judge Commentary:**  
  > *"We use Web Audio HRTF stereo panning and distance gain so the user simply walks toward the sound."*
- **Plan B Fallback:** If lighting is dim, tap **Find Washroom** to showcase the generic destination state machine with server VLM fallback.

---

### [1:30 - 2:15] Sign Reading with Directional Fusion
- **Speaker Action:** Point camera at printed sign (*"EXIT ➡️"*). Say: *"Read this."*
- **App Behavior:** Speaks *"Reading..."*, fuses OCR text and arrow symbol: *"Exit, arrow points right."*
- **Speaker Action:** Say: *"More."*
- **App Behavior:** Reads secondary metadata: *"Emergency fire exit door."*
- **Judge Commentary:**  
  > *"A visually impaired person doesn't just need the word 'Exit'—they need to know which way to walk. SightLine fuses text with directional arrows."*
- **Plan B Fallback:** If internet is cut, client-side Tesseract.js runs offline and extracts text directly in-browser.

---

### [2:15 - 3:00] Venue Navigation & Checkpoint Verification
- **Speaker Action:** Say: *"Take me to the washroom."*
- **App Behavior:** Looks up AMC College pre-mapped pack. Speaks: *"Starting route to Washroom Ground Floor. Step 1: Walk straight about 20 steps."*
- **Speaker Action:** Take 8–10 steps forward. Step counter registers motion. Heading indicator tracks hallway orientation.
- **App Behavior:** Prompts: *"Turn left at corridor intersection."* Compass verifies turn with live nudges (*"Good, straight ahead."*).
- **Speaker Action:** Point camera at washroom door sign (`WC GENTS`). Tap or say *"Next"*.
- **App Behavior:** Scans sign, confirms checkpoint: Plays found earcon + *"Washroom sign detected. You have arrived."*
- **Plan B Fallback:** If indoor compass jitters due to structural steel, tap *"Next Step"* manually; progress is never blocked by sensors.

---

### [3:00 - 3:30] Quick Shots: Currency, Waste Sorting & Label Safety
- **Currency Shot:** Flash a ₹500 banknote. Say: *"Currency."* -> Speaks *"Five hundred rupee note."*
- **Waste Shot:** Flash a plastic cup. Say: *"Waste."* -> Plays success chime + *"Plastic cup. Dry waste, blue bin."* (Sustainability track impact).
- **Label Shot:** Flash a medicine box. Speaks product name, expiry, allergens, and safety disclaimer: *"Please verify medicine details with a person."*
- **Plan B Fallback:** If folded note is blurry, show how SightLine refuses to guess (*"I can't tell, hold note flat and closer"*).

---

### [3:30 - 4:00] Emergency SOS, Triple-Tap & Roadmap
- **Speaker Action:** Triple-tap the screen (or tap Emergency SOS button).
- **App Behavior:** Gathers GPS + visual surroundings description: *"I need help. My location: maps.google.com/?q=... Around me: 1st floor corridor near Seminar Hall."* Shows WhatsApp and SMS dispatch buttons.
- **Roadmap & Closing (30s):**  
  > *"SightLine is built with strict privacy: images are never stored or logged. Our production roadmap includes: (1) ESP32 ultrasonic belt clip for 360-degree glass detection, (2) crowdsourced open venue packs for public hospitals and metro stations, and (3) on-device sub-2B vision models as WebGPU matures. Thank you!"*

---

## 🛡️ Judge Q&A Preparation Playbook

### Q1: How do you protect user privacy?
> *"No images are ever stored in localStorage, IndexedDB, or the cloud server. Frames sent to `/api/analyze` are processed in ephemeral memory and discarded immediately after response generation. We explicitly disallow face identification, person tracking, or biometric logging."*

### Q2: Why use a hybrid architecture (On-device COCO + Cloud Gemini VLM)?
> *"Safety-critical alerts cannot tolerate a 2-second cloud roundtrip. On-device MobileNetV2 runs at ~8 FPS with sub-80ms latency for obstacle collisions. For complex semantic tasks—like reading arrows, identifying crumpled currency, or parsing medicine ingredients—we leverage Gemini 2.5 Flash."*

### Q3: Why a pre-mapped venue pack instead of indoor SLAM or beacons?
> *"Hardware BLE beacons cost thousands of dollars per building and require battery maintenance. True visual SLAM melts phone batteries and drifts within minutes. Pre-mapped venue packs require just 30 minutes of walking with a smartphone to map a college or clinic, combined with live visual checkpoint verification."*

### Q4: How does it handle poor internet or cell blackouts?
> *"On network drop, SightLine instantly announces: 'Offline. Obstacle detection still works.' Real-time collision warning continues via COCO-SSD, sign reading falls back to client-side Tesseract.js, and venue navigation operates completely offline with cached route JSON."*

### Q5: What is the cost per active user?
> *"Because high-frequency obstacle detection is 100% on-device and free, cloud VLM calls occur only on explicit user request (e.g. reading a sign or identifying a note). At Gemini Flash pricing, an entire day of active indoor navigation costs less than ₹2 ($0.02) per user."*
