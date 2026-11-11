import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TripResults } from '../components/TripResults';
import { trip } from './fixtures';

const trips = [
  trip({ id: 1, operator: 'Orange Travels', departure: '2026-11-12T21:30:00+05:30', minFare: 1499, rating: 4.4 }),
  trip({ id: 2, operator: 'VRL Travels', busType: 'SEATER', departure: '2026-11-12T13:30:00+05:30', arrival: '2026-11-12T23:00:00+05:30', minFare: 899, rating: 4.0 }),
  trip({ id: 3, operator: 'SRS Travels', departure: '2026-11-12T22:45:00+05:30', minFare: 1299, availableSeats: 0 }),
];
const operators = () => screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);

describe('<TripResults />', () => {
  it('shows trip details: times in IST, +1 day marker, fare, seats left, amenities', () => {
    render(<TripResults trips={[trips[0]]} onSelect={() => {}} />);
    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('21:30');
    expect(card).toHaveTextContent('07:15+1');
    expect(card).toHaveTextContent('₹1,499');
    expect(card).toHaveTextContent('12 seats left');
    expect(card).toHaveTextContent('+1'); // 5 amenities, 4 shown
  });

  it('sorts and filters', async () => {
    render(<TripResults trips={trips} onSelect={() => {}} />);
    expect(operators()).toEqual(['VRL Travels', 'Orange Travels', 'SRS Travels']);
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'fare');
    expect(operators()).toEqual(['VRL Travels', 'SRS Travels', 'Orange Travels']);
    await userEvent.click(screen.getByRole('button', { name: 'Sleeper' }));
    expect(operators()).toEqual(['SRS Travels', 'Orange Travels']);
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.click(screen.getByLabelText(/After 6 PM/));
    expect(operators()).not.toContain('VRL Travels');
  });

  it('disables sold-out buses and passes the trip to onSelect', async () => {
    const onSelect = vi.fn();
    render(<TripResults trips={trips} onSelect={onSelect} />);
    const srs = screen.getByRole('article', { name: /SRS Travels/ });
    expect(within(srs).getByRole('button', { name: 'Sold out' })).toBeDisabled();
    await userEvent.click(within(screen.getByRole('article', { name: /Orange/ })).getByRole('button', { name: 'View seats' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
