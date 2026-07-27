import type { AttendanceProfessionalParticipant } from "@/features/professional-responsibility";

function executionLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ProfessionalSignature({
  professional,
}: {
  professional: AttendanceProfessionalParticipant;
}) {
  return (
    <section className="pdf-avoid-break mx-auto w-full max-w-[88mm] text-center">
      <div aria-hidden="true" className="h-[12mm]" />
      <div className="border-t border-[#8ba096] pt-2">
        <p className="text-xs font-black text-[#243b33]">
          {professional.fullName}
        </p>
        {professional.professionalTitle ? (
          <p className="mt-1 text-[9px] font-semibold text-[#60746d]">
            {professional.professionalTitle}
          </p>
        ) : null}
        {professional.professionalRegistration ? (
          <p className="text-[8px] font-semibold text-[#60746d]">
            {professional.professionalRegistration}
          </p>
        ) : null}
        <div className="mt-2 text-[8px] leading-4 text-[#60746d]">
          <p className="font-black">Módulos executados</p>
          {professional.modules.map((module) => (
            <p key={module.moduleKey}>
              {module.moduleName} · {executionLabel(module.executedAt)}
            </p>
          ))}
        </div>
        {professional.phone ? (
          <p className="text-[8px] text-[#60746d]">
            WhatsApp: {professional.phone}
          </p>
        ) : null}
        {professional.instagram ? (
          <p className="text-[8px] text-[#60746d]">
            Instagram: {professional.instagram}
          </p>
        ) : null}
      </div>
    </section>
  );
}
