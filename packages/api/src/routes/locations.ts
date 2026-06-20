import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { standardLimiter } from '../middleware/rateLimiter';
import {
  CameraType,
  LocationStatus,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@flockgps/shared';

export const locationsRouter = Router();
locationsRouter.use(standardLimiter);

// ─── GET /api/v1/locations ────────────────────────────────────────────────────
// Fetch locations within a bounding box (for map viewport)
const boundsSchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  west: z.coerce.number().min(-180).max(180),
  status: z.nativeEnum(LocationStatus).optional(),
  cameraType: z.nativeEnum(CameraType).optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

locationsRouter.get('/', async (req, res) => {
  try {
    const params = boundsSchema.safeParse(req.query);
    if (!params.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: params.error.flatten().fieldErrors,
      });
    }

    const { north, south, east, west, status, cameraType, minConfidence, limit } = params.data;

    const where: Record<string, unknown> = {
      isActive: true,
      lat: { gte: south, lte: north },
      lng: { gte: west, lte: east },
    };

    if (status) where.status = status;
    if (cameraType) where.cameraType = cameraType;
    if (minConfidence !== undefined) where.confidenceScore = { gte: minConfidence };

    const locations = await prisma.cameraLocation.findMany({
      where,
      select: {
        id: true,
        lat: true,
        lng: true,
        status: true,
        cameraType: true,
        confidenceScore: true,
        city: true,
        state: true,
      },
      take: limit,
      orderBy: { confidenceScore: 'desc' },
    });

    return res.json({
      success: true,
      data: locations,
      count: locations.length,
    });
  } catch (err) {
    console.error('[GET /locations]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── GET /api/v1/locations/radius ─────────────────────────────────────────────
// Radius-based query using PostGIS
const radiusSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMiles: z.coerce.number().min(0.1).max(50).default(5),
  status: z.nativeEnum(LocationStatus).optional(),
  cameraType: z.nativeEnum(CameraType).optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().min(0).default(0),
});

locationsRouter.get('/radius', async (req, res) => {
  try {
    const params = radiusSchema.safeParse(req.query);
    if (!params.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: params.error.flatten().fieldErrors,
      });
    }

    const { lat, lng, radiusMiles, status, cameraType, minConfidence, limit, offset } = params.data;
    const radiusMeters = radiusMiles * 1609.34;

    // PostGIS radius query
    const whereClause = `
      is_active = true
      AND ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ${status ? `AND status = '${status}'` : ''}
      ${cameraType ? `AND camera_type = '${cameraType}'` : ''}
      ${minConfidence !== undefined ? `AND confidence_score >= ${minConfidence}` : ''}
    `;

    const [locations, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<unknown[]>(`
        SELECT
          id, lat, lng, status, camera_type as "cameraType",
          confidence_score as "confidenceScore", city, state,
          ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1609.34 as distance_miles
        FROM camera_locations
        WHERE ${whereClause}
        ORDER BY distance_miles ASC
        LIMIT $4 OFFSET $5
      `, lng, lat, radiusMeters, limit, offset),
      prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM camera_locations WHERE ${whereClause}
      `, lng, lat, radiusMeters),
    ]);

    return res.json({
      success: true,
      data: locations,
      total: Number(countResult[0].count),
      limit,
      offset,
      center: { lat, lng },
      radiusMiles,
    });
  } catch (err) {
    console.error('[GET /locations/radius]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── GET /api/v1/locations/:id ────────────────────────────────────────────────
locationsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.cameraLocation.findFirst({
      where: { id, isActive: true },
    });

    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    return res.json({ success: true, data: location });
  } catch (err) {
    console.error('[GET /locations/:id]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
