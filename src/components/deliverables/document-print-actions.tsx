"use client";

import { useCallback, useEffect } from "react";

import { Button } from "@/components/ui";

export function DocumentPrintActions({
  autoPrint = false,
  documentTitle,
  targetId,
}: {
  readonly autoPrint?: boolean;
  readonly documentTitle: string;
  readonly targetId: string;
}) {
  const printDocument = useCallback(() => {
    if (!document.getElementById(targetId)) return;

    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    document.title = documentTitle;
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  }, [documentTitle, targetId]);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(printDocument, 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint, printDocument]);

  return (
    <div className="flex flex-wrap gap-2">
      <Button aria-controls={targetId} onClick={printDocument} type="button">
        Imprimir
      </Button>
      <Button aria-controls={targetId} onClick={printDocument} type="button" variant="secondary">
        Salvar em PDF
      </Button>
    </div>
  );
}
