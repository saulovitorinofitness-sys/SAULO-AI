import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("./issuer-configuration-workspace.tsx", import.meta.url);
const pageUrl = new URL("../../app/(authenticated)/gestao/financeiro/recibos-servicos/configuracao-emissores/page.tsx", import.meta.url);

test("tela apresenta as quatro secoes e a hierarquia de navegacao", async () => {
  const [component, page] = await Promise.all([readFile(componentUrl, "utf8"), readFile(pageUrl, "utf8")]);
  for (const title of ["Academia Saulo Fitness", "Clínica SV", "Saulo Xavier Vitorino", "Maria de Lourdes Gomes"]) assert.match(component, new RegExp(title, "u"));
  assert.match(page, /Gestão · Financeiro · Recibos de Serviços/u);
  assert.match(component, /Utiliza os dados legais e o CNPJ da Academia Saulo Fitness/u);
});

test("Maria nao recebe campo CRN e documentos permanecem mascarados apos salvar", async () => {
  const component = await readFile(componentUrl, "utf8");
  assert.match(component, /section === "SAULO" \? <RegistrationFields[^>]+\{\.\.\.registration\("CRN"\)\}/u);
  assert.match(component, /Preencha somente para substituir/u);
  assert.match(component, /setAcademyDocument\(""\)/u);
  assert.match(component, /setPersonalDocuments\(\{ SAULO: "", MARIA: "" \}\)/u);
});

test("tela informa rascunho incompleto e bloqueio de emissao", async () => {
  const component = await readFile(componentUrl, "utf8");
  assert.match(component, /Rascunhos incompletos podem ser salvos/u);
  assert.match(component, /emissão fica bloqueada/u);
  assert.match(component, /Completo/u);
  assert.match(component, /Incompleto/u);
  assert.match(component, /Inativo/u);
});
