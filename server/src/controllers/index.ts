import type { Request, Response } from 'express';
import type { Container } from '../container.js';

/** Thin HTTP adapters: unpack validated input -> call service -> shape response. No business logic here. */
export function createControllers(c: Container) {
  return {
    auth: {
      register: (_req: Request, res: Response) => {
        const { name, email, password } = res.locals.body;
        res.status(201).json(c.auth.register(name, email, password));
      },
      login: (_req: Request, res: Response) => {
        const { email, password } = res.locals.body;
        res.json(c.auth.login(email, password));
      },
      me: (req: Request, res: Response) => res.json({ user: req.user }),
    },
    trips: {
      cities: (_req: Request, res: Response) => res.json({ cities: c.trips.cities(), routes: c.trips.routes() }),
      search: (_req: Request, res: Response) => {
        const { from, to, date } = res.locals.query;
        res.json({ trips: c.trips.search(from, to, date) });
      },
      get: (req: Request, res: Response) => res.json(c.trips.getTrip(res.locals.params.tripId, req.user?.id)),
    },
    holds: {
      create: (req: Request, res: Response) =>
        res.status(201).json(c.holds.holdSeats(req.user!.id, res.locals.params.tripId, res.locals.body.seats)),
      release: (req: Request, res: Response) => res.json(c.holds.releaseHold(req.user!.id, String(req.params.holdId))),
    },
    bookings: {
      confirm: (req: Request, res: Response) => res.status(201).json(c.bookings.confirm(req.user!.id, res.locals.body)),
      list: (req: Request, res: Response) => res.json({ bookings: c.bookings.listMine(req.user!.id) }),
      get: (req: Request, res: Response) => res.json(c.bookings.get(req.user!.id, String(req.params.bookingId))),
      cancel: (req: Request, res: Response) => res.json(c.bookings.cancel(req.user!.id, String(req.params.bookingId))),
    },
  };
}
