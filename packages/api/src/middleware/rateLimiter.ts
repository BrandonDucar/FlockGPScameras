import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
const submitMax = parseInt(process.env.SUBMIT_RATE_LIMIT_MAX || '5');

export const standardLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

export const submitLimiter = rateLimit({
  windowMs,
  max: submitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many submissions. Please wait before submitting again.' },
  keyGenerator: (req) => {
    // Rate limit by IP + User-Agent fingerprint
    return `${req.ip}-${req.headers['user-agent']?.slice(0, 50) || 'unknown'}`;
  },
});

export const searchLimiter = rateLimit({
  windowMs: 10000, // 10 seconds
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Search rate limit exceeded.' },
});
