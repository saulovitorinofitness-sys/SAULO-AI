# Importação futura do catálogo de exercícios

## Decisão arquitetural

A fonte preparada para o catálogo científico amplo é `ScientificLibraryRecord`,
com `area = PERFORMANCE` e `domain = EXERCISE`. O cadastro-base descreve o
exercício reutilizável. Séries, repetições, carga, intervalo, RPE, RIR,
velocidade, duração e demais parâmetros individuais pertencem à prescrição e
não são aceitos como atributos do catálogo.

Os campos comuns ficam em colunas próprias: nome normalizado, área, domínio,
descrição, tags, fonte, observações profissionais, status, origem do cadastro,
arquivo importado, responsáveis e datas. Os atributos específicos ficam em
`metadata.attributes`, preservando strings e listas estruturadas.

O módulo Performance consome o catálogo por um adaptador único. Registros
`ScientificLibraryRecord` são expostos somente quando pertencem à área
`PERFORMANCE`, ao domínio `EXERCISE` e possuem status `ACTIVE` ou `INACTIVE`;
somente `ACTIVE` pode entrar em uma nova prescrição. Nome, modalidade, região,
equipamento, padrão, classificação e tags participam da busca.

O schema ainda contém `ExerciseLibraryItem` para preservar referências e dados
históricos. Novos registros não são criados nessa tabela. O adaptador apresenta
esses itens como `LEGACY_EXERCISE_LIBRARY`, enquanto novos exercícios usam
`SCIENTIFIC_LIBRARY`. A prescrição guarda o ID e a origem do exercício-base;
payloads antigos, que possuem apenas `libraryExerciseId`, continuam válidos.

O cadastro mestre continua sendo editado exclusivamente na Biblioteca
Científica. Performance somente consulta e referencia o exercício, acrescentando
os parâmetros individuais dentro do plano versionado do paciente.

## Capacidade atual

- Arquivo com até 10 MB.
- Até 1.000 registros por confirmação na API.
- Preview local sem persistência.
- Confirmação transacional dos registros válidos.
- Índice por profissional, área, domínio e status.
- Unicidade por profissional + área + domínio + nome normalizado.

Centenas de exercícios cabem na estrutura atual sem remodelagem. Antes de
volumes muito maiores ou filtros server-side por músculos/equipamentos, será
necessário avaliar paginação e índices específicos; os atributos internos do
JSON não são indexados atualmente.

## Formatos aceitos

- JSON: lista de objetos ou objeto com propriedade `items`.
- CSV: primeira linha como cabeçalho; listas separadas por `|` ou `;`.
- XLSX: primeira planilha do arquivo.

JSON é o formato recomendado para o catálogo amplo porque mantém músculos,
classificações, equipamentos, erros e demais campos multivalorados como arrays,
sem ambiguidade de separadores. O template oficial está em
`docs/templates/catalogo-exercicios.template.json`.

## Campos obrigatórios

- `Nome`.
- `Fonte/origem` — deve identificar uma fonte autorizada e auditável. Informar a
  origem não substitui a verificação humana de licença e termos de uso.
- Status inicial — selecionado uma vez na tela de importação para todo o lote.

## Campos opcionais

- Descrição.
- Modalidade.
- Padrão de movimento.
- Classificações.
- Nível de dificuldade.
- Grupos musculares/regiões.
- Músculos primários.
- Músculos secundários/sinergistas.
- Objetivos/aplicações.
- Equipamentos e equipamento complementar.
- Posição inicial e execução técnica.
- Erros comuns.
- Cuidados/restrições profissionais.
- Regressões, progressões e alternativas/substituições.
- Tags.
- Observações profissionais.
- Código externo, sistema de classificação e versão da fonte.
- URL HTTP/HTTPS de vídeo demonstrativo e URL HTTP/HTTPS de imagem.

Campos opcionais vazios são preservados como ausência de informação; o sistema
não completa nem inventa conteúdo científico.

## Validações

- Área e domínio precisam formar uma combinação autorizada.
- Nome entre 2 e 200 caracteres.
- Fonte/origem obrigatória para exercício importado.
- Tags limitadas a 30, com até 80 caracteres cada.
- Modalidade, padrão, classificação, dificuldade, região, objetivo e
  equipamento precisam pertencer às taxonomias aprovadas na Biblioteca.
- URLs, quando informadas, precisam usar HTTP ou HTTPS.
- Campos desconhecidos aparecem no preview e não são persistidos.
- Linhas inválidas e duplicadas não entram na confirmação.

## Prevenção de duplicidades

O preview compara o nome normalizado com os itens já visíveis e com as linhas
anteriores do mesmo arquivo. A normalização remove acentos, espaços excedentes e
diferenças entre maiúsculas e minúsculas. A API repete a verificação, o
repositório verifica cada item dentro da transação e o banco mantém uma restrição
única como última proteção.

A regra atual identifica duplicidade pelo nome dentro da área e domínio. Códigos
externos ainda não participam da chave; uma fonte futura com identificadores
estáveis deve ser auditada antes de qualquer alteração dessa estratégia.

## Procedimento seguro para uma importação futura

1. Confirmar licença, termos de uso e rastreabilidade da fonte.
2. Converter a fonte para o template sem criar parâmetros de prescrição.
3. Importar primeiro um lote pequeno em status `DRAFT`.
4. Revisar mapeamento, campos desconhecidos, inválidos e duplicados no preview.
5. Confirmar somente após validação profissional.
6. Auditar contagem, amostras e origem após a persistência.
7. Repetir em lotes controlados; não misturar fontes sem rastreabilidade.
