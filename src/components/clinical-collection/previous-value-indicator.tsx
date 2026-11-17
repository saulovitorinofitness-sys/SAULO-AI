import { formatLocalizedNumber } from "@/features/clinical-collection/anthropometry-calculations";

export function PreviousValueIndicator({ current, previous, unit }: { current?: number; previous?: number; unit: string }) {
  if (previous === undefined) return <span className="text-[11px] font-semibold text-slate-400">Sem comparação anterior</span>;
  const previousLabel = formatLocalizedNumber(previous);
  if (current === undefined) return <span className="text-[11px] font-semibold text-slate-500">Anterior: {previousLabel} {unit}</span>;
  const difference = Number((current - previous).toFixed(10));
  const stable = Math.abs(difference) < 0.1;
  const differenceLabel = formatLocalizedNumber(difference);
  const label = stable ? "Estável" : difference > 0 ? `+${differenceLabel} ${unit}` : `${differenceLabel} ${unit}`;
  const className = stable ? "bg-slate-100 text-slate-600" : difference > 0 ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`} title={`Valor anterior: ${previousLabel} ${unit}`}>{label} · anterior {previousLabel}</span>;
}
