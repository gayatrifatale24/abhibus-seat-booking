import { useEffect } from 'react';
import { useCountdown } from '../hooks/useCountdown';
import { formatCountdown } from '../lib/format';

export function HoldTimer({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const left = useCountdown(expiresAt);
  useEffect(() => {
    if (left === 0) onExpire();
  }, [left, onExpire]);
  const urgent = left !== null && left < 60_000;
  return (
    <div className={`timer ${urgent ? 'timer--urgent' : ''}`} role="timer" aria-live="polite">
      Seats held for you · <strong>{formatCountdown(left ?? 0)}</strong>
    </div>
  );
}
