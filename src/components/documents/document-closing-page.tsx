import { DocumentFooter } from "./document-footer";
import { ProfessionalSignature } from "./professional-signature";
import type { AttendanceProfessionalParticipant } from "@/features/professional-responsibility";

// Placeholder temporário até que o QR Code profissional seja configurado.
const TEMPORARY_QR_CODE_PLACEHOLDER = true;

export function DocumentClosingPage({
  professionals,
}: {
  professionals: readonly AttendanceProfessionalParticipant[];
}) {
  return (
    <section
      className="pdf-closing-page flex break-before-page flex-col px-[12mm] py-[12mm] sm:px-[15mm] sm:py-[14mm]"
      style={{ breakBefore: "page", pageBreakBefore: "always" }}
    >
      <div className="pdf-avoid-break text-center">
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-[#a17d2e]">
          Mensagem final
        </h2>

        <span
          aria-hidden="true"
          className="mt-5 block h-[18mm] text-[72px] font-serif leading-none text-[#17644c]"
        >
          “
        </span>

        <blockquote className="mx-auto mt-3 max-w-[142mm] text-center text-[16px] font-medium italic leading-8 text-[#31483f]">
          Cada pequena escolha feita hoje é um passo em direção à saúde que você
          deseja construir. A constância supera a perfeição. Conte comigo
          durante toda essa jornada.
        </blockquote>
      </div>

      <div className="pdf-avoid-break mt-auto pb-[7mm]">
        <div
          className={
            professionals.length > 1
              ? "grid gap-8 sm:grid-cols-2"
              : ""
          }
        >
          {professionals.map((professional) => (
            <ProfessionalSignature
              key={professional.userId}
              professional={professional}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_36mm] items-end gap-[12mm] border-t border-[#e2e9e5] pt-5">
          <div className="text-left text-[9px] leading-5 text-[#50665e]">
            <p className="font-black text-[#23483b]">Clínica SV</p>
            <p className="font-black text-[#23483b]">
              www.saulovitorino.com.br
            </p>
            <p>Responsáveis identificados pelo registro do atendimento.</p>
          </div>

          <div className="flex flex-col items-center justify-end text-center">
            {TEMPORARY_QR_CODE_PLACEHOLDER ? (
              <div className="grid size-[25mm] shrink-0 place-items-center rounded-lg border border-dashed border-[#9aaca3] bg-[#f7faf8] p-2">
                <span className="text-[8px] font-black uppercase tracking-wide text-[#60746d]">
                  QR Code
                  <span className="mt-1 block text-[7px] font-semibold normal-case tracking-normal">
                    configuração pendente
                  </span>
                </span>
              </div>
            ) : null}

            <p className="mt-2 max-w-[34mm] text-[8px] font-semibold leading-4 text-[#60746d]">
              Escaneie para acessar nossos contatos
            </p>
          </div>
        </div>
      </div>

      <DocumentFooter />
    </section>
  );
}
