# SightLine: Honest Limitations & Safety Disclaimers

> [!CAUTION]
> **Primary Safety Notice:** SightLine is an environmental awareness aid. It is **NOT** a certified medical mobility device, a safety-critical guidance system, or a replacement for a white cane, guide dog, or trained human assistant. Users must always continue using their primary mobility tool.

---

## 1. Perception & Detection Boundaries
1. **Distance Estimation via 2D Bounding Boxes & Ground-Plane Geometry:**
   - Single-camera mobile phones lack hardware depth sensors (LiDAR/Time-of-Flight). Distance is an estimate (roughly **±30% to ±50%**) geometrically inferred from bounding box height against standard prior heights, and ground-plane ray angles using `deviceorientation` pitch.
   - Perceived distance depends heavily on phone holding height (chest height vs eye level), phone downward tilt, user posture, and camera focal parameters.
   - All spoken distances honestly include qualifiers like *"about"*, *"less than"*, or *"more than"*. Never rely on estimated distance for life-critical clearance.
2. **Stride and Hand-Span Units are Approximations:**
   - Default stride (0.7m) and hand span (0.19m) lengths—or values derived from user height (`stride ≈ 0.415 * height`, `hand-span ≈ 0.11 * height`)—are population anthropometric rules of thumb.
   - Individual walking pace, terrain, footwear, and arm geometry cause real variation. Users can calibrate stride length via voice command (*"calibrate my stride"*) or switch to metric (*"use metres"*).
3. **Walking Path Corridor & Peripheral Hazards:**
   - To reduce cognitive cognitive load and speech chatter, SightLine prioritizes a forward walking corridor (central 60% of frame, below top 25%).
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
   - When offline, SightLine immediately announces: *"Offline. Obstacle detection still works."* and gracefully degrades to on-device COCO-SSD obstacle tracking and client-side Tesseract.js OCR.
2. **Inference Latency (1.0 – 2.5s):**
   - High-level reasoning passes through Gemini 2.5 Flash over HTTPS. Round-trip latency typically ranges from 900 ms to 2200 ms depending on mobile cellular bandwidth.
   - Real-time safety-critical obstacle collision warnings run locally on-device at ~8 FPS (sub-80ms latency) to ensure instantaneous protection.

---

## 3. Packaging & Medical Label Reading
1. **Zero-Guess Policy on Medicine & Expiry:**
   - If printed expiry dates, active ingredients, or dosages are folded, smudged, tiny, or poorly lit, SightLine marks `legible: false` and explicitly announces: *"I can't read that clearly. Please ask someone to check, especially the expiry date."*
   - For all identified medicines, SightLine appends: *"Please verify medicine details with a person."* SightLine will never hallucinate or extrapolate medical dosage.

---

## 4. Emergency SOS Dispatch
1. **User Action Requirement in Browser:**
   - Modern mobile operating systems (iOS and Android) and browser security sandboxes prohibit web applications from sending background SMS messages or automated WhatsApp dispatches without explicit user physical input.
   - SightLine automatically acquires high-accuracy GPS coordinates, queries the camera for immediate visual environmental context (e.g. *"Corridor near Room 204"*), and generates pre-filled links to `https://wa.me/{number}` and `sms:{number}`. The user must tap "Send" in their native messaging app.

---

## 5. Venue Navigation & Dead Reckoning
1. **Approximate Indoor Pedometer & Compass:**
   - SightLine's venue navigator uses pre-mapped route packs (`amc-hackattack.json`) combined with step counting and compass headings.
   - It is not indoor GPS, ultra-wideband (UWB), or SLAM positioning. Step lengths vary between people; all guidance is phrased honestly as *"about N steps"*.
   - Magnetic compass sensors inside concrete-and-steel college buildings can experience magnetic interference; turn instructions tolerate +/- 30 degrees and never block progress.

---

## 6. Speech & Audio Recognition
1. **Acoustic Environment & Accents:**
   - The Web Speech Recognition API is subject to ambient noise in crowded hackathon halls. Users can always tap the tactile 56px+ screen buttons as an instant physical alternative.
2. **Regional Language Synthesis:**
   - Local-language voices (Hindi `hi-IN` and Kannada `kn-IN`) rely on voices installed on the host phone. If absent, SightLine announces the missing voice and falls back to Indian English with regional terminology.
