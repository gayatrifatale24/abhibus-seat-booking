import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';
import type { AuthService, AuthUser } from '../services/authService.js';

declare module 'express-serve-static-core' {
  interface Request { user?: AuthUser }
}

const bearer = (req: Request) => {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
};

export const requireAuth = (auth: AuthService) => (req: Request, _res: Response, next: NextFunction) => {
  const token = bearer(req);
  if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue'));
  req.user = auth.verify(token);
  next();
};

/** Attaches req.user when a valid token is present but never rejects (used for seat maps). */
export const optionalAuth = (auth: AuthService) => (req: Request, _res: Response, next: NextFunction) => {
  const token = bearer(req);
  if (token) {
    try { req.user = auth.verify(token); } catch { /* treat as anonymous */ }
  }
  next();
};
