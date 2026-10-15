export const SYSTEM_INSTRUCTION = `You assist a blind user. Be concise, factual and spatial. Use left/ahead/right and rough distance. Never invent text you cannot read. If unsure, say so. Output JSON matching the required schema.`;

export const DESCRIBE_PROMPT = (lang = 'en') => `
Analyze this image for a visually impaired user navigating their surroundings.
List up to 5 of the most relevant items for safe navigation (e.g. doors, stairs, pathways, people, furniture, or hazards).
For each item, specify its spatial position (left, ahead, right) and estimated distance bucket ('very close', 'close', 'a few steps away', 'far').
Provide a short one-sentence summary (<= 20 words) describing the overall scene layout.
If language requested is '${lang}', translate the summary appropriately.
`;

export const READ_PROMPT = (lang = 'en') => `
Read all legible text in this image, especially exit signs, room names, warning signs, floor indicators, and directional arrows.
For each detected text:
- transcribe the text accurately
- classify kind as one of: 'exit' | 'room' | 'store' | 'direction' | 'warning' | 'other'
- specify direction relative to frame: 'left' | 'ahead' | 'right'
Provide a concise spoken summary of the signs found.
If language requested is '${lang}', translate the summary if helpful.
`;

export const FIND_PROMPT = (target = 'restroom', lang = 'en') => `
Look carefully for any indicators, signage, arrows, or pictograms for '${target}' (such as restroom, toilet, WC, washroom, male/female symbols, wheelchair accessible icon).
Return:
- found: true if a restroom indicator or sign is clearly visible, else false
- direction: 'left' | 'ahead' | 'right' | 'unknown'
- gender: 'men' | 'women' | 'unisex' | 'unknown'
- confidence: number between 0.0 and 1.0
- cue: short description of the visual cue found (e.g., "blue sign with female pictogram pointing right")
`;
