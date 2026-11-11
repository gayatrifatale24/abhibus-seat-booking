import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeatMap, seatUiState } from '../components/SeatMap';
import { seat } from './fixtures';

const seats = [
  seat('S1', { col: 0 }),
  seat('S2', { col: 1, status: 'HELD' }),
  seat('S3', { col: 2, status: 'BOOKED' }),
  seat('S4', { col: 3, status: 'HELD' }),
];

describe('<SeatMap />', () => {
  it('renders every seat with an accessible status label', () => {
    render(<SeatMap seats={seats} selected={['S4']} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /Seat S1.*available/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Seat S2.*on hold by another/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Seat S3.*booked/ })).toBeDisabled();
    // Held by *me* (in my selection) stays clickable so I can deselect it.
    const mine = screen.getByRole('button', { name: /Seat S4.*selected by you/ });
    expect(mine).toBeEnabled();
    expect(mine).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle only for seats the user may click', async () => {
    const onToggle = vi.fn();
    render(<SeatMap seats={seats} selected={['S4']} onToggle={onToggle} />);
    await userEvent.click(screen.getByTestId('seat-S1'));
    await userEvent.click(screen.getByTestId('seat-S2'));
    await userEvent.click(screen.getByTestId('seat-S3'));
    await userEvent.click(screen.getByTestId('seat-S4'));
    expect(onToggle.mock.calls.map((c) => c[0])).toEqual(['S1', 'S4']);
  });

  it('shows upper and lower decks for sleeper buses', () => {
    render(
      <SeatMap
        seats={[seat('L1', { kind: 'SLEEPER' }), seat('U1', { kind: 'SLEEPER', deck: 'UPPER' })]}
        selected={[]}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('region', { name: 'Lower deck' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Upper deck' })).toBeInTheDocument();
  });

  it('seatUiState: booked beats selection; selection beats held', () => {
    expect(seatUiState(seat('A1', { status: 'BOOKED' }), new Set(['A1']))).toBe('booked');
    expect(seatUiState(seat('A1', { status: 'HELD' }), new Set(['A1']))).toBe('selected');
    expect(seatUiState(seat('A1', { status: 'HELD' }), new Set())).toBe('held');
  });
});
