import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '../lib/prisma';
import { standardLimiter } from '../middleware/rateLimiter';

export const verifyRouter = Router();
verifyRouter.use(standardLimiter);

const voteSchema = z.object({
  vote: z.enum(['up', 'down']),
  comment: z.string().max(200).optional(),
});

const reportSchema = z.object({
  reason: z.enum(['inaccurate', 'removed', 'duplicate', 'inappropriate']),
  details: z.string().max(500).optional(),
});

// ─── POST /api/v1/verify/:id/vote ────────────────────────────────────────────
verifyRouter.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = voteSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid vote data' });
    }

    const { vote, comment } = parsed.data;

    const voterHash = createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent'] || ''}`)
      .digest('hex')
      .slice(0, 16);

    // Check location exists
    const location = await prisma.cameraLocation.findFirst({
      where: { id, isActive: true },
      select: { id: true, upvotes: true, downvotes: true, confidenceScore: true, status: true },
    });

    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    // Upsert vote (one per voter per location)
    const existingVote = await prisma.locationVote.findUnique({
      where: { locationId_voterHash: { locationId: id, voterHash } },
    });

    if (existingVote) {
      if (existingVote.vote === vote) {
        return res.status(409).json({ success: false, error: 'You have already voted this way' });
      }
      await prisma.locationVote.update({
        where: { id: existingVote.id },
        data: { vote, comment },
      });
    } else {
      await prisma.locationVote.create({
        data: { locationId: id, voterHash, vote, comment },
      });
    }

    // Recalculate confidence score from all votes
    const votes = await prisma.locationVote.findMany({ where: { locationId: id } });
    const upvotes = votes.filter(v => v.vote === 'up').length;
    const downvotes = votes.filter(v => v.vote === 'down').length;
    const total = upvotes + downvotes;

    // Confidence: base 30 + vote ratio boost up to +50 + volume bonus up to +20
    let newScore = 30;
    if (total > 0) {
      const ratio = upvotes / total;
      newScore += Math.round(ratio * 50);
      newScore += Math.min(total * 2, 20); // volume bonus
    }

    // Auto-verify if high confidence
    const newStatus = newScore >= 75 && location.status === 'unverified'
      ? 'verified'
      : newScore < 25 && total >= 5
      ? 'disputed'
      : location.status;

    await prisma.cameraLocation.update({
      where: { id },
      data: { upvotes, downvotes, confidenceScore: newScore, status: newStatus },
    });

    return res.json({
      success: true,
      message: `Vote recorded`,
      data: { upvotes, downvotes, confidenceScore: newScore, status: newStatus },
    });
  } catch (err) {
    console.error('[POST /verify/:id/vote]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── POST /api/v1/verify/:id/report ──────────────────────────────────────────
verifyRouter.post('/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = reportSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid report data' });
    }

    const location = await prisma.cameraLocation.findFirst({
      where: { id, isActive: true },
    });

    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const reporterHash = createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent'] || ''}`)
      .digest('hex')
      .slice(0, 16);

    await prisma.locationReport.create({
      data: {
        locationId: id,
        reporterHash,
        reason: parsed.data.reason,
        details: parsed.data.details,
      },
    });

    // Auto-flag if report count is high
    const reportCount = await prisma.locationReport.count({ where: { locationId: id } });
    await prisma.cameraLocation.update({
      where: { id },
      data: {
        reportCount,
        status: reportCount >= 5 ? 'disputed' : undefined,
      },
    });

    return res.json({ success: true, message: 'Report submitted. Thank you.' });
  } catch (err) {
    console.error('[POST /verify/:id/report]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
