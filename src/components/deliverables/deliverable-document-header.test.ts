import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CLINIC_INSTITUTIONAL_CONFIG,
  formatInstitutionalAddress,
} from "@/config/institution";

import { DeliverableDocumentHeader } from "./deliverable-document-header";

const cases = [
  {
    theme: "nutrition" as const,
    eyebrow: "Relatório Nutricional",
    title: "Personalizado",
    description: "Avaliação clínica, composição corporal, estratégia nutricional e plano alimentar integrados.",
    icon: "lucide-leaf",
  },
  {
    theme: "assessments" as const,
    eyebrow: "Avaliação Postural",
    title: "Relatório Postural",
    description: "Análise postural, identificação de assimetrias, observações por vista e orientação profissional integradas.",
    icon: "lucide-person-standing",
  },
  {
    theme: "performance" as const,
    eyebrow: "Sistema Integrado SV",
    title: "Plano de Treino",
    icon: "lucide-dumbbell",
  },
];

test("os três cabeçalhos exibem a identificação institucional centralizada e o título do relatório", () => {
  for (const document of cases) {
    const html = renderToStaticMarkup(createElement(DeliverableDocumentHeader, document));

    assert.match(html, /data-institutional-identity="clinic-sv"/);
    assert.match(html, new RegExp(CLINIC_INSTITUTIONAL_CONFIG.brand.displayName));
    assert.match(html, new RegExp(formatInstitutionalAddress(CLINIC_INSTITUTIONAL_CONFIG.address)));
    for (const contact of CLINIC_INSTITUTIONAL_CONFIG.contacts) {
      assert.match(html, new RegExp(contact.value.replace(/[()]/gu, "\\$&")));
    }
    assert.match(html, new RegExp(CLINIC_INSTITUTIONAL_CONFIG.website.replaceAll(".", "\\.")));
    assert.match(html, /flex items-start justify-between gap-4/);
    assert.match(html, /mt-5 min-w-0 text-center/);
    assert.match(html, new RegExp(document.eyebrow));
    assert.match(html, new RegExp(document.title));
    if (document.description) assert.match(html, new RegExp(document.description));

    assert.match(html, new RegExp(document.icon));
    assert.match(html, /size-10 shrink-0 border-0 bg-transparent fill-none shadow-none ring-0/);
    assert.match(html, /sm:size-16 print:size-16/);
    assert.ok(html.indexOf("data-institutional-identity") < html.indexOf("<svg"));
    assert.ok(html.indexOf("<svg") < html.indexOf("<h1"));
    assert.doesNotMatch(html, /w-36 rounded-xl border/);
  }
});

test("o cabeçalho de performance escolhe o ícone pela modalidade sem alterar cor ou dimensões", () => {
  const modalities = [
    { performanceModality: "running" as const, icon: "data-runner-icon=\"true\"" },
    { performanceModality: "bike" as const, icon: "lucide-bike" },
    { performanceModality: "strength" as const, icon: "lucide-dumbbell" },
  ];

  for (const modality of modalities) {
    const html = renderToStaticMarkup(createElement(DeliverableDocumentHeader, {
      eyebrow: "Sistema Integrado SV",
      performanceModality: modality.performanceModality,
      theme: "performance",
      title: "Documento de performance",
    }));

    assert.match(html, new RegExp(modality.icon));
    assert.match(html, /text-\[#d8bd78\]/);
    assert.match(html, /size-10 shrink-0 border-0 bg-transparent fill-none shadow-none ring-0/);
    assert.match(html, /sm:size-16 print:size-16/);
  }

  const generalPlan = renderToStaticMarkup(createElement(DeliverableDocumentHeader, {
    eyebrow: "Sistema Integrado SV",
    theme: "performance",
    title: "Plano de Treino",
  }));
  assert.match(generalPlan, /lucide-dumbbell/);
});

test("as três prévias oficiais usam o cabeçalho compartilhado", async () => {
  const [nutrition, postural, performance] = await Promise.all([
    readFile(new URL("./nutrition-deliverable-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("./postural-deliverable-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("./performance-deliverable-preview.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(nutrition, /<DeliverableDocumentHeader[\s\S]*?theme="nutrition"/);
  assert.match(postural, /<DeliverableDocumentHeader[\s\S]*?theme="assessments"/);
  assert.match(performance, /<DeliverableDocumentHeader[\s\S]*?theme="performance"/);
  assert.match(performance, /performanceModality=\{runningOnly \? "running" : undefined\}/);
});
