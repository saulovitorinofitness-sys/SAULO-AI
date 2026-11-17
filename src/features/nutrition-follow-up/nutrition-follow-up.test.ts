import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const servicePath = "src/features/nutrition-follow-up/service.ts";
const componentPath =
  "src/components/nutrition-follow-up/nutrition-follow-up-dashboard.tsx";
const pagePath =
  "src/app/(authenticated)/pacientes/[patientId]/evolucao-avaliacoes/page.tsx";
const legacyPagePath =
  "src/app/(authenticated)/pacientes/[patientId]/acompanhamento-nutricional/page.tsx";
const sharePagePath =
  "src/app/(authenticated)/pacientes/[patientId]/evolucao-avaliacoes/compartilhar/page.tsx";
const patientProgressPath =
  "src/components/patients/initial-consultation-progress.tsx";
const patientNavigationPath =
  "src/components/master-record/patient-navigation.tsx";
const assessmentsPagePath = "src/app/(authenticated)/avaliacoes/page.tsx";
const perimetryStepPath =
  "src/components/clinical-collection/perimetry-step.tsx";
const bioimpedanceStepPath =
  "src/components/clinical-collection/bioimpedance-step.tsx";
const collectionFlowPath =
  "src/components/clinical-collection/clinical-collection-flow.tsx";
const collectionPagePath =
  "src/app/(authenticated)/pacientes/[patientId]/atendimentos/[attendanceId]/coleta/page.tsx";
const perimetryEvolutionPath =
  "src/components/nutrition-follow-up/perimetry-evolution-panel.tsx";
const perimetryDefinitionsPath =
  "src/features/clinical-collection/field-definitions.ts";
const compositionPanelPath =
  "src/components/nutrition-follow-up/body-composition-comparison-panel.tsx";
const performancePanelPath =
  "src/components/nutrition-follow-up/performance-comparison-panel.tsx";
const performanceSelectorPath =
  "src/components/nutrition-follow-up/performance-comparison-selector.tsx";
const shellPath = "src/components/auth/authenticated-shell.tsx";

test("acompanhamento usa registros persistidos do MasterRecord sem criar histórico paralelo", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /prisma\.patient\.findFirst/);
  assert.match(source, /masterRecord:\s*\{/);
  assert.match(source, /physicalAssessment/);
  assert.match(source, /perimetry/);
  assert.match(source, /bioimpedance/);
  assert.doesNotMatch(source, /create\(|upsert\(|update\(|delete\(/);
});

test("dados ausentes permanecem ausentes e o gráfico exige dois valores válidos", async () => {
  const [service, component] = await Promise.all([
    readFile(servicePath, "utf8"),
    readFile(componentPath, "utf8"),
  ]);
  assert.match(service, /\? value\s*\n\s*: undefined/);
  assert.doesNotMatch(service, /\?\?\s*0/);
  assert.match(component, /Não registrado/);
  assert.match(component, /Uma medição disponível nesta seleção/);
  assert.match(component, /nenhuma avaliação desmarcada foi usada/i);
});

test("peso e medidas têm cores distintas, comparação temporal e origem acessível", async () => {
  const [component, composition] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(compositionPanelPath, "utf8"),
  ]);
  for (const expected of [
    "#0369a1",
    "#0f766e",
    "#ea580c",
    "#7c3aed",
    "Primeira × última selecionada",
    "Ver avaliação",
    "Rascunho",
    "Finalizado",
    "não são ligados quando o método muda",
  ]) {
    assert.ok(component.includes(expected), expected);
  }
  assert.match(composition, /Método:/);
});

test("resultados compactos preservam valores no gráfico e na impressão", async () => {
  const [dashboard, perimetry, composition] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(perimetryEvolutionPath, "utf8"),
    readFile(compositionPanelPath, "utf8"),
  ]);
  assert.match(dashboard, /Uma medição disponível nesta seleção/);
  assert.match(dashboard, /fontWeight="700"/);
  assert.match(dashboard, /evaluation-trend-chart-svg/);
  assert.match(dashboard, /lg:grid-cols-2 print:grid-cols-2/);
  assert.match(dashboard, /const height = 232/);
  assert.match(dashboard, /fillOpacity="0\.08"/);
  assert.match(dashboard, /Comparação com base zero/);
  assert.match(dashboard, /timestamp - firstTimestamp/);
  assert.match(dashboard, /Detalhes técnicos/);
  assert.match(dashboard, /print:hidden/);
  assert.match(perimetry, /xl:grid-cols-2/);
  assert.match(perimetry, /Lado direito/);
  assert.match(perimetry, /Lado esquerdo/);
  assert.match(perimetry, /Medida central/);
  assert.match(perimetry, /evaluation-trend-chart-svg/);
  assert.match(perimetry, /plot = \{ left: 66, right: 48, top: 42, bottom: 50 \}/);
  assert.match(perimetry, /formatGraphDate\(item\.date\)/);
  assert.match(perimetry, /key === "waistCm".*#7c3aed/);
  assert.match(perimetry, /key === "abdomenCm".*#ea580c/);
  assert.match(perimetry, /key === "hipCm".*#0f766e/);
  assert.match(perimetry, /Comparação com base zero/);
  assert.match(perimetry, /timestamp - firstTimestamp/);
  assert.match(composition, /Uma medição disponível nesta seleção/);
  assert.match(composition, /Comparação com base zero/);
  assert.match(composition, /Evolução cronológica/);
  assert.match(composition, /const height = 232/);
  assert.match(composition, /plot = \{ left: 52, right: 44, top: 38, bottom: 46 \}/);
  assert.match(composition, /formatGraphDate\(point\.evaluation\.date\)/);
  assert.match(composition, /fillOpacity="0\.08"/);
  assert.match(composition, /p\.p\./);
  assert.match(composition, /`Nível \$\{numberFormatter\.format\(value\)\}`/);
  assert.match(composition, /Math\.abs\(value\) === 1 \? "nível" : "níveis"/);
  assert.doesNotMatch(dashboard, /text-(?:emerald|rose)-\d+[^\n]*Diferença/);
});

test("rota geral exige prontuário e ao menos uma permissão de avaliação", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.match(page, /canAccess\(access, "MASTER_RECORD", "READ"\)/);
  assert.match(page, /"PHYSICAL_ASSESSMENT", "PERIMETRY", "BIOIMPEDANCE"/);
  assert.doesNotMatch(page, /NUTRITION_STRATEGY/);
});

test("endereço anterior redireciona e apresentação é somente leitura", async () => {
  const [legacyPage, sharePage, component] = await Promise.all([
    readFile(legacyPagePath, "utf8"),
    readFile(sharePagePath, "utf8"),
    readFile(componentPath, "utf8"),
  ]);
  assert.match(legacyPage, /redirect\(`\/pacientes\/\$\{patientId\}\/evolucao-avaliacoes/);
  assert.match(sharePage, /presentationMode/);
  assert.match(component, /Visualização para compartilhar/);
});

test("acesso à evolução é explícito no prontuário e na seleção de pacientes", async () => {
  const [progress, navigation, assessments] = await Promise.all([
    readFile(patientProgressPath, "utf8"),
    readFile(patientNavigationPath, "utf8"),
    readFile(assessmentsPagePath, "utf8"),
  ]);
  assert.match(progress, /Ação principal/);
  assert.match(progress, />\s*Evolução e comparativos\s*</);
  assert.match(navigation, /label: "Evolução e comparativos"/);
  assert.equal(
    assessments.match(/>\s*Evolução e comparativos\s*</g)?.length,
    2,
  );
});

test("coletas mantêm um único acesso à evolução e protegem alterações pendentes", async () => {
  const [perimetry, bioimpedance, flow, page, dashboard] = await Promise.all([
    readFile(perimetryStepPath, "utf8"),
    readFile(bioimpedanceStepPath, "utf8"),
    readFile(collectionFlowPath, "utf8"),
    readFile(collectionPagePath, "utf8"),
    readFile(componentPath, "utf8"),
  ]);
  assert.match(perimetry, />\s*Comparar avaliações\s*</);
  assert.match(bioimpedance, />\s*Comparar avaliações\s*</);
  assert.doesNotMatch(perimetry, /NutritionFollowUpDashboard|EvaluationComparisonSelector/);
  assert.doesNotMatch(page, /nutritionFollowUpService/);
  assert.match(flow, /if \(!confirmDiscard\(\)\) return;/);
  assert.match(flow, /openComparisons\("measures"\)/);
  assert.match(flow, /openComparisons\("composition"\)/);
  assert.match(dashboard, /EvaluationComparisonSelector/);
  assert.doesNotMatch(perimetry, /onSave=.*evaluation/i);
});

test("área única oferece abas reais e separa prescrição de execução", async () => {
  const [dashboard, performance, performanceSelector] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(performancePanelPath, "utf8"),
    readFile(performanceSelectorPath, "utf8"),
  ]);
  for (const expected of [
    "Medidas corporais",
    "Composição corporal",
    "Performance",
    "Imprimir",
    "Salvar em PDF",
  ]) {
    assert.ok(dashboard.includes(expected), expected);
  }
  assert.match(performance, /Prescrição/);
  assert.match(performance, /Sessões programadas/);
  assert.match(performance, /Execuções registradas/);
  assert.match(performance, /Nenhum resultado de Performance foi estimado ou criado/);
  assert.match(performanceSelector, /prescription:/);
  assert.match(performanceSelector, /scheduled:/);
  assert.match(performanceSelector, /execution:/);
  assert.doesNotMatch(performanceSelector, /Perimetria|Bioimpedância/);
});

test("menu e busca abrem comparativos sem iniciar atendimento", async () => {
  const [shell, assessments, page] = await Promise.all([
    readFile(shellPath, "utf8"),
    readFile(assessmentsPagePath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);
  assert.match(shell, /id: "evaluation-comparisons"/);
  assert.match(shell, /href: "\/avaliacoes\?view=comparativos"/);
  assert.match(shell, /requiredAnyPermission/);
  assert.match(assessments, /comparisonMode/);
  assert.match(assessments, /Comparar →/);
  assert.doesNotMatch(page, /PatientNavigation/);
  assert.match(page, /Trocar pessoa/);
  assert.match(page, /Voltar ao prontuário/);
});

test("evolução regional preserva definições, lados, ausências e referência da OMS", async () => {
  const [service, panel, definitions] = await Promise.all([
    readFile(servicePath, "utf8"),
    readFile(perimetryEvolutionPath, "utf8"),
    readFile(perimetryDefinitionsPath, "utf8"),
  ]);
  assert.match(service, /perimetryGroups\.flatMap/);
  assert.match(service, /positiveNumberValue/);
  assert.match(service, /perimetryStatus/);
  for (const expected of [
    "Região superior",
    "Tronco",
    "Membros superiores",
    "Membros inferiores",
    "Braço direito",
    "Braço esquerdo",
    "Coxa direita",
    "Coxa esquerda",
  ]) {
    assert.ok(definitions.includes(expected), expected);
  }
  for (const expected of [
    "Diferença: dados insuficientes",
    "Ausências não são convertidas em zero",
    "RCQ = cintura ÷ quadril",
    "cintura &gt;80 cm",
    "cintura &gt;94 cm",
    "RCQ ≥0,85",
    "RCQ ≥0,90",
    "não constituem diagnóstico",
    "9789241501491",
  ]) {
    assert.ok(panel.includes(expected), expected);
  }
});

test("compartilhamento preserva selecoes de avaliacoes, perimetria e Performance", async () => {
  const [dashboard, sharePage, perimetry] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(sharePagePath, "utf8"),
    readFile(perimetryEvolutionPath, "utf8"),
  ]);

  assert.match(dashboard, /avaliacoes=\$\{selectionParameter\}/);
  assert.match(dashboard, /performance=\$\{performanceSelectionParameter\}/);
  assert.match(dashboard, /regiao=\$\{perimetryRegionParameter\}/);
  assert.match(dashboard, /medidas=\$\{perimetryMetricsParameter\}/);
  assert.match(sharePage, /initialSelectedEvaluationIds=\{requestedIds\}/);
  assert.match(sharePage, /initialSelectedPerformanceIds=\{requestedPerformanceIds\}/);
  assert.match(sharePage, /initialPerimetryRegionKey=\{requestedPerimetryRegion\}/);
  assert.match(sharePage, /initialSelectedPerimetryKeys=\{requestedPerimetryKeys\}/);
  assert.match(perimetry, /const renderedRegions = selectedRegion \? \[selectedRegion\] : \[\]/);
  assert.match(perimetry, /selectedKeys\.includes\(field\.key as PerimetryMetricKey\)/);
  assert.doesNotMatch(perimetry, /presentationMode \? regionsWithData/);
  assert.doesNotMatch(perimetry, /presentationMode \|\| selectedKeys\.includes/);
});
