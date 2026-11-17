import { InstitutionalDocumentIdentity } from "./institutional-document-identity";

export function DocumentFooter() {
  return (
    <footer
      className="pdf-avoid-break border-t border-[#d9e3de] pt-3"
      data-html2canvas-ignore="true"
    >
      <div className="flex items-end justify-between gap-4 text-[8px] leading-4 text-[#60746d]">
        <InstitutionalDocumentIdentity className="max-w-[68%]" compact />
        <p className="max-w-[30%] text-right">
          Plano individualizado e sujeito a ajustes conforme evolução clínica.
        </p>
      </div>
    </footer>
  );
}
