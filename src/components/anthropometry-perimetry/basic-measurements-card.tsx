import Link from "next/link";

import { SectionCard } from "@/components/clinical-collection/section-card";
import type { AnthropometryAssessment } from "@/features/anthropometry-perimetry";

function Metric({ label, value, unit }: { label: string; value?: number; unit: string }) { return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 text-xl font-black text-slate-900">{value ?? "Dado ainda não registrado no Prontuário Mestre."}{value !== undefined ? <span className="ml-1 text-xs text-slate-400">{unit}</span> : null}</dd></div>; }

export function BasicMeasurementsCard({ assessment, sourceHref }: { assessment: AnthropometryAssessment; sourceHref: string }) {
  return <SectionCard description="Valores importados da Antropometria da Coleta Clínica. Não são cadastrados novamente nesta tela." title="2. Medidas básicas vinculadas"><dl className="grid gap-3 sm:grid-cols-3"><Metric label="Peso" unit="kg" value={assessment.weightKg} /><Metric label="Altura" unit="cm" value={assessment.heightCm} /><Metric label="IMC registrado no mock" unit="kg/m²" value={assessment.bmi} /></dl><div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#cce1d8] bg-[#edf6f2] p-3 text-xs text-[#0a4938] sm:flex-row sm:items-center sm:justify-between"><span>Origem: {assessment.basicMeasurementsOrigin?.sourceLabel ?? "dado ainda não registrado no Prontuário Mestre"}</span><Link className="font-black underline underline-offset-2" href={sourceHref}>Abrir origem do dado</Link></div></SectionCard>;
}

