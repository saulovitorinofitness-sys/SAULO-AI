import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeScientificLibraryFile,
  buildScientificLibraryImportPreview,
  suggestScientificLibraryMapping,
} from "./import";

function previewFor(analysis: Awaited<ReturnType<typeof analyzeScientificLibraryFile>>) {
  return buildScientificLibraryImportPreview({
    analysis,
    mapping: suggestScientificLibraryMapping(analysis.headers),
    area: "PERFORMANCE",
    domain: "EXERCISE",
    status: "DRAFT",
    currentItems: [],
  });
}

test("preserva em JSON todos os atributos estruturados do cadastro de exercício", async () => {
  const analysis = await analyzeScientificLibraryFile(
    new File(
      [JSON.stringify({
        items: [{
          Nome: "Registro técnico temporário JSON",
          Modalidade: "Peso corporal",
          "Padrão de movimento": "Agachar",
          Classificações: ["Multiarticular", "Dinâmico"],
          "Nível de dificuldade": "Iniciante",
          "Grupos musculares / regiões": ["Quadríceps", "Glúteos"],
          "Músculos primários": ["Grupo primário temporário"],
          "Músculos secundários / sinergistas": ["Grupo secundário temporário"],
          Equipamentos: ["Peso corporal"],
          "Equipamento complementar": "",
          "Posição inicial": "Posição temporária de validação.",
          "Execução técnica": "Execução temporária de validação.",
          "Erros comuns": ["Erro temporário de validação"],
          "Cuidados / restrições profissionais": "Requer decisão profissional.",
          Tags: ["validação-temporária"],
          "Fonte/origem": "Fonte autorizada de teste",
          "Observações profissionais": "Fixture não persistida.",
          "URL de vídeo demonstrativo": "https://example.invalid/video",
          "URL de imagem": "https://example.invalid/imagem",
        }],
      })],
      "catalogo.json",
      { type: "application/json" },
    ),
  );
  const preview = previewFor(analysis);
  const draft = preview.rows[0]?.draft;

  assert.equal(preview.valid, 1);
  assert.deepEqual(preview.unrecognizedFields, []);
  assert.ok(draft);
  assert.equal(draft.attributes["Padrão de movimento"], "Agachar");
  assert.deepEqual(draft.attributes.Classificações, ["Multiarticular", "Dinâmico"]);
  assert.deepEqual(draft.attributes["Grupos musculares / regiões"], ["Quadríceps", "Glúteos"]);
  assert.deepEqual(draft.attributes.Equipamentos, ["Peso corporal"]);
  assert.equal(draft.attributes["URL de imagem demonstrativa"], "https://example.invalid/imagem");
});

test("aceita listas delimitadas no CSV e sinaliza campos de prescrição como não reconhecidos", async () => {
  const analysis = await analyzeScientificLibraryFile(
    new File(
      [[
        "Nome,Fonte,Modalidade,Classificações,Equipamentos,Repetições,RPE",
        "Registro técnico temporário CSV,Fonte autorizada de teste,Musculação,Multiarticular|Dinâmico,Barra|Anilhas,10,8",
      ].join("\n")],
      "catalogo.csv",
      { type: "text/csv" },
    ),
  );
  const preview = previewFor(analysis);
  const draft = preview.rows[0]?.draft;

  assert.equal(preview.valid, 1);
  assert.deepEqual(preview.unrecognizedFields, ["Repetições", "RPE"]);
  assert.ok(draft);
  assert.deepEqual(draft.attributes.Classificações, ["Multiarticular", "Dinâmico"]);
  assert.deepEqual(draft.attributes.Equipamentos, ["Barra", "Anilhas"]);
  assert.equal("Repetições" in draft.attributes, false);
  assert.equal("RPE" in draft.attributes, false);
});

test("exige origem, valida URL e bloqueia nomes duplicados no mesmo lote", async () => {
  const missingSource = await analyzeScientificLibraryFile(
    new File(
      [JSON.stringify([{ Nome: "Registro sem origem" }])],
      "sem-origem.json",
      { type: "application/json" },
    ),
  );
  const invalidUrl = await analyzeScientificLibraryFile(
    new File(
      [JSON.stringify([{
        Nome: "Registro com URL inválida",
        Fonte: "Fonte autorizada de teste",
        "URL de vídeo demonstrativo": "javascript:alert(1)",
      }])],
      "url-invalida.json",
      { type: "application/json" },
    ),
  );
  const duplicates = await analyzeScientificLibraryFile(
    new File(
      [JSON.stringify([
        { Nome: "Registro duplicado temporário", Fonte: "Fonte autorizada de teste" },
        { Nome: "  REGISTRO DUPLICADO TEMPORÁRIO  ", Fonte: "Fonte autorizada de teste" },
      ])],
      "duplicados.json",
      { type: "application/json" },
    ),
  );

  assert.equal(previewFor(missingSource).invalid, 1);
  assert.match(previewFor(missingSource).rows[0].issues.join(" "), /fonte\/origem/i);
  assert.equal(previewFor(invalidUrl).invalid, 1);
  assert.match(previewFor(invalidUrl).rows[0].issues.join(" "), /URL HTTP ou HTTPS válida/);
  assert.equal(previewFor(duplicates).valid, 1);
  assert.equal(previewFor(duplicates).duplicates, 1);
});
