import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as XLSX from "@e965/xlsx";

import { ScientificLibraryImport } from "@/components/scientific-library/scientific-library-import";
import { ScientificLibraryDetails } from "@/components/scientific-library/scientific-library-details";
import { ScientificLibraryItemForm } from "@/components/scientific-library/scientific-library-item-form";
import { DEVELOPMENT_PROFESSIONALS } from "@/features/development-session";
import { prisma } from "@/lib/database/prisma";

import {
  analyzeScientificLibraryFile,
  buildScientificLibraryImportPreview,
  suggestScientificLibraryMapping,
} from "./import";
import {
  scientificLibraryDraftSchema,
  type ScientificLibraryDraft,
} from "./management-contracts";
import { scientificLibraryRepository } from "./repository";
import { scientificLibraryService } from "./service";
import { filterScientificLibraryItems } from "./organization";

const professionalUserId = DEVELOPMENT_PROFESSIONALS.saulo.user.id;

test("expõe ações compactas e formulário adaptado sem JSON bruto", () => {
  const form = renderToStaticMarkup(
    createElement(ScientificLibraryItemForm, {
      initialArea: "POSTURAL",
      initialDomain: "POSTURAL_CHANGE",
      onCancel: () => undefined,
      onSaved: () => undefined,
    }),
  );
  const importer = renderToStaticMarkup(
    createElement(ScientificLibraryImport, {
      currentItems: [],
      initialArea: "PERFORMANCE",
      initialDomain: "EXERCISE",
      onCancel: () => undefined,
      onImported: () => undefined,
    }),
  );

  assert.match(form, /Achado\/alteração observacional/);
  assert.match(form, /Não representa diagnóstico clínico automático/);
  assert.match(form, /Região corporal/);
  assert.match(importer, /Importar arquivo/);
  assert.match(importer, /CSV, XLSX ou JSON estruturado/);
  assert.doesNotMatch(form, /\{&quot;/);
});

test("expõe cadastro profissional de exercício em blocos estruturados", () => {
  const form = renderToStaticMarkup(
    createElement(ScientificLibraryItemForm, {
      initialArea: "PERFORMANCE",
      initialDomain: "EXERCISE",
      onCancel: () => undefined,
      onSaved: () => undefined,
    }),
  );

  for (const label of [
    "Identificação", "Anatomia / aplicação", "Execução", "Variações", "Referência",
    "Padrão de movimento", "Classificação do exercício", "Músculos primários",
    "Nível de dificuldade", "Cuidados / restrições profissionais",
    "Alternativas / substituições", "URL de vídeo demonstrativo",
  ]) assert.match(form, new RegExp(label));
  assert.match(form, /Salvar e sair/);
  assert.match(form, /Salvar e adicionar outro/);
  assert.match(form, /Fechar \/ Voltar/);
  assert.match(form, /autofocus/);
  assert.doesNotMatch(form, /\{&quot;/);
});

function draft(
  name: string,
  area: ScientificLibraryDraft["area"],
  domain: ScientificLibraryDraft["domain"],
  attributes: ScientificLibraryDraft["attributes"] = {},
): ScientificLibraryDraft {
  return scientificLibraryDraftSchema.parse({
    area,
    domain,
    name,
    description: "Validação automatizada temporária",
    tags: ["validação-temporária"],
    source: "Teste automatizado local",
    professionalNotes: "Registro removido ao final do teste.",
    status: "REVIEW",
    externalCode: "",
    classificationSystem: "",
    sourceVersion: "",
    attributes,
  });
}

test("analisa CSV, XLSX e JSON sem persistir durante o preview", async () => {
  const before = await prisma.scientificLibraryRecord.count();
  const csv = await analyzeScientificLibraryFile(
    new File(["Nome,Descrição,Tags,Fonte,Modalidade\nItem CSV,Descrição CSV,tag 1;tag 2,Fonte autorizada de teste,Musculação"], "itens.csv"),
  );
  const json = await analyzeScientificLibraryFile(
    new File(
      [JSON.stringify([{ Nome: "Item JSON", Descrição: "Descrição JSON", Fonte: "Fonte autorizada de teste" }])],
      "itens.json",
      { type: "application/json" },
    ),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Nome", "Descrição", "Fonte"],
      ["Item XLSX", "Descrição XLSX", "Fonte autorizada de teste"],
    ]),
    "Itens",
  );
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const xlsx = await analyzeScientificLibraryFile(
    new File([bytes], "itens.xlsx"),
  );

  for (const analysis of [csv, json, xlsx]) {
    const mapping = suggestScientificLibraryMapping(analysis.headers);
    const preview = buildScientificLibraryImportPreview({
      analysis,
      mapping,
      area: "PERFORMANCE",
      domain: "EXERCISE",
      status: "DRAFT",
      currentItems: [],
    });
    assert.equal(preview.total, 1);
    assert.equal(preview.valid, 1);
    assert.equal(preview.invalid, 0);
    if (analysis.format === "CSV") {
      assert.equal(preview.rows[0].draft?.attributes.Modalidade, "Musculação");
    }
  }
  assert.equal(await prisma.scientificLibraryRecord.count(), before);
});

test("classifica inválidos, duplicados e campos não reconhecidos no preview", () => {
  const analysis = {
    fileName: "preview.csv",
    format: "CSV" as const,
    headers: ["Nome", "Fonte", "Campo extra"],
    rows: [
      { rowNumber: 2, values: { Nome: "Exercício existente", Fonte: "Fonte autorizada de teste", "Campo extra": "x" } },
      { rowNumber: 3, values: { Nome: "Exercício existente", Fonte: "Fonte autorizada de teste", "Campo extra": "y" } },
      { rowNumber: 4, values: { Nome: "", Fonte: "Fonte autorizada de teste", "Campo extra": "z" } },
    ],
  };
  const preview = buildScientificLibraryImportPreview({
    analysis,
    mapping: { name: "Nome", source: "Fonte" },
    area: "PERFORMANCE",
    domain: "EXERCISE",
    status: "DRAFT",
    currentItems: [],
  });

  assert.equal(preview.valid, 1);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.invalid, 1);
  assert.deepEqual(preview.unrecognizedFields, ["Campo extra"]);
});

test("persiste taxonomias manuais e impede duplicado sem deixar fixtures", async () => {
  const suffix = randomUUID();
  const drafts = [
    draft(`Achado temporário ${suffix}`, "POSTURAL", "POSTURAL_CHANGE", {
      "Região corporal": "Coluna",
      "Plano / vista": "Lateral",
      Relevância: "Avaliação profissional necessária",
    }),
    draft(`Condição temporária ${suffix}`, "POSTURAL", "POSTURAL_CONDITION"),
    draft(`Exercício temporário ${suffix}`, "PERFORMANCE", "EXERCISE", {
      Modalidade: "Musculação",
      "Grupo muscular / região": "Membros inferiores",
      Equipamento: "Não informado",
      "Descrição de execução": "Validação temporária",
    }),
  ];
  const ids: string[] = [];
  try {
    for (const value of drafts) {
      const created = await scientificLibraryRepository.create({
        professionalUserId,
        draft: value,
        originKind: "MANUAL",
      });
      ids.push(created.id);
      assert.equal(created.domain, value.domain);
      assert.equal(created.area, value.area);
      assert.equal(created.status, "REVIEW");
    }

    await assert.rejects(
      scientificLibraryRepository.create({
        professionalUserId,
        draft: drafts[2],
        originKind: "MANUAL",
      }),
      (error: unknown) =>
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002",
    );
    assert.equal(
      await prisma.scientificLibraryRecord.count({
        where: { name: drafts[2].name },
      }),
      1,
    );
  } finally {
    if (ids.length) {
      await prisma.scientificLibraryRecord.deleteMany({
        where: { id: { in: ids } },
      });
    }
  }

  const view = await scientificLibraryService.getView(
    DEVELOPMENT_PROFESSIONALS.saulo.user,
  );
  assert.ok(view);
  assert.equal(view.items.length, 134);
  assert.equal(view.items.every((item) => Boolean(item.area)), true);
  assert.equal(
    view.items.some((item) => String(item.domain) === "INJURY_FACTOR"),
    false,
  );
  assert.equal(
    view.items.find((item) => item.name === "Protocolo clínico demonstrativo")?.area,
    "NUTRITION",
  );
  assert.equal(
    view.items.find((item) => item.name === "Protocolo de avaliação física")?.area,
    "PERFORMANCE",
  );
  assert.equal(
    view.items.find((item) => item.name === "Protocolo postural demonstrativo")?.area,
    "POSTURAL",
  );
  assert.equal(
    await prisma.scientificLibraryRecord.count({
      where: { name: { contains: suffix } },
    }),
    0,
  );
});

test("salva, carrega, edita e pesquisa exercício profissional completo sem deixar fixture", async () => {
  const suffix = randomUUID();
  const name = `Exercício profissional temporário ${suffix}`;
  const completeDraft = draft(name, "PERFORMANCE", "EXERCISE", {
    Modalidade: "Musculação",
    Classificações: ["Multiarticular", "Dinâmico"],
    "Padrão de movimento": "Agachar",
    "Grupos musculares / regiões": ["Quadríceps", "Glúteos"],
    "Músculos primários": ["Quadríceps", "Glúteo máximo"],
    "Músculos secundários / sinergistas": ["Isquiotibiais"],
    Equipamentos: ["Peso corporal", "Banco"],
    "Nível de dificuldade": "Adaptável a todos",
    "Objetivos / aplicações": ["Força", "Técnica"],
    "Posição inicial": "Posição temporária para validação.",
    "Execução técnica": "Execução temporária controlada.",
    "Erros comuns": ["Perda de alinhamento"],
    "Cuidados / restrições profissionais": "Exige avaliação profissional.",
    Regressões: ["Regressão temporária"],
    Progressões: ["Progressão temporária"],
    "Alternativas / substituições": ["Alternativa temporária"],
    "URL de vídeo demonstrativo": "https://example.invalid/video",
    "URL de imagem demonstrativa": "https://example.invalid/imagem",
  });
  let id: string | undefined;
  try {
    const created = await scientificLibraryRepository.create({
      professionalUserId,
      draft: completeDraft,
      originKind: "MANUAL",
    });
    id = created.id;
    const loaded = (await scientificLibraryRepository.list(professionalUserId)).find((item) => item.id === id);
    assert.ok(loaded);
    assert.deepEqual(loaded.attributes["Músculos primários"], ["Quadríceps", "Glúteo máximo"]);

    const updated = await scientificLibraryRepository.updateExercise({
      professionalUserId,
      id,
      draft: { ...completeDraft, description: "Descrição editada temporária", status: "ACTIVE" },
    });
    assert.ok(updated);
    assert.equal(updated.status, "ACTIVE");
    assert.equal(updated.description, "Descrição editada temporária");
    assert.equal(filterScientificLibraryItems([updated], {
      area: "PERFORMANCE", domain: "EXERCISE", query: "glúteo máximo",
      favoritesOnly: false, favorites: new Set<string>(),
    }).length, 1);

    const details = renderToStaticMarkup(createElement(ScientificLibraryDetails, { item: updated }));
    assert.match(details, /Músculos primários/);
    assert.match(details, /Glúteo máximo/);
    assert.doesNotMatch(details, /\[&quot;|\{&quot;/);
  } finally {
    if (id) await prisma.scientificLibraryRecord.deleteMany({ where: { id } });
  }
  assert.equal(await prisma.scientificLibraryRecord.count({ where: { name } }), 0);
});
