export function formatBytes(b: number | null | undefined): string {
  if (b == null || !Number.isFinite(b)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.max(b, 1)) / Math.log(1024)));
  return `${(b / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

/** Duración como m:ss (o h:mm:ss si pasa la hora). */
export function formatDuration(s: number): string {
  if (!s) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
