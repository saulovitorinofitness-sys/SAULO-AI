import type { ProfessionalAudit } from "@/features/clinical-collection";

const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

export function SectionAuditInfo({ audit }: { audit?: ProfessionalAudit }) {
  return audit ? <p className="text-xs font-semibold text-slate-500"><span className="font-bold text-slate-700">Registrada por {audit.professionalName}</span><span className="mx-1.5 text-slate-300">·</span>{formatter.format(new Date(audit.updatedAt))}<span className="mx-1.5 text-slate-300">·</span>v{audit.version}</p> : <p className="text-xs font-bold text-rose-700">Autoria não disponível</p>;
}
