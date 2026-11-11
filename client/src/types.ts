export type BusType = 'SLEEPER' | 'SEATER';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface Trip {
  id: number;
  operator: string;
  busType: BusType;
  busName: string;
  fromCity: string;
  toCity: string;
  travelDate: string;
  departure: string;
  arrival: string;
  durationMins: number;
  baseFare: number;
  amenities: string[];
  rating: number;
  boardingPoint: string;
  droppingPoint: string;
}
export interface TripSummary extends Trip { totalSeats: number; availableSeats: number; minFare: number }
export interface Seat {
  seatNo: string;
  deck: 'LOWER' | 'UPPER';
  row: number;
  col: number;
  kind: 'SEATER' | 'SLEEPER';
  fare: number;
  ladiesOnly: boolean;
  status: SeatStatus;
  heldByYou: boolean;
}
export interface Hold { holdId: string; tripId?: number; seats: string[]; expiresAt: number; totalFare?: number }
export interface TripDetails { trip: Trip; seats: Seat[]; myHold: Hold | null }
export interface Passenger { seatNo: string; name: string; age: number; gender: 'M' | 'F' | 'O' }
export interface Booking {
  id: string;
  tripId: number;
  status: 'CONFIRMED' | 'CANCELLED';
  seats: string[];
  passengers: Passenger[];
  totalFare: number;
  contactPhone: string;
  createdAt: number;
  trip: Trip;
  refundAmount?: number;
  refundPercent?: number;
}
export interface User { id: number; name: string; email: string }
export interface SeatsChangedEvent { tripId: number; changes: { seatNo: string; status: SeatStatus }[]; at: number }
