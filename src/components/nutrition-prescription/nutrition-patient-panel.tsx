import { Card, SectionHeader } from "@/components/ui";
import type { NutritionPatientContext } from "@/features/nutrition-prescription";

export function NutritionPatientPanel({ patient }: { patient: NutritionPatientContext }) {
  const fields = [
    ["Objetivo", [patient.objective]], ["Diagnósticos registrados", patient.diagnoses], ["Restrições", patient.restrictions],
    ["Alergias", patient.allergies], ["Preferências", patient.preferences], ["Aversões", patient.aversions],
    ["Suplementação", patient.supplementation], ["Horários", patient.schedules], ["Rotina", patient.routine],
  ] as const;
  return <Card className="p-5 md:p-6"><SectionHeader description={`Dados reutilizados do Prontuário Mestre · ${patient.patientName}`} eyebrow="Painel 1" title="Paciente" /><dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([label, values]) => <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5" key={label}><dt className="text-xs font-black text-[var(--muted)]">{label}</dt><dd className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{values.join(" · ")}</dd></div>)}</dl></Card>;
}
