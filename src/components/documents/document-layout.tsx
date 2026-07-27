import type { ReactNode } from "react";

export function DocumentLayout({
  children,
  documentId,
}: {
  children: ReactNode;
  documentId: string;
}) {
  return (
    <article
      className="mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white text-[#20312b] shadow-[0_18px_50px_rgba(15,23,42,0.12)] print:min-h-0 print:max-w-none print:shadow-none"
      id={documentId}
    >
      <style>{`
        #${documentId} .pdf-closing-page {
          min-height: 297mm;
        }

        #${documentId}.pdf-exporting .pdf-closing-page {
          min-height: 282mm;
        }
      `}</style>
      {children}
    </article>
  );
}
