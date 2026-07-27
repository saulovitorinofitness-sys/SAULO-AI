export function DocumentFooter() {
  return (
    <footer
      className="pdf-avoid-break border-t border-[#d9e3de] pt-3"
      data-html2canvas-ignore="true"
    >
      <div className="flex items-end justify-between gap-4 text-[8px] leading-4 text-[#60746d]">
        <p className="font-black text-[#23483b]">
          Clínica SV · Sistema Integrado SV
        </p>
        <p className="text-right">
          Plano individualizado e sujeito a ajustes conforme evolução clínica.
        </p>
      </div>
    </footer>
  );
}
