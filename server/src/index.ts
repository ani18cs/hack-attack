import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { visionRouter } from './routes/vision.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

// Rate Limiter: max 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Middleware configuration
app.use(limiter);

// CORS configuration supporting localhost & tunnel domains
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // In development or demo mode, allow configured origin and common tunnels
      if (
        origin === ALLOWED_ORIGIN ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.trycloudflare.com') ||
        origin.endsWith('.ngrok-free.app') ||
        origin.endsWith('.ngrok.io')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Body parser with 5MB limit for Base64 image payload
app.use(express.json({ limit: '5mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    hasApiKey: !!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('PLACEHOLDER'),
  });
});

// Vision proxy routes
app.use('/api', visionRouter);

// Global 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[SightLine Server] Running on http://localhost:${PORT}`);
  console.log(`[SightLine Server] Allowed origin: ${ALLOWED_ORIGIN}`);
});
