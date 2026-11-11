import bcrypt from 'bcryptjs';
import type { DB } from './connection.js';
import type { BusType } from '../types.js';
import { addDays, istDate, istIso } from '../utils/time.js';
import { rng } from '../utils/random.js';

interface RouteDef {
  from: string;
  to: string;
  durationMins: number;
  fareSeater: number;
  fareSleeper: number;
  boarding: string[];
  dropping: string[];
}

const ROUTES: RouteDef[] = [
  { from: 'Hyderabad', to: 'Bengaluru', durationMins: 600, fareSeater: 899, fareSleeper: 1399, boarding: ['Ameerpet', 'Kukatpally', 'LB Nagar', 'Miyapur'], dropping: ['Madiwala', 'Majestic', 'Electronic City'] },
  { from: 'Bengaluru', to: 'Hyderabad', durationMins: 600, fareSeater: 899, fareSleeper: 1399, boarding: ['Majestic', 'Madiwala', 'Hebbal'], dropping: ['Kukatpally', 'Ameerpet', 'LB Nagar'] },
  { from: 'Hyderabad', to: 'Vijayawada', durationMins: 330, fareSeater: 549, fareSleeper: 849, boarding: ['MGBS', 'LB Nagar', 'Dilsukhnagar'], dropping: ['Benz Circle', 'Pandit Nehru Bus Station'] },
  { from: 'Vijayawada', to: 'Hyderabad', durationMins: 330, fareSeater: 549, fareSleeper: 849, boarding: ['Benz Circle', 'Pandit Nehru Bus Station'], dropping: ['LB Nagar', 'MGBS', 'Ameerpet'] },
  { from: 'Hyderabad', to: 'Chennai', durationMins: 690, fareSeater: 999, fareSleeper: 1499, boarding: ['Ameerpet', 'Lakdikapul', 'LB Nagar'], dropping: ['Koyambedu', 'Guindy'] },
  { from: 'Hyderabad', to: 'Visakhapatnam', durationMins: 720, fareSeater: 1049, fareSleeper: 1599, boarding: ['Kukatpally', 'Ameerpet', 'LB Nagar'], dropping: ['Dwaraka Bus Station', 'Maddilapalem'] },
  { from: 'Hyderabad', to: 'Tirupati', durationMins: 600, fareSeater: 949, fareSleeper: 1449, boarding: ['Miyapur', 'Ameerpet', 'Lakdikapul'], dropping: ['Tirupati Bus Stand', 'Alipiri'] },
  { from: 'Bengaluru', to: 'Chennai', durationMins: 360, fareSeater: 649, fareSleeper: 999, boarding: ['Majestic', 'Silk Board', 'Electronic City'], dropping: ['Koyambedu', 'Guindy'] },
];

const OPERATORS = [
  { name: 'Orange Travels', rating: 4.4 },
  { name: 'Morning Star Travels', rating: 4.2 },
  { name: 'VRL Travels', rating: 4.3 },
  { name: 'SRS Travels', rating: 4.0 },
  { name: 'Kaveri Travels', rating: 4.1 },
  { name: 'IntrCity SmartBus', rating: 4.5 },
  { name: 'Zingbus', rating: 4.2 },
  { name: 'TGSRTC Lahari', rating: 3.9 },
];

const BUS_NAMES: Record<BusType, string[]> = {
  SLEEPER: ['Volvo 9600 A/C Sleeper (2+1)', 'Bharat Benz A/C Sleeper (2+1)', 'Scania Multi-Axle A/C Sleeper (2+1)'],
  SEATER: ['Volvo Multi-Axle A/C Semi Sleeper (2+2)', 'A/C Seater Pushback (2+2)'],
};

const AMENITIES = ['WiFi', 'Charging Point', 'Water Bottle', 'Blanket', 'Reading Light', 'Live Tracking', 'CCTV', 'Snacks', 'Emergency Contact'];

// Night-heavy departure slots (minutes after midnight IST), as real long-haul inventory is.
const DEPARTURES = [6 * 60, 13 * 60 + 30, 19 * 60 + 45, 21 * 60, 21 * 60 + 45, 22 * 60 + 30, 23 * 60 + 15];

export const DEMO_USER = { name: 'Demo Traveller', email: 'demo@abhibus.test', password: 'demo1234' };

export function seed(db: DB, opts: { days?: number; today?: string; seed?: number } = {}) {
  const days = opts.days ?? 14;
  const today = opts.today ?? istDate();
  const rand = rng(opts.seed ?? 42);

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash) VALUES (?, ?, ?)');
  insertUser.run(DEMO_USER.name, DEMO_USER.email, bcrypt.hashSync(DEMO_USER.password, 8));
  // A system account that owns "already sold" seats so search results look realistic.
  insertUser.run('Other Passengers', 'system@abhibus.test', bcrypt.hashSync(Math.random().toString(36), 4));
  const systemUserId = (db.prepare('SELECT id FROM users WHERE email = ?').get('system@abhibus.test') as { id: number }).id;

  const hasDate = db.prepare('SELECT 1 FROM trips WHERE travel_date = ? LIMIT 1');
  const insertTrip = db.prepare(`INSERT INTO trips (operator, bus_type, bus_name, from_city, to_city, travel_date, departure, arrival,
    duration_mins, base_fare, amenities, rating, boarding_point, dropping_point)
    VALUES (@operator, @busType, @busName, @from, @to, @date, @departure, @arrival, @duration, @fare, @amenities, @rating, @boarding, @dropping)`);
  const insertSeat = db.prepare(`INSERT INTO seats (trip_id, seat_no, deck, row, col, kind, fare, ladies_only)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertBooking = db.prepare(`INSERT INTO bookings (id, trip_id, user_id, status, passengers, total_fare, contact_phone, created_at)
    VALUES (?, ?, ?, 'CONFIRMED', '[]', ?, '0000000000', ?)`);
  const insertBookingSeat = db.prepare('INSERT INTO booking_seats (booking_id, trip_id, seat_no) VALUES (?, ?, ?)');

  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const run = db.transaction(() => {
    let created = 0;
    for (let d = 0; d < days; d++) {
      const date = addDays(today, d);
      if (hasDate.get(date)) continue; // idempotent: only top up missing days
      for (const route of ROUTES) {
        const slots = [...DEPARTURES].sort(() => rand() - 0.5).slice(0, 4 + Math.floor(rand() * 3)).sort((a, b) => a - b);
        for (const dep of slots) {
          const op = pick(OPERATORS);
          const busType: BusType = dep < 19 * 60 ? 'SEATER' : rand() < 0.75 ? 'SLEEPER' : 'SEATER';
          const duration = route.durationMins + Math.round((rand() - 0.5) * 60);
          const fare = (busType === 'SLEEPER' ? route.fareSleeper : route.fareSeater) + Math.round(rand() * 4) * 50;
          const amenities = AMENITIES.filter(() => rand() < 0.55);
          const tripId = Number(
            insertTrip.run({
              operator: op.name,
              busType,
              busName: pick(BUS_NAMES[busType]),
              from: route.from,
              to: route.to,
              date,
              departure: istIso(date, dep),
              arrival: istIso(date, dep + duration),
              duration,
              fare,
              amenities: JSON.stringify(amenities.length ? amenities : ['Charging Point']),
              rating: Math.min(5, Math.round((op.rating + (rand() - 0.5) * 0.4) * 10) / 10),
              boarding: pick(route.boarding),
              dropping: pick(route.dropping),
            }).lastInsertRowid,
          );
          const seatNos = createLayout(tripId, busType, fare, insertSeat);
          // Pre-sell 20-60% of seats.
          const sold = seatNos.filter(() => rand() < 0.2 + rand() * 0.4);
          if (sold.length) {
            const bookingId = `SYS-${tripId}`;
            insertBooking.run(bookingId, tripId, systemUserId, 0, Date.now());
            for (const s of sold) insertBookingSeat.run(bookingId, tripId, s);
          }
          created++;
        }
      }
    }
    return created;
  });
  return run();
}

/**
 * SLEEPER (2+1): lower + upper deck, 6 rows x 3 berths each (L1..L18, U1..U18).
 * SEATER  (2+2): single deck, 10 rows x 4 seats (S1..S40), aisle between col 2 and 3.
 */
function createLayout(tripId: number, busType: BusType, fare: number, insertSeat: { run: (...a: unknown[]) => unknown }) {
  const seatNos: string[] = [];
  if (busType === 'SLEEPER') {
    for (const deck of ['LOWER', 'UPPER'] as const) {
      let n = 1;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 3; col++) {
          const seatNo = `${deck === 'LOWER' ? 'L' : 'U'}${n++}`;
          // Lower berths are priced a little higher, like real operators do.
          const seatFare = deck === 'LOWER' ? fare + 100 : fare;
          insertSeat.run(tripId, seatNo, deck, row, col, 'SLEEPER', seatFare, row === 0 && col === 0 ? 1 : 0);
          seatNos.push(seatNo);
        }
      }
    }
  } else {
    let n = 1;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 4; col++) {
        const seatNo = `S${n++}`;
        const window = col === 0 || col === 3;
        insertSeat.run(tripId, seatNo, 'LOWER', row, col, 'SEATER', window ? fare + 50 : fare, row === 1 && col === 0 ? 1 : 0);
        seatNos.push(seatNo);
      }
    }
  }
  return seatNos;
}
