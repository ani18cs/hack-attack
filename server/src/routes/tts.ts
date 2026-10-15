import { Router, Request, Response } from 'express';

export const ttsRouter = Router();

function normalizeLanguageCode(lang = 'en-IN'): string {
  if (lang.startsWith('hi')) return 'hi-IN';
  if (lang.startsWith('kn')) return 'kn-IN';
  if (lang.startsWith('ta')) return 'ta-IN';
  if (lang.startsWith('te')) return 'te-IN';
  return 'en-IN';
}

// POST /api/tts - Sarvam AI Indic Text-To-Speech
ttsRouter.post('/tts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, lang = 'en-IN' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text string is required for speech synthesis.' });
      return;
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('PLACEHOLDER')) {
      res.status(503).json({ error: 'SARVAM_API_KEY not configured on server.' });
      return;
    }

    const targetLang = normalizeLanguageCode(lang);

    const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        target_language_code: targetLang,
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.warn('Sarvam TTS API returned non-200:', errText);
      res.status(sarvamRes.status).json({ error: errText });
      return;
    }

    const data = await sarvamRes.json() as { audios?: string[] };
    if (!data.audios || data.audios.length === 0) {
      res.status(500).json({ error: 'No audio returned from Sarvam TTS.' });
      return;
    }

    res.json({
      audioBase64: data.audios[0],
      format: 'audio/wav',
      lang: targetLang,
    });
  } catch (error: any) {
    console.error('TTS endpoint error:', error);
    res.status(500).json({ error: error.message || 'TTS generation failed.' });
  }
});

// POST /api/translate - Sarvam AI Indic Translation
ttsRouter.post('/translate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, targetLang = 'hi-IN', sourceLang = 'en-IN' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text string is required for translation.' });
      return;
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'SARVAM_API_KEY not configured on server.' });
      return;
    }

    const sarvamRes = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        input: text.trim(),
        source_language_code: normalizeLanguageCode(sourceLang),
        target_language_code: normalizeLanguageCode(targetLang),
        model: 'sarvam-translate:v1',
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      res.status(sarvamRes.status).json({ error: errText });
      return;
    }

    const data = await sarvamRes.json() as { translated_text?: string };
    res.json({
      translatedText: data.translated_text || text,
    });
  } catch (error: any) {
    console.error('Translation endpoint error:', error);
    res.status(500).json({ error: error.message || 'Translation failed.' });
  }
});
