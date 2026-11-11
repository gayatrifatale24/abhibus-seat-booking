const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const dateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDate = (isoOrDate: string) => dateFmt.format(new Date(isoOrDate.length === 10 ? `${isoOrDate}T12:00:00+05:30` : isoOrDate));
export const formatDuration = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
export const formatFare = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const formatCountdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** Today's date (YYYY-MM-DD) in IST, regardless of the browser's timezone. */
export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
/** Arrives on a later calendar day than it departs? */
export const nextDay = (dep: string, arr: string) => new Date(arr).getTime() - new Date(dep).getTime() > 0 && arr.slice(0, 10) !== dep.slice(0, 10);
