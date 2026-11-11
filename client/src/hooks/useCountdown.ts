import { useEffect, useState } from 'react';

/** Milliseconds left until `deadline` (epoch ms), ticking every 250ms. Null deadline -> null. */
export function useCountdown(deadline: number | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline ? Math.max(0, deadline - now) : null;
}
