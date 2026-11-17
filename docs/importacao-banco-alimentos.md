# Importação local do banco de alimentos

O Banco Mestre consulta exclusivamente as tabelas locais do PostgreSQL. O
comando padrão lê diretamente o arquivo oficial preservado em
`data/imports/food/raw/Taco-4a-Edicao.xlsx`, sem realizar download ou consulta
externa:

```powershell
npm run db:import-foods
```

Também permanece disponível a importação do formato JSON canônico:

```powershell
npm run db:import-foods -- C:\caminho\fonte-oficial.json
```

O arquivo deve conter um pacote ou uma lista de pacotes com esta estrutura:

```text
{
  source: {
    kind: TACO | TBCA | IBGE | PHILIPS | USDA | CLINIC_SV,
    name: texto,
    version?: texto,
    reference?: texto,
    origin: OFFICIAL | PROFESSIONAL
  },
  foods: [{
    sourceCode?: texto,
    officialName: texto,
    description?: texto,
    category: texto,
    foodGroup: texto,
    preparationState?: texto,
    presentation?: texto,
    referenceServingGrams?: número positivo,
    referenceServingUnit?: texto,
    nutrients: {
      energyKcal?: número não negativo | null,
      proteinGrams?: número não negativo | null,
      carbohydratesGrams?: número não negativo | null,
      fatsGrams?: número não negativo | null,
      fiberGrams?: número não negativo | null,
      ...demais nutrientes declarados em FoodNutrients
    },
    householdMeasures?: [{
      name: texto,
      variation?: texto,
      quantity: número positivo,
      grams: número positivo,
      isDefault?: booleano
    }],
    synonyms?: [texto]
  }]
}
```

Regras da carga:

- os valores devem vir da publicação ou exportação oficial da fonte;
- a origem `DEMONSTRATIVE` não é aceita;
- nenhum nutriente, porção ou medida ausente é estimado;
- o mesmo código não pode se repetir dentro da mesma fonte;
- nova execução atualiza o alimento já identificado pela fonte e código;
- quando a fonte não possuir código, a identificação usa nome normalizado e
  estado de preparação dentro da própria fonte;
- a carga inteira é transacional: uma falha impede a gravação parcial.

Na TACO, os valores são lidos como exibidos na planilha oficial e a referência é
`100 g`. Marcadores `Tr`, `NA` e células vazias permanecem ausentes (`null`). A
célula de piridoxina do código 373 contém o texto inválido `,0,02`; o importador
registra um aviso e mantém somente esse nutriente ausente, sem corrigir ou estimar
o valor. Os PDFs da mesma pasta não são processados nesta etapa.
