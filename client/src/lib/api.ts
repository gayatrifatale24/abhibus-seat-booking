import type { Booking, Hold, Passenger, TripDetails, TripSummary, User } from '../types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

let token: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('ab_token') : null;
export const setToken = (t: string | null) => {
  token = t;
  if (t) localStorage.setItem('ab_token', t);
  else localStorage.removeItem('ab_token');
};
export const getToken = () => token;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'HTTP_ERROR', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  login: (email: string, password: string) => request<{ token: string; user: User }>('/auth/login', json('POST', { email, password })),
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/register', json('POST', { name, email, password })),
  me: () => request<{ user: User }>('/auth/me'),
  cities: () => request<{ cities: string[]; routes: { fromCity: string; toCity: string }[] }>('/cities'),
  search: (from: string, to: string, date: string) =>
    request<{ trips: TripSummary[] }>(`/trips/search?${new URLSearchParams({ from, to, date })}`),
  trip: (id: number) => request<TripDetails>(`/trips/${id}`),
  hold: (tripId: number, seats: string[]) => request<Hold>(`/trips/${tripId}/holds`, json('POST', { seats })),
  release: (holdId: string) => request<{ released: string[] }>(`/holds/${holdId}`, json('DELETE')),
  confirm: (holdId: string, passengers: Passenger[], contactPhone: string) =>
    request<Booking>('/bookings', json('POST', { holdId, passengers, contactPhone })),
  bookings: () => request<{ bookings: Booking[] }>('/bookings'),
  cancel: (id: string) => request<Booking>(`/bookings/${id}/cancel`, json('POST')),
};
