import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '../lib/prisma';
import { submitLimiter } from '../middleware/rateLimiter';
import { CameraType } from '@flockgps/shared';

export const submitRouter = Router();
submitRouter.use(submitLimiter);

const submitSchema = z.object({
  lat: z.number().min(24).max(50),    // Continental US bounds
  lng: z.number().min(-125).max(-66),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().regex(/^\d{5}$/).optional(),
  cameraType: z.nativeEnum(CameraType).default(CameraType.UNKNOWN),
  description: z.string().max(500).optional(),
  captchaToken: z.string().optional(), // Validate server-side if using hCaptcha/Turnstile
});

// ─── POST /api/v1/submit ──────────────────────────────────────────────────────
submitRouter.post('/', async (req, res) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission data',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { lat, lng, address, city, state, zipCode, cameraType, description } = parsed.data;

    // Generate anonymous submitter hash
    const submitterHash = createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent'] || ''}`)
      .digest('hex')
      .slice(0, 16);

    // Deduplication check — reject if duplicate within 30 meters
    const nearby = await prisma.$queryRawUnsafe<{ id: string; distance_m: number }[]>(`
      SELECT id, ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_m
      FROM camera_locations
      WHERE is_active = true
        AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          30
        )
      LIMIT 1
    `, lng, lat);

    if (nearby.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A location already exists within 30 meters of this point.',
        existingId: nearby[0].id,
      });
    }

    // Calculate initial confidence score
    let confidence = 30; // base for user-submitted
    if (address) confidence += 10;
    if (city && state) confidence += 10;
    if (description && description.length > 20) confidence += 5;

    const location = await prisma.cameraLocation.create({
      data: {
        lat,
        lng,
        address,
        city,
        state,
        zipCode,
        cameraType,
        description,
        confidenceScore: Math.min(confidence, 60), // cap new submissions at 60
        submittedBy: submitterHash,
        status: 'unverified',
        sourceType: 'user_submitted',
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        status: true,
        cameraType: true,
        confidenceScore: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Location submitted successfully. It will be visible after review.',
      data: location,
    });
  } catch (err) {
    console.error('[POST /submit]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── POST /api/v1/submit/csv ──────────────────────────────────────────────────
// Bulk import via JSON array (admin use)
submitRouter.post('/bulk', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.API_SECRET) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const { locations } = req.body as { locations: unknown[] };
  if (!Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({ success: false, error: 'locations array required' });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const loc of locations.slice(0, 500)) {
    try {
      const parsed = submitSchema.safeParse(loc);
      if (!parsed.success) { skipped++; continue; }

      await prisma.cameraLocation.create({
        data: {
          ...parsed.data,
          sourceType: 'csv_import',
          submittedBy: 'bulk-import',
          confidenceScore: 40,
        },
      });
      imported++;
    } catch {
      errors.push(String(loc));
      skipped++;
    }
  }

  return res.json({
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, 10),
  });
});
