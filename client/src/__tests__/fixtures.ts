import type { Seat, TripSummary } from '../types';

export const seat = (seatNo: string, over: Partial<Seat> = {}): Seat => ({
  seatNo, deck: 'LOWER', row: 0, col: 0, kind: 'SEATER', fare: 899, ladiesOnly: false, status: 'AVAILABLE', heldByYou: false, ...over,
});

export const trip = (over: Partial<TripSummary> = {}): TripSummary => ({
  id: 1, operator: 'Orange Travels', busType: 'SLEEPER', busName: 'Volvo 9600 A/C Sleeper (2+1)',
  fromCity: 'Hyderabad', toCity: 'Bengaluru', travelDate: '2026-11-12',
  departure: '2026-11-12T21:30:00+05:30', arrival: '2026-11-13T07:15:00+05:30', durationMins: 585,
  baseFare: 1399, amenities: ['WiFi', 'Blanket', 'Water Bottle', 'Charging Point', 'CCTV'], rating: 4.4,
  boardingPoint: 'Ameerpet', droppingPoint: 'Madiwala', totalSeats: 36, availableSeats: 12, minFare: 1399, ...over,
});
