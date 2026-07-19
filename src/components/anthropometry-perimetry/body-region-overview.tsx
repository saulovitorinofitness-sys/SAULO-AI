"use client";

import { useState } from "react";
import { SectionCard } from "@/components/clinical-collection/section-card";
import { bodyRegionLabels, type BodyRegion, type PerimetryMeasurement } from "@/features/anthropometry-perimetry";

export function BodyRegionOverview({ measurements }: { measurements: readonly PerimetryMeasurement[] }) {
  const [selected, setSelected] = useState<BodyRegion>("TRUNK"); const selectedMeasurements = measurements.filter((item) => item.region === selected);
  return <SectionCard description="Representação acessível por cards; não utiliza imagem anatômica nem análise automática." title="6. Visualização corporal"><div className="grid gap-3 sm:grid-cols-3">{(Object.keys(bodyRegionLabels) as BodyRegion[]).map((region) => { const count = measurements.filter((item) => item.region === region && item.valueCm !== undefined).length; return <button aria-pressed={selected === region} className={`min-h-24 rounded-xl border p-4 text-left ${selected === region ? "border-[#12664f] bg-[#e7f2ed] text-[#0a4938]" : "border-slate-200 bg-slate-50 text-slate-700"}`} key={region} onClick={() => setSelected(region)} type="button"><strong className="block text-sm">{bodyRegionLabels[region]}</strong><span className="mt-2 block text-xs">{count} medidas com valor</span></button>; })}</div><div aria-live="polite" className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Região selecionada: {bodyRegionLabels[selected]}</p><p className="mt-2 text-sm text-slate-700">{selectedMeasurements.map((item) => item.label).join(" · ")}</p></div></SectionCard>;
}

