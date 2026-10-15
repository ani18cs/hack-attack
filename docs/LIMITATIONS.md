# AndhaDhun: Honest Limitations & Safety Disclaimers

> [!CAUTION]
> **Primary Safety Notice:** AndhaDhun is an environmental awareness aid. It is **NOT** a certified medical mobility device, a safety-critical guidance system, or a replacement for a white cane, guide dog, or trained human assistant. Users must always continue using their primary mobility tool.

---

## 1. Perception & Detection Boundaries
1. **Distance Estimation via 2D Bounding Boxes & Ground-Plane Geometry:**
   - Single-camera mobile phones lack hardware depth sensors (LiDAR/Time-of-Flight). Distance is an estimate (roughly **±30% to ±50%**) geometrically inferred from bounding box height against standard prior heights, and ground-plane ray angles using `deviceorientation` pitch.
   - Perceived distance depends heavily on phone holding height (chest height vs eye level), phone downward tilt, user posture, and camera focal parameters.
   - All spoken distances honestly include qualifiers like *"about"*, *"less than"*, or *"more than"*. Never rely on estimated distance for life-critical clearance.
2. **Stride and Hand-Span Units are Approximations & Specific Product Decisions:**
   - **Hand-span product decision:** `GUIDANCE.units.handSpanMeters` is set to `0.50m` (50 cm). A normal adult hand span (thumb to pinky) is about 18–23 cm; 50 cm is anatomically closer to a human forearm length. If a user physically judges "hand span" with their own hand, they will misjudge distance by approximately 2.5x. The label lives in `GUIDANCE.units.unitNames.handSpan` and can be renamed (e.g. to "forearm") in one line.
   - **Stride product decision:** `GUIDANCE.units.strideMeters` is set to `0.30m` (30 cm). A normal adult walking step is about 60–75 cm; a 30 cm "stride" is closer to one foot length. If a user takes normal walking steps while the app announces "about 8 strides", they will overshoot the target by about 2x. For this reason, `walkStepMeters` (0.60m) is strictly separated as an independent constant used only for pedometer-based venue navigation, with optional calibration.
   - Default stride and hand span lengths can be calibrated or switched to metric (*"use metres"*).
3. **Walking Path Corridor & Peripheral Hazards:**
   - To reduce cognitive cognitive load and speech chatter, AndhaDhun prioritizes a forward walking corridor (central 60% of frame, below top 25%).
   - Side zones only announce imminent collision hazards (objects very close or growing rapidly over consecutive frames). Distant peripheral obstacles outside the walking corridor are intentionally suppressed.
4. **COCO-SSD 80-Class Vocabulary:**
   - On-device real-time detection uses MobileNetV2-COCO-SSD, which is strictly limited to 80 standard categories (e.g. `person`, `chair`, `bottle`, `backpack`, `car`, `cell phone`).
   - Objects outside this vocabulary (such as low curbs, potholes, glass doors, or stairs) cannot be tracked at 8 FPS on-device and rely on periodic cloud VLM scans.
5. **Hazard Scan is Best-Effort:**
   - The cloud hazard scan runs every 6 seconds and reports only clearly visible drop-offs, stairs, or open drains.
   - It cannot guarantee detection of transparent glass doors, thin overhead wires, fast-moving cyclists, or sudden moving hazards.

---

## 2. Cloud VLM & Network Latency
1. **Network Dependency:**
   - Cloud vision tasks (`describe`, `read`, `currency`, `waste`, `label`, `hazard`, `verify_landmark`, `sos_context`) require active internet connectivity.
   - When offline, AndhaDhun immediately announces: *"Offline. Obstacle detection still works."* and gracefully degrades to on-device COCO-SSD obstacle tracking and client-side Tesseract.js OCR.
2. **Inference Latency (1.0 – 2.5s):**
   - High-level reasoning passes through Gemini 2.5 Flash over HTTPS. Round-trip latency typically ranges from 900 ms to 2200 ms depending on mobile cellular bandwidth.
   - Real-time safety-critical obstacle collision warnings run locally on-device at ~8 FPS (sub-80ms latency) to ensure instantaneous protection.

---

## 3. Packaging & Medical Label Reading
1. **Zero-Guess Policy on Medicine & Expiry:**
   - If printed expiry dates, active ingredients, or dosages are folded, smudged, tiny, or poorly lit, AndhaDhun marks `legible: false` and explicitly announces: *"I can't read that clearly. Please ask someone to check, especially the expiry date."*
   - For all identified medicines, AndhaDhun appends: *"Please verify medicine details with a person."* AndhaDhun will never hallucinate or extrapolate medical dosage.

---

## 4. Emergency SOS Dispatch
1. **User Action Requirement in Browser:**
   - Modern mobile operating systems (iOS and Android) and browser security sandboxes prohibit web applications from sending background SMS messages or automated WhatsApp dispatches without explicit user physical input.
   - AndhaDhun automatically acquires high-accuracy GPS coordinates, queries the camera for immediate visual environmental context (e.g. *"Corridor near Room 204"*), and generates pre-filled links to `https://wa.me/{number}` and `sms:{number}`. The user must tap "Send" in their native messaging app.

---

## 5. Venue Navigation & Dead Reckoning
1. **Approximate Indoor Pedometer & Compass:**
   - AndhaDhun's venue navigator uses pre-mapped route packs (`amc-hackattack.json`) combined with step counting and compass headings.
   - It is not indoor GPS, ultra-wideband (UWB), or SLAM positioning. Step lengths vary between people; all guidance is phrased honestly as *"about N steps"*.
   - Magnetic compass sensors inside concrete-and-steel college buildings can experience magnetic interference; turn instructions tolerate +/- 30 degrees and never block progress.

---

## 6. Speech & Audio Recognition
1. **Acoustic Environment & Accents:**
   - The Web Speech Recognition API is subject to ambient noise in crowded hackathon halls. Users can always tap the tactile 56px+ screen buttons as an instant physical alternative.
2. **Regional Language Synthesis:**
   - Local-language voices (Hindi `hi-IN` and Kannada `kn-IN`) rely on voices installed on the host phone. If absent, AndhaDhun announces the missing voice and falls back to Indian English with regional terminology.
