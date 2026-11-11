import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email().max(120),
  password: z.string().min(6).max(100),
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const searchSchema = z.object({
  from: z.string().trim().min(2),
  to: z.string().trim().min(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});
export const tripIdSchema = z.object({ tripId: z.coerce.number().int().positive() });
export const holdSchema = z.object({ seats: z.array(z.string().regex(/^[A-Z]\d{1,2}$/)).min(1).max(6) });
export const confirmSchema = z.object({
  holdId: z.uuid(),
  contactPhone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  passengers: z
    .array(z.object({
      seatNo: z.string(),
      name: z.string().trim().min(2).max(60),
      age: z.number().int().min(1).max(110),
      gender: z.enum(['M', 'F', 'O']),
    }))
    .min(1)
    .max(6),
});
