"use client";

import Link from "next/link";

export function EvaluationEvolutionPrintActions({
  patientId,
}: {
  patientId: string;
}) {
  return (
    <div className="evaluation-evolution-actions mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-slate-950">Apresentação para compartilhar</p>
        <p className="mt-1 text-xs text-slate-600">A impressão apenas apresenta os dados já registrados; nenhuma avaliação é criada ou alterada.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          href={`/pacientes/${patientId}/evolucao-avaliacoes`}
        >
          Voltar à evolução
        </Link>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50"
          onClick={() => window.print()}
          type="button"
        >
          Imprimir
        </button>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
          onClick={() => window.print()}
          type="button"
        >
          Salvar em PDF
        </button>
      </div>
    </div>
  );
}
