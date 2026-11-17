import type { ProfessionalAudit, RecordOrigin } from "@/features/clinical-collection";

const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ProfessionalAuditInfo({
  audit,
  origin,
  responsible,
}: {
  audit?: ProfessionalAudit;
  origin?: RecordOrigin;
  responsible?: ProfessionalAudit;
}) {
  const professional = audit ?? responsible;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-[#f8faf9] px-3.5 py-3 text-xs text-slate-500">
      <span>
        <strong className="text-slate-700">
          {audit ? "Autor:" : "Responsável:"}
        </strong>{" "}
        {professional?.professionalName?.trim() || "Não informado"}
      </span>
      <span>
        <strong className="text-slate-700">Atualizado:</strong>{" "}
        {audit
          ? formatter.format(new Date(audit.updatedAt))
          : "Não informado"}
      </span>
      <span>
        <strong className="text-slate-700">Origem:</strong>{" "}
        {origin?.label ?? "Não informado"}
      </span>
      <span>
        <strong className="text-slate-700">Versão:</strong>{" "}
        {audit ? `v${audit.version}` : "Não informado"}
      </span>
    </div>
  );
}
