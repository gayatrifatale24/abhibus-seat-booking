export type BusType = 'SLEEPER' | 'SEATER';
export type SeatKind = 'SEATER' | 'SLEEPER';
export type Deck = 'LOWER' | 'UPPER';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface User { id: number; name: string; email: string; passwordHash: string }
export interface Trip {
  id: number;
  operator: string;
  busType: BusType;
  busName: string;
  fromCity: string;
  toCity: string;
  travelDate: string; // YYYY-MM-DD (IST)
  departure: string; // ISO with +05:30
  arrival: string;
  durationMins: number;
  baseFare: number;
  amenities: string[];
  rating: number;
  boardingPoint: string;
  droppingPoint: string;
}
export interface Seat {
  tripId: number;
  seatNo: string;
  deck: Deck;
  row: number;
  col: number;
  kind: SeatKind;
  fare: number;
  ladiesOnly: boolean;
}
export interface SeatView extends Seat { status: SeatStatus; heldByYou: boolean }
export interface Hold { holdId: string; tripId: number; userId: number; seats: string[]; expiresAt: number }
export interface Passenger { seatNo: string; name: string; age: number; gender: 'M' | 'F' | 'O' }
export interface Booking {
  id: string;
  tripId: number;
  userId: number;
  status: 'CONFIRMED' | 'CANCELLED';
  seats: string[];
  passengers: Passenger[];
  totalFare: number;
  contactPhone: string;
  createdAt: number;
  cancelledAt: number | null;
}
