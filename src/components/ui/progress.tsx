export function Progress({ value, max = 100, label, className = "" }: { value: number; max?: number; label: string; className?: string }) {
  const safeValue = Math.min(Math.max(value, 0), max);
  return <div aria-label={label} aria-valuemax={max} aria-valuemin={0} aria-valuenow={safeValue} className={`h-2 overflow-hidden rounded-[var(--radius-full)] bg-slate-200 ${className}`} role="progressbar"><span className="block h-full rounded-[var(--radius-full)] bg-[var(--focus)] transition-[width] duration-[var(--transition-normal)]" style={{ width: `${(safeValue / max) * 100}%` }} /></div>;
}
