import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error('[Unhandled Error]', err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
}
