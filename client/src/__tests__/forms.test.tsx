import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchForm } from '../components/SearchForm';
import { PassengerForm } from '../components/PassengerForm';

describe('<SearchForm />', () => {
  const cities = ['Bengaluru', 'Hyderabad', 'Vijayawada'];

  it('submits the query and swaps cities', async () => {
    const onSearch = vi.fn();
    render(<SearchForm cities={cities} initial={{ from: 'Hyderabad', to: 'Vijayawada', date: '2026-11-20' }} onSearch={onSearch} />);
    await userEvent.click(screen.getByRole('button', { name: 'Swap cities' }));
    await userEvent.click(screen.getByRole('button', { name: 'Search buses' }));
    expect(onSearch).toHaveBeenCalledWith({ from: 'Vijayawada', to: 'Hyderabad', date: '2026-11-20' });
  });

  it('blocks same source and destination', async () => {
    const onSearch = vi.fn();
    render(<SearchForm cities={cities} initial={{ from: 'Hyderabad', to: 'Hyderabad', date: '2026-11-20' }} onSearch={onSearch} />);
    await userEvent.click(screen.getByRole('button', { name: 'Search buses' }));
    expect(screen.getByRole('alert')).toHaveTextContent('cannot be the same');
    expect(onSearch).not.toHaveBeenCalled();
  });
});

describe('<PassengerForm />', () => {
  it('validates every passenger and the phone number before submitting', async () => {
    const onSubmit = vi.fn();
    render(<PassengerForm seats={['L1', 'L2']} defaultName="Gayatri" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a name for seat L2');
    expect(alert).toHaveTextContent('valid age for seat L1');
    expect(alert).toHaveTextContent('10-digit mobile');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Age for seat L1'), '29');
    await userEvent.type(screen.getByLabelText('Name for seat L2'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Age for seat L2'), '31');
    await userEvent.selectOptions(screen.getByLabelText('Gender for seat L2'), 'M');
    await userEvent.type(screen.getByLabelText('Mobile number'), '98765abc43210');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(onSubmit).toHaveBeenCalledWith(
      [
        { seatNo: 'L1', name: 'Gayatri', age: 29, gender: 'F' },
        { seatNo: 'L2', name: 'Ravi Kumar', age: 31, gender: 'M' },
      ],
      '9876543210',
    );
  });

  it('requires a female passenger on a ladies-only seat', async () => {
    const onSubmit = vi.fn();
    render(<PassengerForm seats={['L1']} ladiesSeats={['L1']} defaultName="Ravi" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Age for seat L1'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Gender for seat L1'), 'M');
    await userEvent.type(screen.getByLabelText('Mobile number'), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(screen.getByRole('alert')).toHaveTextContent('reserved for a female passenger');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
