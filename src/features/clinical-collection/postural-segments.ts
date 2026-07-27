import type { PosturalViewKey } from "./contracts";

export interface PosturalSegmentDefinition {
  readonly key: string;
  readonly name: string;
  readonly objective: string;
  readonly options: readonly string[];
  readonly definition: string;
  readonly howToObserve: string;
  readonly biomechanicalAssociations: string;
  readonly investigationSuggestions: readonly string[];
}

const standardInvestigations = [
  "Mobilidade",
  "Histórico de dor",
  "Avaliação funcional",
  "Outro",
] as const;

function segment(
  key: string,
  name: string,
  objective: string,
  options: readonly string[],
  howToObserve: string,
): PosturalSegmentDefinition {
  return {
    key,
    name,
    objective,
    options: [
      "Sem alteração aparente",
      ...options,
      "Outra alteração observada",
    ],
    definition: `${name} é documentado nesta vista como referência do alinhamento aparente e da organização corporal observada.`,
    howToObserve,
    biomechanicalAssociations:
      "Uma alteração aparente sugere investigar mobilidade, controle motor, hábitos posturais e histórico funcional antes de qualquer conclusão clínica.",
    investigationSuggestions: standardInvestigations,
  };
}

const anterior = [
  segment(
    "head",
    "Cabeça",
    "Observar o alinhamento aparente da cabeça no plano frontal.",
    ["Inclinação aparente à direita", "Inclinação aparente à esquerda", "Rotação aparente"],
    "Observe a relação aparente entre linha dos olhos, orelhas e eixo central do tronco.",
  ),
  segment(
    "face",
    "Face",
    "Documentar assimetrias faciais aparentes relevantes para a avaliação.",
    ["Assimetria aparente à direita", "Assimetria aparente à esquerda"],
    "Compare referências horizontais aparentes da face, registrando somente o que foi observado.",
  ),
  segment(
    "jaw",
    "Mandíbula",
    "Observar o posicionamento aparente da mandíbula.",
    ["Desvio aparente à direita", "Desvio aparente à esquerda"],
    "Observe a posição aparente do mento em relação ao centro da face.",
  ),
  segment(
    "neck",
    "Pescoço",
    "Avaliar o alinhamento aparente do pescoço no plano frontal.",
    ["Inclinação aparente à direita", "Inclinação aparente à esquerda", "Rotação aparente"],
    "Observe a relação entre cabeça, pescoço e cintura escapular.",
  ),
  segment(
    "shoulders",
    "Ombros",
    "Avaliar o alinhamento aparente dos ombros no plano frontal.",
    ["Ombro direito elevado", "Ombro esquerdo elevado", "Ombros protraídos", "Ombros retraídos"],
    "Compare a altura aparente dos acrômios e a relação dos ombros com o tronco.",
  ),
  segment(
    "clavicles",
    "Clavículas",
    "Observar a simetria aparente das clavículas.",
    ["Clavícula direita elevada", "Clavícula esquerda elevada", "Assimetria aparente"],
    "Compare inclinação e altura aparentes das clavículas.",
  ),
  segment(
    "thorax",
    "Tórax",
    "Documentar a organização aparente do tórax no plano frontal.",
    ["Assimetria aparente", "Rotação aparente", "Expansão aparente assimétrica"],
    "Observe contorno, rotação aparente e relação com a cintura escapular.",
  ),
  segment(
    "tales_triangle",
    "Triângulo de Tales",
    "Comparar os espaços aparentes entre braços e tronco.",
    ["Maior à direita", "Maior à esquerda", "Assimetria aparente bilateral"],
    "Compare os espaços laterais aparentes formados entre membros superiores e tronco.",
  ),
  segment(
    "trunk",
    "Tronco",
    "Observar o alinhamento aparente do tronco.",
    ["Inclinação aparente à direita", "Inclinação aparente à esquerda", "Rotação aparente"],
    "Use o eixo central corporal e a relação entre tórax e pelve como referências visuais.",
  ),
  segment(
    "pelvis",
    "Pelve",
    "Observar o posicionamento aparente da pelve no plano frontal.",
    ["Elevação aparente à direita", "Elevação aparente à esquerda", "Rotação aparente"],
    "Compare referências ósseas aparentes e registre somente o que foi observado.",
  ),
  segment(
    "iliac_crests",
    "Cristas Ilíacas",
    "Comparar a altura aparente das cristas ilíacas.",
    ["Crista direita elevada", "Crista esquerda elevada", "Assimetria aparente"],
    "Compare as referências aparentes direita e esquerda da pelve.",
  ),
  segment(
    "hips",
    "Quadris",
    "Observar o alinhamento aparente dos quadris.",
    ["Assimetria aparente à direita", "Assimetria aparente à esquerda", "Rotação aparente"],
    "Observe a relação aparente entre pelve, quadris e membros inferiores.",
  ),
  segment(
    "knees",
    "Joelhos",
    "Observar o alinhamento aparente dos joelhos no plano frontal.",
    ["Tendência aparente em valgo", "Tendência aparente em varo", "Assimetria aparente"],
    "Compare o eixo aparente entre quadris, joelhos e tornozelos.",
  ),
  segment(
    "patellae",
    "Patelas",
    "Observar a orientação aparente das patelas.",
    ["Orientação aparente medial", "Orientação aparente lateral", "Assimetria aparente"],
    "Observe a direção aparente das patelas com os pés em apoio habitual.",
  ),
  segment(
    "tibias",
    "Tíbias",
    "Observar o alinhamento aparente das tíbias.",
    ["Rotação aparente interna", "Rotação aparente externa", "Assimetria aparente"],
    "Compare o eixo aparente das pernas entre joelhos e tornozelos.",
  ),
  segment(
    "ankles",
    "Tornozelos",
    "Observar o alinhamento aparente dos tornozelos.",
    ["Inclinação aparente medial", "Inclinação aparente lateral", "Assimetria aparente"],
    "Observe a relação aparente entre pernas, tornozelos e pés.",
  ),
  segment(
    "calcanei",
    "Calcâneos",
    "Observar referências aparentes dos calcâneos na vista anterior.",
    ["Assimetria aparente à direita", "Assimetria aparente à esquerda"],
    "Use apenas referências visíveis, registrando limitações de observação quando necessário.",
  ),
  segment(
    "feet",
    "Pés",
    "Observar o posicionamento aparente dos pés.",
    ["Rotação aparente interna", "Rotação aparente externa", "Assimetria aparente"],
    "Observe a orientação aparente dos pés no apoio habitual.",
  ),
  segment(
    "plantar_support",
    "Apoio Plantar",
    "Documentar a distribuição aparente do apoio plantar.",
    ["Predomínio aparente medial", "Predomínio aparente lateral", "Apoio aparente assimétrico"],
    "Observe o apoio aparente sem substituir avaliação plantar específica.",
  ),
  segment(
    "center_of_gravity",
    "Centro de Gravidade",
    "Observar a projeção aparente do centro corporal.",
    ["Deslocamento aparente à direita", "Deslocamento aparente à esquerda", "Deslocamento aparente anterior ou posterior"],
    "Use a base de apoio e o eixo corporal como referências visuais aproximadas.",
  ),
] as const;

const posterior = [
  segment("head", "Cabeça", "Observar o alinhamento aparente da cabeça na vista posterior.", ["Inclinação aparente à direita", "Inclinação aparente à esquerda", "Rotação aparente"], "Compare referências aparentes da cabeça com o eixo do tronco."),
  segment("neck", "Pescoço", "Observar o alinhamento aparente do pescoço.", ["Inclinação aparente à direita", "Inclinação aparente à esquerda", "Rotação aparente"], "Observe a transição aparente entre cabeça, pescoço e ombros."),
  segment("shoulders", "Ombros", "Comparar a altura e o posicionamento aparente dos ombros.", ["Ombro direito elevado", "Ombro esquerdo elevado", "Protração aparente", "Retração aparente"], "Compare altura aparente dos acrômios e relação com as escápulas."),
  segment("scapulae", "Escápulas", "Documentar o posicionamento aparente das escápulas.", ["Escápula direita mais evidente", "Escápula esquerda mais evidente", "Abdução aparente", "Adução aparente"], "Observe bordas mediais, ângulos inferiores e simetria aparente."),
  segment("cervical_spine", "Coluna Cervical", "Observar o alinhamento aparente da região cervical.", ["Desvio aparente à direita", "Desvio aparente à esquerda"], "Observe o eixo aparente da região cervical sem inferir condição estrutural."),
  segment("thoracic_spine", "Coluna Torácica", "Observar o alinhamento aparente da região torácica.", ["Desvio aparente à direita", "Desvio aparente à esquerda", "Rotação aparente"], "Observe o eixo aparente do tronco e possíveis assimetrias superficiais."),
  segment("lumbar_spine", "Coluna Lombar", "Observar o alinhamento aparente da região lombar.", ["Desvio aparente à direita", "Desvio aparente à esquerda", "Rotação aparente"], "Compare o eixo lombar aparente com tórax e pelve."),
  segment("tales_triangle", "Triângulo de Tales", "Comparar os espaços aparentes entre braços e tronco.", ["Maior à direita", "Maior à esquerda", "Assimetria aparente bilateral"], "Compare os espaços laterais aparentes formados entre membros superiores e tronco."),
  segment("pelvis", "Pelve", "Observar o posicionamento aparente da pelve.", ["Elevação aparente à direita", "Elevação aparente à esquerda", "Rotação aparente"], "Compare referências aparentes da pelve e sua relação com o tronco."),
  segment("iliac_crests", "Cristas Ilíacas", "Comparar a altura aparente das cristas ilíacas.", ["Crista direita elevada", "Crista esquerda elevada", "Assimetria aparente"], "Compare referências aparentes direita e esquerda."),
  segment("gluteal_folds", "Pregas Glúteas", "Comparar a altura aparente das pregas glúteas.", ["Prega direita elevada", "Prega esquerda elevada", "Assimetria aparente"], "Observe a simetria aparente sem inferir alteração estrutural."),
  segment("knees", "Joelhos", "Observar o alinhamento aparente posterior dos joelhos.", ["Tendência aparente em valgo", "Tendência aparente em varo", "Assimetria aparente"], "Compare o eixo aparente dos membros inferiores."),
  segment("calcanei", "Calcâneos", "Observar o alinhamento aparente dos calcâneos.", ["Inclinação aparente medial", "Inclinação aparente lateral", "Assimetria aparente"], "Observe a orientação aparente de cada calcâneo em apoio habitual."),
  segment("achilles_tendon", "Tendão de Aquiles", "Observar o trajeto aparente dos tendões de Aquiles.", ["Desvio aparente medial", "Desvio aparente lateral", "Assimetria aparente"], "Compare o trajeto aparente bilateral entre panturrilhas e calcâneos."),
  segment("feet", "Pés", "Observar o posicionamento aparente dos pés na vista posterior.", ["Rotação aparente interna", "Rotação aparente externa", "Assimetria aparente"], "Observe orientação e base de apoio aparentes."),
] as const;

const lateral = [
  segment("head", "Cabeça", "Observar a projeção aparente da cabeça no plano sagital.", ["Anteriorização aparente", "Posteriorização aparente"], "Compare o posicionamento aparente da cabeça com ombro e tronco."),
  segment("jaw", "Mandíbula", "Observar o posicionamento aparente da mandíbula no perfil.", ["Projeção anterior aparente", "Recuo aparente"], "Observe a relação aparente entre mandíbula, face e pescoço."),
  segment("cervical_spine", "Coluna Cervical", "Observar a curvatura aparente da região cervical.", ["Curvatura aparente aumentada", "Curvatura aparente reduzida"], "Observe o contorno aparente cervical e registre somente o que foi observado."),
  segment("shoulders", "Ombros", "Observar a projeção aparente dos ombros no perfil.", ["Protração aparente", "Retração aparente", "Elevação aparente"], "Compare o ombro aparente com o eixo do tronco."),
  segment("thoracic_spine", "Coluna Torácica", "Observar a curvatura aparente da região torácica.", ["Curvatura aparente aumentada", "Curvatura aparente reduzida"], "Observe o contorno aparente torácico em postura habitual."),
  segment("lumbar_lordosis", "Lordose Lombar", "Observar a curvatura aparente da região lombar.", ["Curvatura aparente aumentada", "Curvatura aparente reduzida"], "Observe a relação aparente entre região lombar, pelve e tronco."),
  segment("pelvis", "Pelve", "Observar a inclinação aparente da pelve no perfil.", ["Inclinação anterior aparente", "Inclinação posterior aparente"], "Use referências aparentes da pelve e do tronco."),
  segment("hip", "Quadril", "Observar o alinhamento aparente do quadril.", ["Flexão aparente", "Extensão aparente", "Deslocamento aparente"], "Compare a projeção aparente do quadril com tronco e joelho."),
  segment("knees", "Joelhos", "Observar o alinhamento aparente dos joelhos no perfil.", ["Flexão aparente", "Hiperextensão aparente"], "Observe o eixo aparente entre quadril, joelho e tornozelo."),
  segment("ankles", "Tornozelos", "Observar o alinhamento aparente dos tornozelos no perfil.", ["Flexão aparente aumentada", "Extensão aparente aumentada"], "Observe a relação aparente entre perna, tornozelo e pé."),
  segment("center_of_gravity", "Centro de Gravidade", "Observar a projeção aparente do centro corporal no perfil.", ["Deslocamento anterior aparente", "Deslocamento posterior aparente"], "Use o eixo corporal e a base de apoio como referências visuais aproximadas."),
] as const;

export const posturalSegmentsByView: Readonly<
  Record<PosturalViewKey, readonly PosturalSegmentDefinition[]>
> = {
  ANTERIOR: anterior,
  POSTERIOR: posterior,
  RIGHT_LATERAL: lateral,
  LEFT_LATERAL: lateral,
};
