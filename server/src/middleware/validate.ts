import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors.js';

type Part = 'body' | 'query' | 'params';

/** Validates a request part with zod and stores the parsed value on res.locals[part]. */
export const validate = (schema: z.ZodType, part: Part = 'body') => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
  }
  res.locals[part] = result.data;
  next();
};
