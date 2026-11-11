import { memo, useMemo } from 'react';
import type { Seat } from '../types';
import { formatFare } from '../lib/format';

interface Props {
  seats: Seat[];
  selected: string[];
  onToggle: (seatNo: string) => void;
  disabled?: boolean;
}

type SeatUi = 'available' | 'selected' | 'held' | 'booked';

/** Visual state of one seat for the current user. */
export function seatUiState(seat: Seat, selected: Set<string>): SeatUi {
  if (seat.status === 'BOOKED') return 'booked';
  if (selected.has(seat.seatNo)) return 'selected';
  if (seat.status === 'HELD') return 'held';
  return 'available';
}

const LABEL: Record<SeatUi, string> = { available: 'available', selected: 'selected by you', held: 'on hold by another traveller', booked: 'booked' };

const SeatButton = memo(function SeatButton({ seat, ui, onToggle, disabled }: { seat: Seat; ui: SeatUi; onToggle: (s: string) => void; disabled?: boolean }) {
  const clickable = ui === 'available' || ui === 'selected';
  return (
    <button
      type="button"
      className={`seat seat--${seat.kind.toLowerCase()} seat--${ui}${seat.ladiesOnly ? ' seat--ladies' : ''}`}
      style={{ gridRow: seat.row + 1, gridColumn: seat.kind === 'SLEEPER' ? (seat.col === 0 ? 1 : seat.col + 2) : seat.col < 2 ? seat.col + 1 : seat.col + 2 }}
      disabled={!clickable || disabled}
      aria-pressed={ui === 'selected'}
      aria-label={`Seat ${seat.seatNo}, ${formatFare(seat.fare)}, ${LABEL[ui]}${seat.ladiesOnly ? ', reserved for ladies' : ''}`}
      title={`${seat.seatNo} · ${formatFare(seat.fare)}${seat.ladiesOnly ? ' · Ladies' : ''}`}
      onClick={() => onToggle(seat.seatNo)}
      data-testid={`seat-${seat.seatNo}`}
    >
      <span className="seat__no">{seat.seatNo}</span>
      <span className="seat__fare">{ui === 'booked' ? 'Sold' : ui === 'held' ? 'Held' : `₹${seat.fare}`}</span>
    </button>
  );
});

function Deck({ title, seats, selected, onToggle, disabled }: Props & { title: string }) {
  const sel = useMemo(() => new Set(selected), [selected]);
  const isSleeper = seats[0]?.kind === 'SLEEPER';
  return (
    <section className="deck" aria-label={title}>
      <header className="deck__header">
        <span>{title}</span>
        {title.startsWith('Lower') && <span className="deck__wheel" aria-hidden>⎈</span>}
      </header>
      <div className={`deck__grid ${isSleeper ? 'deck__grid--sleeper' : 'deck__grid--seater'}`}>
        {seats.map((s) => (
          <SeatButton key={s.seatNo} seat={s} ui={seatUiState(s, sel)} onToggle={onToggle} disabled={disabled} />
        ))}
      </div>
    </section>
  );
}

export function SeatMap({ seats, selected, onToggle, disabled }: Props) {
  const lower = useMemo(() => seats.filter((s) => s.deck === 'LOWER'), [seats]);
  const upper = useMemo(() => seats.filter((s) => s.deck === 'UPPER'), [seats]);
  return (
    <div className="seatmap">
      <div className="seatmap__decks">
        <Deck title={upper.length ? 'Lower deck' : 'Seats'} seats={lower} selected={selected} onToggle={onToggle} disabled={disabled} />
        {upper.length > 0 && <Deck title="Upper deck" seats={upper} selected={selected} onToggle={onToggle} disabled={disabled} />}
      </div>
      <ul className="legend" aria-label="Seat legend">
        <li><span className="legend__swatch seat--available" />Available</li>
        <li><span className="legend__swatch seat--selected" />Your seats</li>
        <li><span className="legend__swatch seat--held" />On hold</li>
        <li><span className="legend__swatch seat--booked" />Booked</li>
        <li><span className="legend__swatch seat--available seat--ladies" />Ladies</li>
      </ul>
    </div>
  );
}
