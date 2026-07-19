export function PreviousValueIndicator({ current, previous, unit }: { current?: number; previous?: number; unit: string }) {
  if (previous === undefined) return <span className="text-[11px] font-semibold text-slate-400">Sem comparação anterior</span>;
  if (current === undefined) return <span className="text-[11px] font-semibold text-slate-500">Anterior: {previous} {unit}</span>;
  const difference = Math.round((current - previous) * 10) / 10;
  const stable = Math.abs(difference) < 0.1;
  const label = stable ? "Estável" : difference > 0 ? `+${difference} ${unit}` : `${difference} ${unit}`;
  const className = stable ? "bg-slate-100 text-slate-600" : difference > 0 ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`} title={`Valor anterior: ${previous} ${unit}`}>{label} · anterior {previous}</span>;
}
