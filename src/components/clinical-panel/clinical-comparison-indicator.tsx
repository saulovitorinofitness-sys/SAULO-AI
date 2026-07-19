export function ClinicalComparisonIndicator({ current, previous, unit = "cm" }: { current?: number; previous?: number; unit?: string }) {
  if (current === undefined || previous === undefined) return <span className="text-[11px] font-semibold text-slate-400">Sem comparação</span>;
  const difference = Math.round((current - previous) * 10) / 10;
  const stable = Math.abs(difference) < 0.1;
  const label = stable ? "Estável" : difference > 0 ? "Aumentou" : "Reduziu";
  return <span className="text-[11px] font-bold text-slate-500">{label}{stable ? "" : ` ${Math.abs(difference)} ${unit}`}</span>;
}
