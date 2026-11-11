import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seat } from './fixtures';

// --- mocks: REST client and a fake socket we can push events through ---
const handlers = new Map<string, (...a: unknown[]) => void>();
const fakeSocket = {
  connected: true,
  emit: vi.fn(),
  on: vi.fn((ev: string, fn: (...a: unknown[]) => void) => handlers.set(ev, fn)),
  off: vi.fn((ev: string) => handlers.delete(ev)),
};
vi.mock('../lib/socket', () => ({ getSocket: () => fakeSocket }));

const apiMock = { trip: vi.fn(), hold: vi.fn(), release: vi.fn() };
vi.mock('../lib/api', () => ({ api: apiMock, ApiError: class extends Error {} }));

const { useTripSeats } = await import('../hooks/useTripSeats');

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  apiMock.trip.mockResolvedValue({ trip: { id: 7 }, seats: [seat('S1'), seat('S2'), seat('S3')], myHold: null });
});

describe('useTripSeats', () => {
  it('joins the trip room and applies live seat deltas from other travellers', async () => {
    const { result } = renderHook(() => useTripSeats(7, 1));
    await waitFor(() => expect(result.current.seats).toHaveLength(3));
    expect(fakeSocket.emit).toHaveBeenCalledWith('join:trip', 7);

    act(() => handlers.get('seats:changed')!({ tripId: 7, changes: [{ seatNo: 'S2', status: 'HELD' }], at: 0 }));
    expect(result.current.seats.find((s) => s.seatNo === 'S2')!.status).toBe('HELD');

    // Events for other trips are ignored.
    act(() => handlers.get('seats:changed')!({ tripId: 8, changes: [{ seatNo: 'S1', status: 'BOOKED' }], at: 0 }));
    expect(result.current.seats.find((s) => s.seatNo === 'S1')!.status).toBe('AVAILABLE');
  });

  it('two rapid clicks build one selection and a stale response cannot overwrite a newer one', async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    apiMock.hold.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    const { result } = renderHook(() => useTripSeats(7, 1));
    await waitFor(() => expect(result.current.seats).toHaveLength(3));

    act(() => { result.current.toggleSeat('S1'); });
    act(() => { result.current.toggleSeat('S2'); }); // before the first response arrives
    expect(apiMock.hold.mock.calls.map((c) => c[1])).toEqual([['S1'], ['S1', 'S2']]);
    expect(result.current.selected).toEqual(['S1', 'S2']);

    // Responses arrive out of order: newest first, then the stale one.
    await act(async () => resolvers[1]({ holdId: 'h2', seats: ['S1', 'S2'], expiresAt: Date.now() + 300_000 }));
    await act(async () => resolvers[0]({ holdId: 'h1', seats: ['S1'], expiresAt: Date.now() + 300_000 }));
    expect(result.current.hold?.holdId).toBe('h2');
    expect(result.current.pending).toBe(false);
  });
});
