from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/imports/food/raw/Evonut.xlsm"
OUTPUT = ROOT / "data/imports/evonut-audit"

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN}
REL_NS = {"r": PACKAGE_REL}

PERSONAL_SHEETS = {
    "BD_DiasSemana", "BD_Documentos", "BD_Observacoes", "BD_Anamnese",
    "BD_PedidoExames", "BD_Antropometria", "BD_GastoEnerg",
    "BD_DefinicaoMetas", "BD_PlanAlimentar", "BD_Prescrições",
    "BD_Pacientes", "BD_Atendimentos", "Pacientes", "Atendimentos",
    "Agendamentos", "Anamnese", "Exames Laboratoriais", "Antropometria",
    "Gasto Energético", "Definição de Metas", "Plano Alimentar", "Prescrições",
}

POSSIBLE_PERSONAL_SHEETS = {
    "BD_Entregaveis", "BD_Entregaveis2", "BD_Entregaveis3", "Entregáveis",
    "Relatórios", "Iniciar",
}

PURPOSES = {
    "BD_Exames": "Catálogo de exames, grupos, unidades e faixas de referência por sexo.",
    "BD_DRIs": "Matriz de EAR, AI/RDA e UL por nutriente, sexo e faixa etária.",
    "BD_Percentis": "Curvas e tabelas de percentis antropométricos pediátricos.",
    "BD_DiasSemana": "Dias associados a atendimentos; dado operacional individual.",
    "BD_Medidas": "Medidas caseiras horizontais vinculadas ao código interno do alimento.",
    "BD_Substituicoes": "Conjuntos manuais de opções alimentares substitutas.",
    "BD_Documentos": "Índice de documentos por paciente e caminho local.",
    "BD_Observacoes": "Textos livres de observação.",
    "Calc_Antropometria": "Equações, classificações e tabelas auxiliares de antropometria.",
    "Calc_GastoEnerg": "Equações de TMB, fatores de atividade, METs e fatores de injúria.",
    "Calc_PlanAlimentar": "Cálculos nutricionais, DRIs, metas e comparação de substitutos.",
    "BD_Anamnese": "Respostas de anamnese por atendimento e paciente.",
    "BD_PedidoExames": "Pedidos e resultados laboratoriais individualizados.",
    "BD_Antropometria": "Medições e resultados antropométricos individualizados.",
    "BD_GastoEnerg": "Entradas e resultados energéticos por atendimento.",
    "BD_DefinicaoMetas": "Metas e distribuição de macros por atendimento.",
    "BD_PlanAlimentar": "Itens de planos alimentares de pacientes.",
    "BD_Prescrições": "Prescrições vinculadas a paciente e atendimento.",
    "BD_Entregaveis": "Modelo de plano/orientações e textos clínicos para entrega.",
    "BD_Entregaveis2": "Modelo de avaliação antropométrica para entrega.",
    "BD_Entregaveis3": "Bloco auxiliar/anexo de entregável.",
    "BD_Pacientes": "Cadastro completo de pacientes.",
    "BD_Atendimentos": "Cadastro de atendimentos e agenda.",
    "BD_Cadastros": "Catálogo de dietas, refeições, receitas, prescrições, orientações e pedidos.",
    "BD_Alimentos": "Catálogo nutricional consolidado de múltiplas fontes.",
    "Relatórios": "Indicadores agregados e apoio a relatórios.",
    "BD_Cad_Dietas": "Itens e composição de dietas, refeições e receitas cadastradas.",
    "BD_Cad_Pedidos": "Itens de modelos de pedidos de exames.",
    "BD_Diversos": "Listas, parâmetros, categorias e textos auxiliares do sistema.",
    "Iniciar": "Tela inicial e atalhos do aplicativo Evonut.",
    "Pacientes": "Tela operacional de pacientes.",
    "Atendimentos": "Tela operacional de atendimentos.",
    "Agendamentos": "Tela de agenda semanal.",
    "Materiais": "Tela de consulta aos materiais cadastrados.",
    "Alimentos": "Tela de consulta ao catálogo de alimentos.",
    "Anamnese": "Tela de preenchimento de anamnese.",
    "Exames Laboratoriais": "Tela de solicitação e registro de exames.",
    "Antropometria": "Tela de avaliação antropométrica.",
    "Gasto Energético": "Tela de cálculo energético.",
    "Definição de Metas": "Tela de metas calóricas e macronutrientes.",
    "Plano Alimentar": "Tela de montagem e análise do plano.",
    "Prescrições": "Tela de seleção de prescrições.",
    "Entregáveis": "Tela de seleção e composição dos materiais entregáveis.",
}

CLASSIFICATION = {
    "BD_Alimentos": "A", "BD_Medidas": "A", "BD_DRIs": "A",
    "Calc_Antropometria": "A", "Calc_GastoEnerg": "A", "Calc_PlanAlimentar": "A",
    "BD_Exames": "B", "BD_Percentis": "B", "BD_Substituicoes": "B",
    "BD_Cad_Pedidos": "B", "BD_Diversos": "B", "Alimentos": "C",
    "Relatórios": "C", "Iniciar": "C", "Materiais": "C",
    "BD_Cadastros": "E", "BD_Cad_Dietas": "E", "BD_Entregaveis": "E",
    "BD_Entregaveis2": "E", "BD_Entregaveis3": "E", "Entregáveis": "E",
}

SAULO_EQUIVALENTS = {
    "Harris-Benedict (1919)": "Existe em src/lib/nutrition/protocols.ts.",
    "Mifflin-St Jeor (1990)": "Existe em src/lib/nutrition/protocols.ts e é o padrão atual.",
    "FAO/WHO (1985)": "Existe como FAO/OMS em src/lib/nutrition/protocols.ts.",
    "IMC": "Existe em src/features/clinical-collection/anthropometry-calculations.ts.",
    "GET por fator de atividade": "Existe em src/lib/nutrition/energy.ts.",
    "Déficit/superávit percentual": "Existe na Estratégia Nutricional.",
    "Distribuição de macronutrientes": "Existe em src/lib/nutrition/macros.ts.",
}


def normalize(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(char) != "Mn"
    ).strip()


def column_number(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref)
    if not letters:
        return 0
    number = 0
    for char in letters.group():
        number = number * 26 + ord(char) - 64
    return number


def dimension_size(reference: str | None) -> tuple[int, int]:
    if not reference:
        return 0, 0
    end = reference.split(":")[-1]
    row_match = re.search(r"\d+", end)
    return (int(row_match.group()) if row_match else 0, column_number(end))


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    kind = cell.attrib.get("t")
    value = cell.find(f"{{{MAIN}}}v")
    if kind == "s" and value is not None and value.text is not None:
        return shared_strings[int(value.text)]
    if kind == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{MAIN}}}t"))
    return value.text if value is not None and value.text is not None else ""


def header_candidate(root: ET.Element, shared_strings: list[str]) -> tuple[int | None, list[str]]:
    candidates: list[tuple[int, list[str]]] = []
    rows = root.findall(f".//{{{MAIN}}}sheetData/{{{MAIN}}}row")[:20]
    for row in rows:
        strings: list[str] = []
        for cell in row.findall(f"{{{MAIN}}}c"):
            if cell.attrib.get("t") not in {"s", "inlineStr", "str"}:
                continue
            value = cell_value(cell, shared_strings).strip()
            if value and len(value) <= 120:
                strings.append(value)
        if strings:
            candidates.append((int(row.attrib["r"]), strings))
    if not candidates:
        return None, []
    row_number, headers = max(candidates, key=lambda item: len(item[1]))
    return row_number, headers


def sanitize_formula(formula: str) -> str:
    cleaned = re.sub(r"[A-Za-z]:\\[^\"']+", "[CAMINHO_LOCAL_REMOVIDO]", formula)
    cleaned = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[EMAIL_REMOVIDO]", cleaned)
    return cleaned


def sanitize_header(value: str) -> str:
    cleaned = re.sub(
        r"Saulo\s+Xavier\s+Vitorino",
        "[IDENTIDADE_PROFISSIONAL_REMOVIDA]",
        value,
        flags=re.I,
    )
    cleaned = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[EMAIL_REMOVIDO]", cleaned)
    cleaned = re.sub(r"[A-Za-z]:\\[^|]+", "[CAMINHO_LOCAL_REMOVIDO]", cleaned)
    return cleaned


def write_csv(path: Path, headers: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def raw_rows(root: ET.Element, shared_strings: list[str], max_column: int | None = None):
    result: list[tuple[int, dict[int, str]]] = []
    for row in root.findall(f".//{{{MAIN}}}sheetData/{{{MAIN}}}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{{{MAIN}}}c"):
            column = column_number(cell.attrib["r"])
            if max_column is not None and column > max_column:
                continue
            value = cell_value(cell, shared_strings).strip()
            if value:
                values[column] = value
        result.append((int(row.attrib["r"]), values))
    return result


def method_rows() -> list[dict[str, str]]:
    methods = [
        ("Harris-Benedict revisada (1984)", "H: 88,36 + 13,4×peso + 4,8×altura − 5,68×idade; M: 447,6 + 9,25×peso + 3,1×altura − 4,33×idade", "sexo, peso, altura, idade", "kg; cm; anos; kcal/dia", "adultos conforme seleção da planilha", "Harris-Benedict (1984), identificação parcial no arquivo", "Calc_GastoEnerg", "Não idêntica: SAULO AI usa Harris-Benedict 1919", "Requer protocolo/versionamento explícito"),
        ("Harris-Benedict (1919)", "H: 66,5 + 13,75×peso + 5×altura − 6,76×idade; M: 655 + 9,56×peso + 1,85×altura − 4,68×idade", "sexo, peso, altura, idade", "kg; cm; anos; kcal/dia", "seleção por sexo", "Harris-Benedict (1919)", "Calc_GastoEnerg", SAULO_EQUIVALENTS["Harris-Benedict (1919)"], "Coeficientes têm arredondamento diferente; validar antes de reutilizar"),
        ("Mifflin-St Jeor (1990)", "10×peso + 6,25×altura − 5×idade + 5 (H) ou −161 (M)", "sexo, peso, altura, idade", "kg; cm; anos; kcal/dia", "adultos", "Mifflin-St Jeor (1990)", "Calc_GastoEnerg", SAULO_EQUIVALENTS["Mifflin-St Jeor (1990)"], "Compatível; Evonut usa 9,99/4,92 em células históricas e 10/5 na tela, exigindo revisão"),
        ("FAO/WHO (1985)", "equações lineares por sexo e faixas 0–2, 3–9, 10–17, 18–29, 30–59 e ≥60", "sexo, peso, idade", "kg; anos; kcal/dia", "faixa etária e sexo", "FAO/WHO (1985)", "Calc_GastoEnerg", SAULO_EQUIVALENTS["FAO/WHO (1985)"], "Compatível conceitualmente"),
        ("FAO/WHO (2004)", "equações lineares por sexo e faixa etária, coeficientes próprios da edição 2004", "sexo, peso, idade", "kg; anos; kcal/dia", "faixa etária e sexo", "FAO/WHO (2004)", "Calc_GastoEnerg", "Não existe como protocolo separado", "Adicionar somente após validação bibliográfica"),
        ("Schofield (1985)", "equações por sexo/faixa usando peso e, em algumas faixas, altura; resultado adulto multiplicado por 239", "sexo, peso, altura, idade", "kg; cm; anos; kcal/dia", "faixa etária e sexo", "Schofield (1985)", "Calc_GastoEnerg", "Rótulo existe na biblioteca, não implementado no motor energético", "Requer implementação independente e testes"),
        ("Henry-Rees (1991)", "equações por sexo/faixa baseadas em peso, multiplicadas por 239", "sexo, peso, idade", "kg; anos; kcal/dia", "3 a 59 anos", "Henry-Rees (1991)", "Calc_GastoEnerg", "Não implementado", "Origem completa precisa ser confirmada"),
        ("GET por fator de atividade", "GET = TMB × NAF", "TMB, fator de atividade", "kcal/dia; adimensional", "NAF explicitamente selecionado", "Origem do NAF não indicada", "Calc_GastoEnerg; Gasto Energético", SAULO_EQUIVALENTS["GET por fator de atividade"], "Compatível; não inferir NAF"),
        ("Gasto de atividade por MET", "kcal ≈ MET × peso × duração, com ajustes de unidade/frequência", "MET, peso, duração, frequência, dias", "MET; kg; minutos/horas; kcal", "atividade catalogada", "Compêndio/fonte não identificado no arquivo", "Calc_GastoEnerg; BD_GastoEnerg", "Existe registro de exercício, mas não o mesmo cálculo clínico", "Tabela extensa exige licença e fonte"),
        ("Fator de injúria", "GET clínico ajustado por fator de injúria", "TMB/GET, condição clínica, fator", "kcal/dia; adimensional", "condição clínica selecionada", "Bibliografia não identificada", "Calc_GastoEnerg", "Não implementado", "Alto risco clínico; não importar sem governança"),
        ("IMC", "peso ÷ altura²", "peso, altura", "kg; m; kg/m²", "peso e altura positivos", "Classificação WHO 1995/1997; cálculo padrão", "Calc_Antropometria; Antropometria", SAULO_EQUIVALENTS["IMC"], "Cálculo compatível; classificações exigem faixa etária"),
        ("Percentual de gordura por Siri", "%G = (4,95 ÷ densidade corporal − 4,5) × 100", "densidade corporal", "%", "densidade calculada por protocolo", "Siri (1961)", "Calc_Antropometria", "Não implementado", "Validar protocolo de densidade associado"),
        ("Durnin e Womersley", "densidade por log10 da soma de quatro dobras, coeficientes por sexo/idade", "dobras cutâneas, sexo, idade", "mm; g/cm³; %", "16 a 72 anos", "Durnin e Womersley (1974)", "Calc_Antropometria", "Não implementado", "Requer tabelas e validação de coeficientes"),
        ("Guedes", "densidade corporal por log da soma de três dobras", "dobras, sexo, idade", "mm; g/cm³; %", "18 a 30 anos", "Arquivo rotula Guedes (1885), provável erro bibliográfico", "Calc_Antropometria", "Não implementado", "Ano 1885 é suspeito; bloquear até revisão"),
        ("Jackson, Pollock e Ward 3 dobras", "densidade por soma de três dobras, soma² e idade", "dobras, sexo, idade", "mm; g/cm³; %", "18 a 61 anos", "Jackson, Pollock e Ward (1980)", "Calc_Antropometria", "Não implementado", "Validar seleção de dobras por sexo"),
        ("Jackson, Pollock e Ward 7 dobras", "densidade por soma de sete dobras, soma² e idade", "sete dobras, sexo, idade", "mm; g/cm³; %", "18 a 61 anos", "Jackson, Pollock e Ward (1980)", "Calc_Antropometria", "Não implementado", "Validar seleção de dobras"),
        ("Petroski", "densidade por log10 de quatro dobras e idade", "dobras, sexo, idade", "mm; g/cm³; %", "18 a 66 anos", "Petroski (1995)", "Calc_Antropometria", "Não implementado", "Revisão bibliográfica necessária"),
        ("Faulkner", "%G = 0,153 × soma de quatro dobras + 5,783", "quatro dobras", "%", "acima de 18 anos", "Faulkner (1987), conforme rótulo", "Calc_Antropometria", "Não implementado", "Fonte completa não consta"),
        ("Weltman", "%G por circunferência abdominal e peso", "circunferência, peso, sexo", "cm; kg; %", "20 a 68 anos", "Weltman et al. (1988)", "Calc_Antropometria", "Não implementado", "Revisar equações por sexo"),
        ("Slaughter", "equações pediátricas por soma de dobras, sexo, maturação/faixa", "dobras, sexo, idade", "mm; %", "7 a 18 anos", "Slaughter (1988)", "Calc_Antropometria", "Não implementado", "Exige dados pediátricos e regra de maturação"),
        ("Classificação de gordura Lohman", "classificação por faixas etárias e sexo", "% gordura, sexo, idade", "%", "pediatria", "Lohman (1992)", "Calc_Antropometria; Antropometria", "Não implementado", "Tabela requer validação de edição"),
        ("IMC adulto WHO", "classificação por pontos de corte do IMC", "IMC, idade", "kg/m²", "até 60 anos", "WHO (1995; 1997)", "Calc_Antropometria", "Cálculo existe, classificação não equivalente", "Preservar fonte e versão"),
        ("IMC idoso Lipschitz", "classificação por pontos de corte específicos", "IMC, idade", "kg/m²", "acima de 60 anos", "Lipschitz (1994)", "Calc_Antropometria", "Não implementado", "Revisão clínica antes de uso"),
        ("Percentis OMS", "classificação por tabelas peso/idade, estatura/idade e IMC/idade", "sexo, idade em meses, medida", "meses; kg; cm; escore/percentil", "0 a 19 anos conforme indicador", "OMS (2007) indicada parcialmente", "BD_Percentis; Calc_Antropometria", "Não implementado", "Preferir fonte oficial versionada, não copiar tabela sem licença"),
        ("Ganho de peso gestacional", "faixas por IMC pré-gestacional e semana/trimestre", "IMC pré-gestacional, peso, semana gestacional", "kg/m²; kg; semanas", "a partir da 10ª semana na planilha", "Ministério da Saúde (2022)", "Calc_Antropometria", "Não implementado", "Validar publicação oficial"),
        ("DRIs", "seleção de EAR, RDA/AI e UL por nutriente, sexo, idade e gestação", "nutriente, sexo, idade, gestação", "unidade específica por nutriente", "faixa demográfica", "Edição das DRIs não indicada", "BD_DRIs; Calc_PlanAlimentar", "Não implementado na interface atual", "Não usar sem edição/fonte oficial identificada"),
        ("Déficit/superávit percentual", "meta = GET × (1 + percentual/100)", "GET, percentual", "kcal/dia; %", "ajuste profissional", "Sem origem bibliográfica indicada", "Definição de Metas", SAULO_EQUIVALENTS["Déficit/superávit percentual"], "Compatível"),
        ("Meta por peso", "20 kcal/kg para perda; 30 kcal/kg para ganho", "peso, objetivo", "kg; kcal/kg; kcal/dia", "atalho conforme objetivo", "Origem não indicada", "Definição de Metas", "Não implementado como regra automática", "Não importar como protocolo sem evidência"),
        ("Distribuição de macronutrientes", "gramas = VET × percentual ÷ 4 para proteína/carboidrato; ÷ 9 para lipídios", "VET, percentual ou g/kg, peso", "kcal; %; g; g/kg", "modo selecionado", "Conversões energéticas padrão", "Definição de Metas; Calc_PlanAlimentar", SAULO_EQUIVALENTS["Distribuição de macronutrientes"], "Compatível conceitualmente"),
        ("Nutriente proporcional à porção", "nutriente prescrito = nutriente/100 × gramas prescritas", "nutriente por 100 g, peso total", "g ou mg; g", "alimento e porção válidos", "Regra analítica da base", "Calc_PlanAlimentar", "Existe no Plano Alimentar", "Compatível; não confundir referência com porção"),
    ]
    headers = ["nome", "expressao", "entradas", "unidades", "condicoesUso", "origemBibliografica", "abas", "equivalenteSauloAI", "conflitoArquitetura"]
    return [dict(zip(headers, row)) for row in methods]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source_bytes = SOURCE.read_bytes()
    source_stat = SOURCE.stat()
    sha_before = hashlib.sha256(source_bytes).hexdigest().upper()
    inventory: list[dict[str, object]] = []
    formulas: list[dict[str, object]] = []
    sheet_roots: dict[str, ET.Element] = {}
    shared_strings: list[str] = []

    with zipfile.ZipFile(SOURCE) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {
            relation.attrib["Id"]: relation.attrib["Target"]
            for relation in relationships.findall("r:Relationship", REL_NS)
        }
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.text or "" for node in item.iter(f"{{{MAIN}}}t"))
                for item in root.findall(f"{{{MAIN}}}si")
            ]

        for sheet in workbook.find(f"{{{MAIN}}}sheets"):
            name = sheet.attrib["name"]
            target = targets[sheet.attrib[f"{{{OFFICE_REL}}}id"]].lstrip("/")
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            root = ET.fromstring(archive.read(target))
            sheet_roots[name] = root
            dimension_node = root.find(f"{{{MAIN}}}dimension")
            dimension = dimension_node.attrib.get("ref") if dimension_node is not None else ""
            dimension_rows, dimension_columns = dimension_size(dimension)
            physical_rows = len(root.findall(f".//{{{MAIN}}}sheetData/{{{MAIN}}}row"))
            formula_nodes = root.findall(f".//{{{MAIN}}}f")
            header_row, headers = header_candidate(root, shared_strings)
            sheet_properties = root.find(f"{{{MAIN}}}sheetPr")
            code_name = sheet_properties.attrib.get("codeName", "") if sheet_properties is not None else ""

            table_count = 0
            relation_path = f"{target.rsplit('/', 1)[0]}/_rels/{target.rsplit('/', 1)[1]}.rels"
            if relation_path in archive.namelist():
                sheet_relationships = ET.fromstring(archive.read(relation_path))
                table_count = sum(
                    relation.attrib.get("Type", "").endswith("/table")
                    for relation in sheet_relationships.findall("r:Relationship", REL_NS)
                )

            personal = "SIM" if name in PERSONAL_SHEETS else "POSSÍVEL" if name in POSSIBLE_PERSONAL_SHEETS else "NÃO"
            classification = CLASSIFICATION.get(name, "D" if personal == "SIM" else "C")
            technical = (
                "SIM" if classification in {"A", "B", "E"}
                else "PARCIAL" if classification == "C" else "NÃO IMPORTAR"
            )
            inventory.append({
                "nome": name,
                "estado": sheet.attrib.get("state", "visible"),
                "finalidadeProvavel": PURPOSES.get(name, "Estrutura auxiliar do aplicativo Evonut."),
                "intervaloUsado": dimension,
                "linhasIntervalo": dimension_rows,
                "linhasFisicas": physical_rows,
                "colunasIntervalo": dimension_columns,
                "linhaCabecalhoProvavel": header_row or "",
                "cabecalhos": " | ".join(sanitize_header(header) for header in headers),
                "quantidadeFormulas": len(formula_nodes),
                "possuiFormulas": "SIM" if formula_nodes else "NÃO",
                "quantidadeTabelasExcel": table_count,
                "possuiTabelasExcel": "SIM" if table_count else "NÃO",
                "macroRelacionada": f"POSSÍVEL — codename VBA {code_name}" if code_name else "NÃO IDENTIFICADA",
                "dadosPessoais": personal,
                "conteudoTecnicoReutilizavel": technical,
                "classificacao": classification,
                "riscoLicencaAutoria": "ALTO" if classification == "E" else "MÉDIO — autoria/licença não explícita",
            })

            for cell in root.findall(f".//{{{MAIN}}}c"):
                formula = cell.find(f"{{{MAIN}}}f")
                if formula is None or not (formula.text or "").strip():
                    continue
                expression = sanitize_formula((formula.text or "").strip())
                category = "GERAL"
                normalized_expression = normalize(expression)
                if name in {"Calc_GastoEnerg", "Gasto Energético"}: category = "ENERGIA"
                elif name in {"Calc_Antropometria", "Antropometria", "BD_Percentis"}: category = "ANTROPOMETRIA"
                elif name in {"Calc_PlanAlimentar", "Plano Alimentar", "BD_DRIs", "BD_Cad_Dietas"}: category = "PLANO_NUTRICIONAL"
                elif any(token in normalized_expression for token in ["bd_pacientes", "bd_atendimentos"]): category = "REFERENCIA_DADO_PESSOAL"
                formulas.append({
                    "aba": name,
                    "celula": cell.attrib["r"],
                    "expressao": expression,
                    "categoria": category,
                    "referenciaDadosPessoais": "SIM" if any(token in normalized_expression for token in ["bd_pacientes", "bd_atendimentos", "bd_anamnese"]) else "NÃO",
                    "valorCalculadoExportado": "NÃO",
                    "riscoLicenca": "REVISAR ORIGEM antes de reutilizar",
                })

    cadastro_rows = raw_rows(sheet_roots["BD_Cadastros"], shared_strings, 8)
    cadastros = [values for row, values in cadastro_rows if row >= 4 and values.get(1)]
    diet_rows = raw_rows(sheet_roots["BD_Cad_Dietas"], shared_strings, 13)
    diet_items: dict[str, list[dict[int, str]]] = defaultdict(list)
    for row, values in diet_rows:
        if row >= 4 and values.get(1):
            diet_items[values[1]].append(values)

    plans: list[dict[str, object]] = []
    recipes: list[dict[str, object]] = []
    formulations: list[dict[str, object]] = []
    for item in cadastros:
        code, title, item_type = item.get(1, ""), item.get(2, ""), item.get(3, "")
        linked_items = diet_items.get(code, [])
        meals = list(dict.fromkeys(row.get(5, "") for row in linked_items if row.get(5)))
        if item_type in {"Dieta", "Refeição"}:
            plans.append({
                "codigoEvonut": code,
                "tipo": item_type,
                "nome": title,
                "resumoEnergiaMacros": item.get(4, ""),
                "quantidadeRefeicoes": len(meals),
                "refeicoes": " | ".join(meals),
                "quantidadeItens": len(linked_items),
                "dadosVariaveis": "alimentos, medidas, quantidades, horários, refeições e observações",
                "dadosFixos": "estrutura do modelo e combinação cadastrada",
                "protocoloConfiguravel": "POSSÍVEL, após revisão clínica e de licença",
                "conteudoProprietario": "SIM — nome e composição marcados Evonut",
                "importarAgora": "NÃO",
            })
        elif item_type == "Receita":
            metadata = item.get(5, "")
            preparation = item.get(6, "")
            recipes.append({
                "codigoEvonut": code,
                "nome": title,
                "quantidadeIngredientes": len(linked_items),
                "possuiQuantidades": "SIM" if any(row.get(9) for row in linked_items) else "NÃO",
                "possuiMedidas": "SIM" if any(row.get(8) for row in linked_items) else "NÃO",
                "possuiPesoTotal": "SIM" if any(row.get(13) for row in linked_items) else "NÃO",
                "possuiRendimentoPorcao": "SIM" if re.search(r"rendimento|porç", metadata, re.I) else "NÃO",
                "possuiModoPreparo": "SIM" if preparation else "NÃO",
                "resumoNutricional": item.get(4, ""),
                "codigoAlimentoReceita": item.get(8, ""),
                "vinculoAlimentos": "Código interno Evonut em BD_Cad_Dietas",
                "transformacaoPossivel": "SIM, após mapear ingredientes ao Banco Mestre e validar licença",
                "conteudoProprietario": "SIM — modo de preparo não exportado",
            })
        elif item_type == "Prescrição":
            content = item.get(6, "")
            content_normalized = normalize(content)
            detected: list[str] = []
            for label, tokens in {
                "FITOTERÁPICO": ["extrato", "ginseng", "passiflora", "rhodiola", "ashwag"],
                "PROBIÓTICO": ["lactobac", "bifidobacter"],
                "VITAMINA/MINERAL": ["vitamina", "zinco", "magnes", "cromo", "selenio"],
                "ENZIMA": ["enzima", "lactase"],
                "SUPLEMENTO/ATIVO": ["mg", "mcg", "ufc"],
            }.items():
                if any(token in content_normalized for token in tokens):
                    detected.append(label)
            formulations.append({
                "codigoEvonut": code,
                "nome": title,
                "subtipo": item.get(4, ""),
                "categoria": item.get(5, ""),
                "classesDetectadas": " | ".join(detected) or "NÃO CLASSIFICADO",
                "possuiDose": "SIM" if re.search(r"\b\d+[\s.,]*(mg|mcg|g|ui|ufc)(?:\b|_)", content, re.I) else "NÃO",
                "possuiPosologia": "SIM" if "posologia" in content_normalized or "tomar" in content_normalized else "NÃO",
                "possuiContraindicacao": "SIM" if "contraind" in content_normalized else "NÃO IDENTIFICADA",
                "possuiInteracao": "SIM" if "interaç" in content_normalized or "interac" in content_normalized else "NÃO IDENTIFICADA",
                "tipoConteudo": "PROTOCOLO/FÓRMULA" if item.get(4) in {"Fórmulas", "Fitoterápicos"} else "CAMPO LIVRE",
                "textoIntegralExportado": "NÃO",
                "risco": "ALTO — conteúdo clínico/proprietário; não transformar automaticamente em prescrição",
            })

    substitution_rows = raw_rows(sheet_roots["BD_Substituicoes"], shared_strings, 66)
    substitutions: list[dict[str, object]] = []
    for row, values in substitution_rows:
        if row < 5 or not values.get(27):
            continue
        options = []
        for base in (29, 32, 35, 38):
            if values.get(base):
                options.append({"code": values.get(base, ""), "name": values.get(base + 1, ""), "equivalence": values.get(base + 2, "")})
        substitutions.append({
            "linha": row,
            "id": values.get(27, ""),
            "codigoPlano": values.get(28, ""),
            "alimentoOrigem": "NÃO EXPLICITADO NA TABELA",
            "quantidadeOpcoes": len(options),
            "alimentosDestino": " | ".join(option["name"] for option in options),
            "equivalencias": " | ".join(option["equivalence"] for option in options),
            "possuiPesoMedida": "SIM" if any(re.search(r"\d|gram|fatia|unidade|porç|colher", option["equivalence"], re.I) for option in options) else "NÃO",
            "possuiKcal": "NÃO",
            "possuiMacros": "NÃO",
            "possuiGrupo": "NÃO",
            "logicaIdentificada": "Lista manual de alimentos + equivalência textual de medida/peso; não há cálculo nutricional na aba",
            "importarAgora": "NÃO",
        })

    deliverables = [
        {"origem": "BD_Entregaveis", "tipo": "Plano alimentar e orientações", "estrutura": "cabeçalho profissional, totais de macros, refeições, orientações e anexos", "formulas": 195, "dadosPessoais": "POSSÍVEL", "ideiaReutilizavel": "seções independentes e composição seletiva", "naoCopiar": "layout, identidade, contatos e textos clínicos"},
        {"origem": "BD_Entregaveis2", "tipo": "Avaliação antropométrica", "estrutura": "indicadores, evolução e resultados corporais", "formulas": 22, "dadosPessoais": "POSSÍVEL", "ideiaReutilizavel": "blocos de indicadores com origem e data", "naoCopiar": "layout e identidade visual"},
        {"origem": "BD_Entregaveis3", "tipo": "Anexo auxiliar", "estrutura": "bloco complementar de impressão", "formulas": 2, "dadosPessoais": "POSSÍVEL", "ideiaReutilizavel": "anexos modulares", "naoCopiar": "layout"},
        {"origem": "Entregáveis", "tipo": "Seletor de conteúdo", "estrutura": "dieta, informação nutricional, compras, receitas e orientações", "formulas": 13, "dadosPessoais": "POSSÍVEL", "ideiaReutilizavel": "seleção explícita de seções", "naoCopiar": "interface e identidade"},
        {"origem": "BD_Prescrições/Prescrições", "tipo": "Prescrição", "estrutura": "descrição, tipo, categoria, texto e seleção", "formulas": 6, "dadosPessoais": "SIM", "ideiaReutilizavel": "catálogo separado da prescrição do paciente", "naoCopiar": "textos, doses e prescrições sem revisão"},
        {"origem": "Relatórios", "tipo": "Indicadores", "estrutura": "contagens agregadas", "formulas": 0, "dadosPessoais": "POSSÍVEL", "ideiaReutilizavel": "indicadores agregados sem identificação", "naoCopiar": "layout"},
    ]

    license_risks = [
        {"conteudo": "Arquivo Evonut.xlsm", "risco": "ALTO", "evidencia": "autoria Joilson Aguiar; versão 011; nenhuma licença explícita", "recomendacao": "obter autorização antes de redistribuir ou importar conteúdo proprietário"},
        {"conteudo": "VBA, macros e telas", "risco": "ALTO", "evidencia": "vbaProject.bin e codenames em todas as abas", "recomendacao": "não copiar código, fluxo, identidade visual ou layout"},
        {"conteudo": "Dietas, refeições e receitas Evonut", "risco": "ALTO", "evidencia": "nomes marcados Evonut e composições prontas", "recomendacao": "usar somente a ideia estrutural; exigir licença para conteúdo"},
        {"conteudo": "Orientações clínicas", "risco": "ALTO", "evidencia": "38 textos extensos por condição clínica", "recomendacao": "não copiar; recriar com fontes clínicas aprovadas"},
        {"conteudo": "Formulações, fitoterápicos e probióticos", "risco": "CRÍTICO", "evidencia": "56 prescrições com dose/posologia", "recomendacao": "não importar automaticamente; revisão clínica, regulatória e jurídica"},
        {"conteudo": "Equações nutricionais/antropométricas", "risco": "MÉDIO", "evidencia": "algumas referências/anos incompletos ou suspeitos", "recomendacao": "reimplementar a partir da publicação original, com testes"},
        {"conteudo": "DRIs e percentis", "risco": "MÉDIO/ALTO", "evidencia": "edição e fonte completa não identificadas", "recomendacao": "substituir por fonte oficial versionada"},
        {"conteudo": "Catálogo de exames e referências", "risco": "ALTO", "evidencia": "fonte das faixas de referência não indicada", "recomendacao": "não usar clinicamente sem laboratório/fonte e versionamento"},
        {"conteudo": "Dados pessoais e clínicos", "risco": "CRÍTICO", "evidencia": "cadastros, contatos, antropometria, exames e atendimentos", "recomendacao": "não extrair nem importar nesta auditoria"},
        {"conteudo": "Bases alimentares", "risco": "VARIÁVEL", "evidencia": "TACO, TBCA, IBGE, INSA, Tucunduva e conteúdo próprio", "recomendacao": "preservar fonte e verificar licença de cada origem"},
    ]

    methods = method_rows()
    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "path": str(SOURCE), "sizeBytes": source_stat.st_size,
            "lastModifiedAt": datetime.fromtimestamp(source_stat.st_mtime, timezone.utc).isoformat(),
            "sha256Before": sha_before,
            "sha256After": hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper(),
            "unchanged": source_bytes == SOURCE.read_bytes(),
            "macrosExecuted": False, "protectionChanged": False, "workbookWritten": False,
        },
        "privacy": {"personalOrClinicalRowsExported": 0, "personalValuesIncluded": False, "formulaCachedValuesExported": False},
        "inventory": {
            "sheetCount": len(inventory),
            "visible": sum(row["estado"] == "visible" for row in inventory),
            "veryHidden": sum(row["estado"] == "veryHidden" for row in inventory),
            "formulaCells": len(formulas),
            "excelTableObjects": sum(int(row["quantidadeTabelasExcel"]) for row in inventory),
            "classifications": dict(Counter(str(row["classificacao"]) for row in inventory)),
        },
        "technicalContent": {
            "nutritionMethodsDocumented": len(methods),
            "readyDiets": sum(row["tipo"] == "Dieta" for row in plans),
            "mealTemplates": sum(row["tipo"] == "Refeição" for row in plans),
            "recipes": len(recipes),
            "formulations": len(formulations),
            "formulationSubtypes": dict(Counter(row["subtipo"] for row in formulations)),
            "substitutionRecords": len(substitutions),
            "deliverableStructures": len(deliverables),
        },
        "highestTechnicalValue": ["Calc_GastoEnerg", "Calc_Antropometria", "BD_DRIs", "BD_Percentis", "Calc_PlanAlimentar", "BD_Alimentos", "BD_Medidas"],
        "notImported": True,
        "databaseChanged": False,
        "interfaceChanged": False,
    }

    write_csv(OUTPUT / "inventario-abas.csv", list(inventory[0]), inventory)
    write_csv(OUTPUT / "formulas-encontradas.csv", list(formulas[0]), formulas)
    write_csv(OUTPUT / "metodos-nutricionais.csv", list(methods[0]), methods)
    write_csv(OUTPUT / "planos-prontos.csv", list(plans[0]), plans)
    write_csv(OUTPUT / "receitas-preparacoes.csv", list(recipes[0]), recipes)
    write_csv(OUTPUT / "formulacoes-ativos.csv", list(formulations[0]), formulations)
    write_csv(OUTPUT / "substituicoes.csv", list(substitutions[0]), substitutions)
    write_csv(OUTPUT / "entregaveis.csv", list(deliverables[0]), deliverables)
    write_csv(OUTPUT / "riscos-licenca.csv", list(license_risks[0]), license_risks)
    (OUTPUT / "resumo-geral.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    recommendation = f"""# Recomendação de importação — Evonut

## Estado desta auditoria

- Arquivo original preservado: `{sha_before}`.
- Nenhuma macro executada; proteção não alterada.
- Nenhum registro pessoal ou clínico exportado.
- Nenhuma importação ou alteração de banco/interface realizada.

## Fase 1 — fontes oficiais e estruturas já validadas

Manter a auditoria anterior de `BD_Alimentos` e `BD_Medidas`. Importar somente fontes com licença e identidade verificadas, preservando origem e código interno Evonut separadamente do código oficial.

## Fase 2 — métodos já equivalentes

Confrontar Mifflin-St Jeor, Harris-Benedict 1919, FAO/WHO 1985, IMC, GET e macronutrientes com os serviços existentes. Não copiar fórmulas; validar coeficientes na publicação original e acrescentar testes de regressão.

## Fase 3 — novas referências técnicas

Avaliar DRIs, percentis, antropometria avançada, METs e fatores clínicos. Exigir fonte/versionamento antes de modelar. Equações com referência incompleta ou suspeita, como “Guedes (1885)”, permanecem bloqueadas.

## Fase 4 — conteúdo configurável com revisão jurídica

Dietas ({summary['technicalContent']['readyDiets']}), refeições ({summary['technicalContent']['mealTemplates']}) e receitas ({summary['technicalContent']['recipes']}) podem inspirar modelos estruturais, mas o conteúdo Evonut não deve ser copiado sem licença. Recriar protocolos com autoria, evidência e aprovação clínica próprias.

## Fase 5 — conteúdo de alto risco

Formulações, fitoterápicos, probióticos, orientações clínicas, faixas de exames e prescrições exigem revisão clínica, regulatória e jurídica. Não devem alimentar geração automática nem prescrição sem governança específica.

## Conteúdo que não deve ser importado

- pacientes, contatos, documentos, atendimentos, agenda, anamnese, antropometria, exames e planos individuais;
- VBA, macros, fórmulas do aplicativo, imagens, telas, identidade visual e textos comerciais;
- caminhos locais, dados profissionais incorporados aos modelos e textos clínicos proprietários;
- qualquer conteúdo cuja licença, autoria ou referência bibliográfica permaneça não identificada.
"""
    (OUTPUT / "recomendacao-importacao.md").write_text(recommendation, encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
