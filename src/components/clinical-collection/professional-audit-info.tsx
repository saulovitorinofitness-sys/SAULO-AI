import type { ProfessionalAudit, RecordOrigin } from "@/features/clinical-collection";

const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ProfessionalAuditInfo({ audit, origin }: { audit?: ProfessionalAudit; origin?: RecordOrigin }) {
  if (!audit && !origin) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-[#f8faf9] px-3.5 py-3 text-xs text-slate-500">
      {audit ? <span><strong className="text-slate-700">Autor:</strong> {audit.professionalName}</span> : <span>Sem autoria registrada</span>}
      {audit ? <span><strong className="text-slate-700">Atualizado:</strong> {formatter.format(new Date(audit.updatedAt))}</span> : null}
      {origin ? <span><strong className="text-slate-700">Origem:</strong> {origin.label}</span> : null}
      {audit ? <span>v{audit.version}</span> : null}
    </div>
  );
}
