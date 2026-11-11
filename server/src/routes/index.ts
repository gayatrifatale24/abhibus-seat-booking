import { Router } from 'express';
import type { Container } from '../container.js';
import { createControllers } from '../controllers/index.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { confirmSchema, holdSchema, loginSchema, registerSchema, searchSchema, tripIdSchema } from '../schemas.js';

export function createRouter(c: Container) {
  const ctl = createControllers(c);
  const auth = requireAuth(c.auth);
  const r = Router();

  r.get('/health', (_req, res) => res.json({ status: 'ok' }));

  r.post('/auth/register', validate(registerSchema), ctl.auth.register);
  r.post('/auth/login', validate(loginSchema), ctl.auth.login);
  r.get('/auth/me', auth, ctl.auth.me);

  r.get('/cities', ctl.trips.cities);
  r.get('/trips/search', validate(searchSchema, 'query'), ctl.trips.search);
  r.get('/trips/:tripId', optionalAuth(c.auth), validate(tripIdSchema, 'params'), ctl.trips.get);

  r.post('/trips/:tripId/holds', auth, validate(tripIdSchema, 'params'), validate(holdSchema), ctl.holds.create);
  r.delete('/holds/:holdId', auth, ctl.holds.release);

  r.post('/bookings', auth, validate(confirmSchema), ctl.bookings.confirm);
  r.get('/bookings', auth, ctl.bookings.list);
  r.get('/bookings/:bookingId', auth, ctl.bookings.get);
  r.post('/bookings/:bookingId/cancel', auth, ctl.bookings.cancel);

  return r;
}
