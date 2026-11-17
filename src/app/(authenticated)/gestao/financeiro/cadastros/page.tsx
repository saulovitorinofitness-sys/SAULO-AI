import type { Metadata } from "next";

import { FinancialCatalogWorkspace } from "@/components/financial/financial-catalog-workspace";
import { financialService } from "@/features/financial";

export const metadata: Metadata = { title: "Cadastros financeiros" };

export default async function FinancialCatalogPage() {
  const catalog = await financialService.catalog();
  return <FinancialCatalogWorkspace catalog={catalog} />;
}
