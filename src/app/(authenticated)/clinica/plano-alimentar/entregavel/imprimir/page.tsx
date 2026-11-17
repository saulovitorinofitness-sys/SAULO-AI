import type { Metadata } from "next";

import NutritionDeliverablePage from "../page";

export const metadata: Metadata = {
  title: "Imprimir documento oficial",
};

export default function NutritionDeliverablePrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    attendanceId?: string;
    deliverableId?: string;
    masterRecordId?: string;
    entryId?: string;
    versionId?: string;
    documentType?: string;
    intent?: string;
  }>;
}) {
  return NutritionDeliverablePage({
    searchParams: searchParams.then((query) => {
      const view =
        query.documentType === "postural" ||
        query.documentType === "performance" ||
        query.documentType === "meal-plan" ||
        query.documentType === "meal-plan-draft"
          ? query.documentType
          : "nutrition";
      return {
        ...query,
        view,
        source:
          (view === "postural" || view === "performance") &&
          query.masterRecordId && query.entryId
            ? "global-deliverables"
            : undefined,
        print: "1",
      };
    }),
  });
}
