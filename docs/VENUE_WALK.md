# AndhaDhun Venue Walk Data Collection Protocol

**Venue:** AMC Engineering College, Bengaluru (HackAttack 2026)  
**Target Duration:** ~30 minutes  
**Goal:** Replace `TODO-VERIFY` placeholder values in `web/public/venues/amc-hackattack.json` with ground-truth steps, turns, and sign text.

---

## 1. Preparation Checklist
- [ ] Smartphone with camera and compass (or built-in Notes app)
- [ ] AndhaDhun PWA running on the phone (`npm run dev --workspace=web`)
- [ ] Printed QR tags (or paper labels): `LM-ENTRANCE`, `LM-WASH1`, `LM-HALL`, `LM-CAFE`
- [ ] Tape or blu-tack to place QR tags at chest height (1.2m – 1.4m) near doors

---

## 2. Landmarks to Survey
For each landmark, record:
1. **Identifier (`id`)**
2. **Exact Printed Signage (`signText`)**: All uppercase words clearly visible (e.g. `WC`, `GENTS`, `RESTROOM`, `WELCOME`).
3. **Aliases (`aliases`)**: Common conversational terms a visually impaired user might say (e.g. `toilet`, `loo`, `bathroom`).
4. **Regional Names**: Hindi (`names.hi`) and Kannada (`names.kn`).
5. **QR Code (`qr`)**: Affixed code on doorway.

| Landmark | Location / Door | Exact Signboard Text | QR Tag ID |
| :--- | :--- | :--- | :--- |
| **Main Entrance** | Front foyer glass doors | `WELCOME`, `AMC ENGINEERING` | `LM-ENTRANCE` |
| **Ground Washroom** | Left corridor off main hall | `WC`, `GENTS`, `RESTROOM` | `LM-WASH1` |
| **Hackathon Hall** | Seminar block auditorium | `SEMINAR HALL`, `HACKATTACK` | `LM-HALL` |
| **Cafeteria** | Campus quadrangle / dining block | `CAFETERIA`, `CANTEEN` | `LM-CAFE` |

---

## 3. Route Pacing & Compass Measurement
Stand at the starting landmark facing the walking direction. Walk naturally toward the destination:

1. **Step Count**: Count normal human strides. Always round to nearest 5 steps (e.g. 18 steps -> record 20).
2. **Turn Direction**:
   - `straight`: Continue forward.
   - `left`: 90-degree left turn (`headingChange: -90`).
   - `right`: 90-degree right turn (`headingChange: +90`).
   - `u_turn`: 180-degree turnaround (`headingChange: 180`).
3. **Checkpoints**: At the final approach (10 steps before landmark), assign a checkpoint expecting landmark `id` and `signText`.

### Target Routes to Measure:
1. `entrance` -> `washroom-g`
2. `washroom-g` -> `entrance` (reverse)
3. `entrance` -> `hackathon-hall`

---

## 4. Updating the Venue Pack
1. Open [`web/public/venues/amc-hackattack.json`](file:///a:/hackattack/web/public/venues/amc-hackattack.json).
2. Replace all `TODO-VERIFY` comments with verified step counts and headings.
3. Validate the JSON file:
   ```bash
   npm run venue:validate --workspace=web
   ```
4. Verify tests pass:
   ```bash
   npm run test --workspace=web
   ```

---

## 5. Mobile Acceptance Test (2 Minutes)
1. Open AndhaDhun on phone: Tap **Navigate**.
2. Voice command: *"Take me to the washroom."*
3. Verify:
   - Voice announces: *"Starting route to Washroom Ground Floor. Step 1: Walk straight about 20 steps."*
   - Walking updates the live step counter.
   - Reaching 75% of step count prompts the turn instruction.
   - Checkpoint prompts visual verification; pointing camera at the sign plays the success earcon and speaks *"Washroom sign detected. You have arrived."*
