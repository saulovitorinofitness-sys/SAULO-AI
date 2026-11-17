import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { academyManagementService } from "@/features/financial/academy-management/server";

import { AcademyManagementPanel } from "./academy-management-panel";

test("renderiza o painel executivo com a visão gerencial real de 2026", async () => {
  const view = await academyManagementService.getView(2026);
  assert.equal(view.availability, "AVAILABLE");
  const html = renderToStaticMarkup(
    <AcademyManagementPanel onViewFullDre={() => undefined} view={view} />,
  );

  assert.match(html, /Painel Gerencial/);
  assert.match(html, /Academia Saulo Fitness/);
  assert.match(html, /Exercício 2026/);
  assert.match(html, /7 de 12/);
  assert.match(html, /58,3%/);
  assert.match(html, /Janeiro → Julho: apurados/);
  assert.match(html, /Agosto → Dezembro: pendentes/);
  assert.match(html, /Receita Bruta/);
  assert.match(html, /R\$ 64\.685,00/);
  assert.match(html, /Receita Líquida/);
  assert.match(html, /R\$ 59\.468,00/);
  assert.match(html, /Lucro\/Prejuízo Final/);
  assert.match(html, /R\$ 45\.666,94/);
  assert.match(html, /Margem/);
  assert.match(html, /76,8%/);
  assert.match(html, /Ver DRE completa/);
  assert.match(html, /Fotografia gerencial da DRE/);
  assert.match(html, /Melhor mês · Lucro\/Prejuízo Final/);
  assert.match(html, /Pior mês · Lucro\/Prejuízo Final/);
  assert.match(html, /Lucro\/Prejuízo Final médio mensal/);
  assert.match(html, /R\$ 0,00/);
  assert.match(html, /R\$ 9\.333,17/);
  assert.match(html, /-R\$ 5\.092,00/);
  assert.match(html, /whitespace-nowrap/);
});

test("mantém meses futuros visíveis como pendentes, fora da evolução realizada", async () => {
  const view = await academyManagementService.getView(2026);
  assert.equal(view.availability, "AVAILABLE");
  const html = renderToStaticMarkup(
    <AcademyManagementPanel onViewFullDre={() => undefined} view={view} />,
  );
  const chart = html.match(/role="img"[\s\S]*?<p class="sr-only">([\s\S]*?)<\/p>/)?.[1] ?? "";

  assert.match(chart, /Janeiro:/);
  assert.match(chart, /Julho:/);
  assert.doesNotMatch(chart, /Agosto:/);
  assert.doesNotMatch(chart, /Setembro:/);
  assert.doesNotMatch(chart, /Outubro:/);
  assert.doesNotMatch(chart, /Novembro:/);
  assert.doesNotMatch(chart, /Dezembro:/);
  assert.equal((html.match(/Competência pendente/g) ?? []).length, 5);
});
