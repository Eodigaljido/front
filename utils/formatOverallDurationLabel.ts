/** 60분 미만은 분, 이상은 시간(+남은 분) */
export function formatOverallDurationLabel(totalMinutes: number): string {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (m <= 0) return '—';
  if (m < 60) return `약 ${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `약 ${h}시간`;
  return `약 ${h}시간 ${r}분`;
}
