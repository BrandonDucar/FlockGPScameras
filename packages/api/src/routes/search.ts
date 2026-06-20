import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { searchLimiter } from '../middleware/rateLimiter';
import { CameraType, LocationStatus } from '@flockgps/shared';

export const searchRouter = Router();
searchRouter.use(searchLimiter);

const searchSchema = z.object({
  q: z.string().min(2).max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().regex(/^\d{5}$/).optional(),
  status: z.nativeEnum(LocationStatus).optional(),
  cameraType: z.nativeEnum(CameraType).optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['confidence', 'date', 'relevance']).default('confidence'),
});

// ─── GET /api/v1/search ───────────────────────────────────────────────────────
searchRouter.get('/', async (req, res) => {
  try {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search parameters',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { q, city, state, zipCode, status, cameraType, minConfidence, limit, offset, sortBy } = parsed.data;

    const where: Record<string, unknown> = { isActive: true };

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = state.toUpperCase();
    if (zipCode) where.zipCode = zipCode;
    if (status) where.status = status;
    if (cameraType) where.cameraType = cameraType;
    if (minConfidence !== undefined) where.confidenceScore = { gte: minConfidence };

    // Full-text search on address, city, description
    if (q) {
      where.OR = [
        { address: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { zipCode: { contains: q } },
      ];
    }

    const orderBy =
      sortBy === 'date'
        ? { createdAt: 'desc' as const }
        : sortBy === 'confidence'
        ? { confidenceScore: 'desc' as const }
        : { confidenceScore: 'desc' as const };

    const [locations, total] = await Promise.all([
      prisma.cameraLocation.findMany({
        where,
        select: {
          id: true,
          lat: true,
          lng: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          status: true,
          cameraType: true,
          confidenceScore: true,
          upvotes: true,
          downvotes: true,
          createdAt: true,
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.cameraLocation.count({ where }),
    ]);

    return res.json({
      success: true,
      data: { locations, total, limit, offset, query: q },
    });
  } catch (err) {
    console.error('[GET /search]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── GET /api/v1/search/stats ─────────────────────────────────────────────────
searchRouter.get('/stats', async (_req, res) => {
  try {
    const [total, byStatus, byState] = await Promise.all([
      prisma.cameraLocation.count({ where: { isActive: true } }),
      prisma.cameraLocation.groupBy({
        by: ['status'],
        where: { isActive: true },
        _count: { id: true },
      }),
      prisma.cameraLocation.groupBy({
        by: ['state'],
        where: { isActive: true, state: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.id])),
        topStates: byState.map(s => ({ state: s.state, count: s._count.id })),
      },
    });
  } catch (err) {
    console.error('[GET /search/stats]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
