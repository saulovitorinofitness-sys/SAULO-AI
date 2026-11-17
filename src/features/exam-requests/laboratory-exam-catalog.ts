export interface LaboratoryExamCatalogDefinition {
  readonly name: string;
  readonly category: string;
  readonly synonyms: readonly string[];
}

/**
 * Vocabulário operacional para seleção manual de solicitações.
 * Não contém indicação clínica, preparo, resultado ou valor de referência.
 */
export const LABORATORY_EXAM_CATALOG: readonly LaboratoryExamCatalogDefinition[] = [
  { name: "Hemograma completo", category: "Hematologia", synonyms: ["Hemograma", "CBC"] },
  { name: "Contagem de reticulócitos", category: "Hematologia", synonyms: ["Reticulócitos"] },
  { name: "Velocidade de hemossedimentação", category: "Hematologia", synonyms: ["VHS", "Hemossedimentação"] },
  { name: "Coagulograma", category: "Hematologia", synonyms: ["Provas de coagulação"] },
  { name: "Tempo de protrombina", category: "Hematologia", synonyms: ["TP", "INR", "RNI"] },
  { name: "Tempo de tromboplastina parcial ativada", category: "Hematologia", synonyms: ["TTPa", "PTTa"] },
  { name: "Fibrinogênio", category: "Hematologia", synonyms: [] },

  { name: "Glicemia de jejum", category: "Metabolismo glicídico", synonyms: ["Glicose em jejum", "Glicemia basal"] },
  { name: "Hemoglobina glicada", category: "Metabolismo glicídico", synonyms: ["HbA1c", "A1C"] },
  { name: "Insulina de jejum", category: "Metabolismo glicídico", synonyms: ["Insulina basal"] },
  { name: "Curva glicêmica", category: "Metabolismo glicídico", synonyms: ["Teste oral de tolerância à glicose", "TOTG", "OGTT"] },
  { name: "Frutosamina", category: "Metabolismo glicídico", synonyms: [] },

  { name: "Colesterol total", category: "Perfil lipídico", synonyms: [] },
  { name: "Colesterol HDL", category: "Perfil lipídico", synonyms: ["HDL-c", "HDL colesterol"] },
  { name: "Colesterol LDL", category: "Perfil lipídico", synonyms: ["LDL-c", "LDL colesterol"] },
  { name: "Colesterol não HDL", category: "Perfil lipídico", synonyms: ["Não-HDL", "Non-HDL"] },
  { name: "Triglicerídeos", category: "Perfil lipídico", synonyms: ["Triglicérides"] },
  { name: "Apolipoproteína A1", category: "Perfil lipídico", synonyms: ["Apo A1", "ApoA-I"] },
  { name: "Apolipoproteína B", category: "Perfil lipídico", synonyms: ["Apo B", "ApoB"] },
  { name: "Lipoproteína(a)", category: "Perfil lipídico", synonyms: ["Lp(a)", "Lipoproteína a"] },

  { name: "Ureia", category: "Função renal e eletrólitos", synonyms: ["BUN"] },
  { name: "Creatinina", category: "Função renal e eletrólitos", synonyms: [] },
  { name: "Taxa de filtração glomerular estimada", category: "Função renal e eletrólitos", synonyms: ["TFGe", "eGFR"] },
  { name: "Cistatina C", category: "Função renal e eletrólitos", synonyms: [] },
  { name: "Sódio", category: "Função renal e eletrólitos", synonyms: ["Na"] },
  { name: "Potássio", category: "Função renal e eletrólitos", synonyms: ["K"] },
  { name: "Cloro", category: "Função renal e eletrólitos", synonyms: ["Cloreto", "Cl"] },
  { name: "Magnésio", category: "Função renal e eletrólitos", synonyms: ["Mg"] },
  { name: "Cálcio total", category: "Função renal e eletrólitos", synonyms: ["Cálcio sérico"] },
  { name: "Cálcio ionizado", category: "Função renal e eletrólitos", synonyms: ["Cálcio iônico"] },
  { name: "Fósforo", category: "Função renal e eletrólitos", synonyms: ["Fosfato"] },
  { name: "Ácido úrico", category: "Função renal e eletrólitos", synonyms: ["Uricemia"] },

  { name: "Alanina aminotransferase", category: "Função hepática", synonyms: ["ALT", "TGP"] },
  { name: "Aspartato aminotransferase", category: "Função hepática", synonyms: ["AST", "TGO"] },
  { name: "Gama-glutamil transferase", category: "Função hepática", synonyms: ["GGT", "Gama GT"] },
  { name: "Fosfatase alcalina", category: "Função hepática", synonyms: ["FA"] },
  { name: "Bilirrubina total e frações", category: "Função hepática", synonyms: ["Bilirrubinas"] },
  { name: "Albumina", category: "Função hepática", synonyms: ["Albumina sérica"] },
  { name: "Proteínas totais e frações", category: "Função hepática", synonyms: ["Proteinograma"] },

  { name: "Hormônio estimulante da tireoide", category: "Tireoide", synonyms: ["TSH", "Tireotrofina"] },
  { name: "Tiroxina livre", category: "Tireoide", synonyms: ["T4 livre", "T4L", "FT4"] },
  { name: "Triiodotironina", category: "Tireoide", synonyms: ["T3 total", "T3"] },
  { name: "Anticorpo antitireoperoxidase", category: "Tireoide", synonyms: ["Anti-TPO", "Anticorpo antimicrossomal"] },
  { name: "Anticorpo antitireoglobulina", category: "Tireoide", synonyms: ["Anti-Tg"] },

  { name: "Ferritina", category: "Vitaminas e minerais", synonyms: ["Ferritina sérica"] },
  { name: "Ferro sérico", category: "Vitaminas e minerais", synonyms: ["Ferro"] },
  { name: "Transferrina", category: "Vitaminas e minerais", synonyms: [] },
  { name: "Índice de saturação da transferrina", category: "Vitaminas e minerais", synonyms: ["IST", "Saturação de transferrina"] },
  { name: "Vitamina B12", category: "Vitaminas e minerais", synonyms: ["Cobalamina"] },
  { name: "Folato sérico", category: "Vitaminas e minerais", synonyms: ["Ácido fólico", "Vitamina B9"] },
  { name: "25-hidroxivitamina D", category: "Vitaminas e minerais", synonyms: ["25-OH vitamina D", "Vitamina D"] },
  { name: "Zinco", category: "Vitaminas e minerais", synonyms: ["Zn"] },
  { name: "Cobre", category: "Vitaminas e minerais", synonyms: ["Cu"] },

  { name: "Proteína C reativa", category: "Inflamação e imunologia", synonyms: ["PCR"] },
  { name: "Proteína C reativa ultrassensível", category: "Inflamação e imunologia", synonyms: ["PCR-us", "PCR ultrassensível"] },
  { name: "Fator antinuclear", category: "Inflamação e imunologia", synonyms: ["FAN", "ANA"] },
  { name: "Imunoglobulina A", category: "Inflamação e imunologia", synonyms: ["IgA"] },
  { name: "Anticorpo antitransglutaminase tecidual IgA", category: "Inflamação e imunologia", synonyms: ["Anti-tTG IgA", "Antitransglutaminase IgA"] },

  { name: "Cortisol", category: "Hormônios", synonyms: ["Cortisol sérico"] },
  { name: "Testosterona total", category: "Hormônios", synonyms: [] },
  { name: "Testosterona livre", category: "Hormônios", synonyms: [] },
  { name: "Globulina ligadora de hormônios sexuais", category: "Hormônios", synonyms: ["SHBG"] },
  { name: "Estradiol", category: "Hormônios", synonyms: ["E2"] },
  { name: "Progesterona", category: "Hormônios", synonyms: [] },
  { name: "Prolactina", category: "Hormônios", synonyms: ["PRL"] },
  { name: "Hormônio folículo-estimulante", category: "Hormônios", synonyms: ["FSH"] },
  { name: "Hormônio luteinizante", category: "Hormônios", synonyms: ["LH"] },
  { name: "Hormônio paratireoidiano", category: "Hormônios", synonyms: ["PTH", "Paratormônio"] },

  { name: "Urina tipo 1", category: "Urina e fezes", synonyms: ["EAS", "Sumário de urina", "Urina rotina"] },
  { name: "Relação albumina/creatinina urinária", category: "Urina e fezes", synonyms: ["RAC urinária", "Microalbuminúria"] },
  { name: "Urocultura", category: "Urina e fezes", synonyms: ["Cultura de urina"] },
  { name: "Parasitológico de fezes", category: "Urina e fezes", synonyms: ["EPF", "Exame parasitológico de fezes"] },
  { name: "Pesquisa de sangue oculto nas fezes", category: "Urina e fezes", synonyms: ["PSOF", "Sangue oculto fecal"] },
  { name: "Calprotectina fecal", category: "Urina e fezes", synonyms: [] },
] as const;

export function normalizeLaboratoryExamCatalogName(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("pt-BR");
}
