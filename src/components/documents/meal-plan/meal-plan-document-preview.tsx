"use client";

import { Download, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createAssistedMealPreview,
  createAssistedMealReferences,
  mockAssistedPreviewAdapter,
  previewNutrition,
  temporaryMealPlanDraftAdapter,
  type AssistedMealPreview,
  type MealPlanView,
} from "@/features/meal-plan";
import {
  mockNutritionStrategySelectionAdapter,
  nutritionMethodOptions,
  nutritionStrategySelectionFingerprint,
  type NutritionStrategySelection,
} from "@/features/nutrition-strategy";
import type { ScientificLibraryItem } from "@/features/scientific-library";
import type { AttendanceProfessionalParticipant } from "@/features/professional-responsibility";

import {
  MEAL_PLAN_DOCUMENT_ID,
  MealPlanDocument,
} from "./meal-plan-document";

function synchronizePlan(
  plan: MealPlanView,
  strategy: NutritionStrategySelection,
  preview: AssistedMealPreview,
) {
  const method =
    nutritionMethodOptions.find(([value]) => value === strategy.method)?.[1] ??
    strategy.method;
  const totals = previewNutrition(preview);

  return {
    ...plan,
    status: preview.status,
    summary: {
      ...plan.summary,
      primaryObjective: strategy.objectiveMain,
      strategy: `${method}${
        strategy.complementaryStrategies.length
          ? ` · ${strategy.complementaryStrategies.join(" · ")}`
          : ""
      }`,
      plannedCalories: `${totals.calories.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kcal`,
      protein: `${totals.proteinGrams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`,
      carbohydrates: `${totals.carbohydratesGrams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`,
      fats: `${totals.fatsGrams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`,
      mealCount: preview.meals.length,
    },
  } satisfies MealPlanView;
}

export function MealPlanDocumentPreview({
  foods,
  initialPlan,
  initialPreview,
  initialStrategy,
  issuedAt,
  patient,
  professionals,
}: {
  foods: readonly ScientificLibraryItem[];
  initialPlan: MealPlanView;
  initialPreview: AssistedMealPreview;
  initialStrategy: NutritionStrategySelection;
  issuedAt: string;
  patient: {
    age?: number;
    sex?: string;
    phone?: string;
  };
  professionals: readonly AttendanceProfessionalParticipant[];
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [preview, setPreview] = useState(initialPreview);
  const [strategy, setStrategy] = useState(initialStrategy);
  const [downloadState, setDownloadState] = useState<
    "IDLE" | "GENERATING" | "ERROR"
  >("IDLE");

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const savedStrategy =
        mockNutritionStrategySelectionAdapter.read(
          initialPlan.patientId,
          initialPlan.scenario,
        ) ?? initialStrategy;
      const savedPlan = temporaryMealPlanDraftAdapter.read(initialPlan);

      const references = createAssistedMealReferences(
        savedStrategy,
        savedPlan.meals,
      );
      const savedPreview =
        mockAssistedPreviewAdapter.read(savedStrategy) ??
        createAssistedMealPreview(savedStrategy, references, foods);

      setPlan(savedPlan);
      setStrategy(savedStrategy);
      setPreview(savedPreview);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, [foods, initialPlan, initialStrategy]);

  const synchronizedPlan = useMemo(
    () => synchronizePlan(plan, strategy, preview),
    [plan, preview, strategy],
  );
  const canDownloadDefinitive =
    preview.status === "APPROVED" &&
    preview.strategyFingerprint ===
      nutritionStrategySelectionFingerprint(strategy);
  const backHref = `/pacientes/${encodeURIComponent(
    initialPlan.patientId,
  )}/plano-alimentar?scenario=${initialPlan.scenario}`;

  async function downloadPdf() {
    if (!canDownloadDefinitive) return;

    const element = document.getElementById(MEAL_PLAN_DOCUMENT_ID);

    if (!element) {
      setDownloadState("ERROR");
      return;
    }

    setDownloadState("GENERATING");
    const previousInlineStyles = element.style.cssText;

    try {
      element.style.width = "210mm";
      element.style.maxWidth = "none";
      element.classList.add("pdf-exporting");

      const { default: html2pdf } = await import("html2pdf.js");
      const filename = `plano-alimentar-${initialPlan.patientName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLocaleLowerCase("pt-BR")}.pdf`;
      const options = {
        margin: [0, 0, 15, 0] as [number, number, number, number],
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait" as const,
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: [".pdf-avoid-break"],
        },
      };
      const worker = html2pdf().set(options).from(element).toPdf();
      const pdf = await worker.get("pdf");
      const pageCount = pdf.internal.getNumberOfPages();

      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, pageHeight - 15, pageWidth, 15, "F");
        pdf.setDrawColor(217, 227, 222);
        pdf.line(15, pageHeight - 13, pageWidth - 15, pageHeight - 13);
        pdf.setFontSize(6.5);
        pdf.setTextColor(96, 116, 109);
        pdf.text(
          "Clínica SV · Sistema Integrado SV",
          15,
          pageHeight - 7,
        );
        pdf.text(
          "Plano individualizado e sujeito a ajustes conforme evolução clínica.",
          pageWidth / 2,
          pageHeight - 7,
          { align: "center" },
        );
        pdf.text(
          `Página ${page} de ${pageCount}`,
          pageWidth - 15,
          pageHeight - 7,
          { align: "right" },
        );
      }

      await worker.save(filename);
      setDownloadState("IDLE");
    } catch {
      setDownloadState("ERROR");
    } finally {
      element.classList.remove("pdf-exporting");
      element.style.cssText = previousInlineStyles;
    }
  }

  return (
    <div className="min-w-0">
      <div className="sticky top-16 z-10 mb-5 flex flex-col gap-3 rounded-2xl border border-[#dce5e0] bg-white/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:top-[4.5rem]">
        <div>
          <p className="text-sm font-black text-[#183029]">
            Prévia do entregável
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Revise o conteúdo antes de gerar o arquivo.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#b8cec5] bg-white px-4 text-xs font-black text-[#0a4938] transition hover:bg-[#f3f7f5]"
            href={backHref}
          >
            Voltar ao Plano Alimentar
          </Link>

          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#12664f] px-4 text-xs font-black text-white transition hover:bg-[#0a4938] disabled:cursor-wait disabled:opacity-65"
            disabled={
              downloadState === "GENERATING" || !canDownloadDefinitive
            }
            onClick={downloadPdf}
            type="button"
          >
            {downloadState === "GENERATING" ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Download aria-hidden="true" className="size-4" />
            )}
            {downloadState === "GENERATING" ? "Gerando PDF..." : "Baixar PDF"}
          </button>
        </div>
      </div>

      {downloadState === "ERROR" ? (
        <p
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
          role="alert"
        >
          Não foi possível gerar o PDF. Tente novamente.
        </p>
      ) : null}

      {!canDownloadDefinitive ? (
        <p
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"
          role="status"
        >
          Prévia do plano não aprovado. O PDF definitivo será liberado após a
          aprovação do nutricionista.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-[#e8eeea] p-2 sm:p-5">
        <MealPlanDocument
          issuedAt={issuedAt}
          patient={patient}
          plan={synchronizedPlan}
          professionals={professionals}
          preview={preview}
        />
      </div>
    </div>
  );
}
