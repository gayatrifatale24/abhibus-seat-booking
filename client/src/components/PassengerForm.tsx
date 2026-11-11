import { useEffect, useState, type FormEvent } from 'react';
import type { Passenger } from '../types';

interface Props {
  seats: string[];
  /** Seats reserved for female passengers. */
  ladiesSeats?: string[];
  defaultName?: string;
  submitting?: boolean;
  onSubmit: (passengers: Passenger[], phone: string) => void;
}

type Row = { name: string; age: string; gender: Passenger['gender'] };

export function PassengerForm({ seats, ladiesSeats = [], defaultName, submitting, onSubmit }: Props) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // Keep one row per held seat; preserve what was typed when seats change.
  useEffect(() => {
    setRows((prev) => Object.fromEntries(seats.map((s, i) => [s, prev[s] ?? { name: i === 0 ? defaultName ?? '' : '', age: '', gender: 'F' }])));
  }, [seats, defaultName]);

  const update = (seat: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [seat]: { ...r[seat], ...patch } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    const passengers = seats.map((seatNo) => {
      const r = rows[seatNo] ?? { name: '', age: '', gender: 'F' };
      const age = Number(r.age);
      if (r.name.trim().length < 2) errs.push(`Enter a name for seat ${seatNo}`);
      if (!Number.isInteger(age) || age < 1 || age > 110) errs.push(`Enter a valid age for seat ${seatNo}`);
      if (ladiesSeats.includes(seatNo) && r.gender !== 'F') errs.push(`Seat ${seatNo} is reserved for a female passenger`);
      return { seatNo, name: r.name.trim(), age, gender: r.gender };
    });
    if (!/^[6-9]\d{9}$/.test(phone)) errs.push('Enter a valid 10-digit mobile number');
    setErrors(errs);
    if (!errs.length) onSubmit(passengers, phone);
  };

  return (
    <form className="pax" onSubmit={submit} noValidate aria-label="Passenger details">
      {seats.map((s) => (
        <fieldset key={s} className="pax__row">
          <legend>Seat {s}{ladiesSeats.includes(s) && <span className="pax__ladies"> · Ladies</span>}</legend>
          <input aria-label={`Name for seat ${s}`} placeholder="Full name" value={rows[s]?.name ?? ''} onChange={(e) => update(s, { name: e.target.value })} />
          <input aria-label={`Age for seat ${s}`} placeholder="Age" inputMode="numeric" className="pax__age" value={rows[s]?.age ?? ''} onChange={(e) => update(s, { age: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          <select aria-label={`Gender for seat ${s}`} value={rows[s]?.gender ?? 'F'} onChange={(e) => update(s, { gender: e.target.value as Row['gender'] })}>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="O">Other</option>
          </select>
        </fieldset>
      ))}
      <label className="pax__phone">
        <span>Mobile number</span>
        <input aria-label="Mobile number" placeholder="98xxxxxxxx" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="form-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <button className="btn btn--primary btn--block" disabled={submitting}>{submitting ? 'Confirming…' : 'Confirm booking'}</button>
    </form>
  );
}
