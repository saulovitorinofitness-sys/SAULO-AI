# Biblioteca Científica do SAULO AI

## Finalidade e princípios

A Biblioteca Científica é a fonte interna rastreável de conhecimento técnico usada para apoiar o trabalho dos profissionais autorizados no SAULO AI. Seu conteúdo deve ser cadastrado uma única vez e reutilizado por referência pelos módulos consumidores, sem duplicar dados de pacientes, cadastros do Banco Mestre ou o `MasterRecord`.

A Biblioteca:

- apoia, mas não substitui, o julgamento clínico ou profissional;
- não diagnostica, prescreve, interpreta exames nem determina condutas automaticamente;
- não considera um conteúdo cientificamente válido apenas porque ele está `ACTIVE` em estruturas legadas ou operacionais;
- exige distinção explícita entre conteúdo científico, base oficial, protocolo profissional, conteúdo operacional, demonstrativo e legado;
- preserva a origem, a versão e as dependências de cada registro;
- não permite que rótulos de interface, nomes de fontes ou estados técnicos sejam usados como prova de validação científica.

Conteúdo aprovado continua sujeito à análise de aplicabilidade ao caso concreto, às competências profissionais, às limitações da fonte e à atualização da evidência.

## Rota e acesso atuais

- Rota: `/administracao/biblioteca-cientifica`.
- Menu: Administração > Biblioteca Científica.
- Acesso atual: exclusivo de Saulo Xavier Vitorino.
- Maria de Lourdes Gomes não recebe o item no menu e encontra acesso negado ao tentar abrir a rota diretamente.

Essas regras de acesso não substituem a autorização específica exigida nos módulos consumidores.

## Áreas profissionais

Todo conteúdo deve pertencer explicitamente a uma das seguintes áreas:

1. **Nutrição**;
2. **Exercício e Performance**;
3. **Avaliação Postural**.

Área, domínio, tipo e natureza do dado são classificações diferentes. Modalidade, população, contexto e objetivo não devem criar bibliotecas paralelas nem ser inferidos apenas pelo nome do conteúdo.

## Tipos de conteúdo por área

### Nutrição

A área de Nutrição pode organizar:

- alimentos e composição nutricional;
- equações e cálculos;
- exames relevantes à prática nutricional;
- patologias e condições nutricionais;
- suplementos;
- protocolos e estratégias nutricionais;
- fatores de atividade;
- receitas.

Exames e condições são referências informativas e não autorizam interpretação, diagnóstico ou conduta automática. Equações não podem ser executadas sem versão, unidades, população e limitações documentadas. Uma receita prática, ainda que útil profissionalmente, não possui automaticamente nível de evidência científica e não deve ser apresentada como estudo, diretriz ou recomendação validada.

### Exercício e Performance

A área de Exercício e Performance pode organizar:

- exercícios;
- métodos de treinamento;
- avaliação física;
- musculação;
- corrida;
- ciclismo;
- mobilidade e flexibilidade;
- periodização;
- monitoramento de carga;
- recuperação;
- contraindicações, precauções e adaptações.

Séries, cargas, progressões e decisões individuais pertencem ao plano de treino elaborado pelo profissional. O cadastro reutilizável não deve produzir prescrição automática nem transformar uma referência geral em conduta individual.

### Avaliação Postural

A área de Avaliação Postural pode organizar:

- protocolos;
- referências anatômicas;
- testes e avaliações;
- achados posturais;
- condições associadas previamente informadas ou documentadas;
- limitações do método;
- condutas profissionais e critérios de encaminhamento.

Um achado postural é observacional e não deve ser transformado em diagnóstico médico. Condições associadas devem permanecer separadas dos achados e somente podem ser registradas quando possuírem origem documental identificada. A Biblioteca não deve inferir causalidade, patologia ou tratamento a partir de postura, imagem ou teste isolado.

## Classificação da natureza do dado

Todo registro deve possuir exatamente uma natureza principal:

### `SCIENTIFIC`

Conteúdo sustentado por publicação científica identificável, com referência completa, autoria ou instituição, ano, tipo de publicação e classificação de evidência registrados. A classificação informa a natureza da fonte e não garante, isoladamente, qualidade, aplicabilidade ou força de recomendação.

### `OFFICIAL_DATABASE`

Registro proveniente de base mantida por órgão, instituição ou projeto oficialmente identificado, com nome, versão, referência e data de acesso quando aplicável. A condição de base oficial não transforma cada registro em artigo científico nem elimina a necessidade de avaliar escopo, método e limitações.

### `PROFESSIONAL_PROTOCOL`

Protocolo técnico emitido ou formalmente adotado por instituição ou profissional responsável, com versão, vigência, público, aplicação, limitações e responsabilidade definidos. Deve ser apresentado como protocolo profissional, e não como evidência científica primária.

### `OPERATIONAL`

Conteúdo usado para fluxo, organização, cadastro, atendimento ou execução interna. Pode ser necessário ao sistema, mas não deve receber linguagem que sugira validação científica.

### `DEMONSTRATIVE`

Conteúdo fictício, mockado, incompleto ou criado para demonstração, desenvolvimento e testes. Deve permanecer visualmente identificado e isolado em adaptadores. Não pode aparecer como conteúdo científico aprovado, fonte oficial integrada ou revisão profissional comprovada.

### `LEGACY`

Conteúdo herdado de implementação, planilha, catálogo ou contrato anterior cuja origem, estrutura ou validação ainda não foi consolidada. Deve permanecer rastreável por compatibilidade, mas não pode aparecer como conteúdo científico aprovado até passar pelo fluxo editorial completo.

Registros `DEMONSTRATIVE` e `LEGACY` são inelegíveis para `APPROVED` enquanto mantiverem essa natureza. Alterar a natureza exige análise explícita, comprovação da fonte e criação de uma nova versão auditável; a troca de rótulo, por si só, é proibida.

## Campos obrigatórios de conteúdo científico

Um conteúdo candidato a `SCIENTIFIC` deve possuir, de forma estruturada:

1. título;
2. área profissional;
3. domínio;
4. tipo de conteúdo;
5. resumo;
6. conteúdo técnico;
7. aplicação profissional;
8. população à qual a evidência se aplica;
9. indicações;
10. contraindicações e precauções;
11. origem;
12. referência bibliográfica completa;
13. autores ou instituição responsável;
14. ano;
15. DOI, PMID, ISBN ou URL oficial, quando aplicável;
16. tipo de publicação;
17. nível de evidência;
18. data da evidência ou da publicação;
19. data da revisão interna;
20. responsável pela revisão;
21. status editorial;
22. versão do conteúdo;
23. histórico de alterações.

Campos não aplicáveis devem ser marcados como tal com justificativa auditável. Campo vazio, texto genérico como “fonte oficial” ou tag de “revisado” não atende ao requisito.

## Exceções documentadas

- Bases oficiais de composição alimentar podem usar código oficial do item, nome e versão da base no lugar de DOI. A instituição mantenedora, a referência da base e a data de acesso continuam obrigatórias quando aplicáveis.
- Equações devem registrar a publicação original, a população de desenvolvimento ou validação, as variáveis de entrada, as unidades, a versão e as limitações de uso.
- Protocolos profissionais devem registrar a instituição ou profissional emissor, a versão, a vigência, o público, o escopo e as limitações.
- Exercícios devem possuir referência técnica adequada ou classificação explícita como cadastro profissional. Não se deve fingir que cada exercício isolado corresponde a um artigo científico.
- Receitas práticas podem ser cadastradas como conteúdo profissional ou operacional, mas somente recebem classificação científica quando houver uma referência que sustente especificamente a afirmação apresentada.

Toda exceção deve explicar por que determinado identificador não se aplica; ela não autoriza inventar, inferir ou omitir silenciosamente a origem.

## Hierarquia de evidência

A Biblioteca usa as seguintes categorias descritivas:

- diretriz ou consenso oficial;
- revisão sistemática ou meta-análise;
- ensaio clínico;
- estudo observacional;
- estudo diagnóstico;
- estudo biomecânico;
- livro ou manual técnico;
- base oficial;
- opinião ou experiência profissional;
- sem classificação.

A categoria registra o desenho ou a natureza da fonte. Ela não atribui automaticamente qualidade metodológica. Nível de evidência e força da recomendação são conceitos diferentes e devem ser registrados separadamente quando a fonte os fornecer. A Biblioteca não deve calcular ou inferir força de recomendação sem método aprovado e dados suficientes.

## Fluxo editorial

Os estados editoriais oficiais são:

### `DRAFT`

Conteúdo em elaboração, ainda não submetido à revisão. Não pode ser apresentado como validado.

### `UNDER_REVIEW`

Conteúdo submetido à verificação de fonte, completude, coerência, aplicabilidade e riscos. Deve identificar quem conduz a revisão e quando ela começou.

### `APPROVED`

Versão aprovada após atendimento dos critérios mínimos. Exige responsável e data de aprovação. A versão aprovada torna-se imutável; correções posteriores exigem nova versão.

### `SUPERSEDED`

Versão aprovada substituída por outra mais recente. Permanece disponível para auditoria e para resolver referências históricas.

### `ARCHIVED`

Conteúdo retirado do uso corrente, mas preservado para rastreabilidade. Arquivamento não apaga referências existentes.

### `REJECTED`

Conteúdo recusado durante a revisão, com motivo obrigatório. Não pode ser usado como aprovado.

### Transições permitidas

- `DRAFT` → `UNDER_REVIEW`, `REJECTED` ou `ARCHIVED`;
- `UNDER_REVIEW` → `DRAFT`, `APPROVED` ou `REJECTED`;
- `APPROVED` → `SUPERSEDED` ou `ARCHIVED`;
- `SUPERSEDED` → `ARCHIVED`;
- `REJECTED` → `DRAFT` ou `ARCHIVED`;
- `ARCHIVED` é somente leitura; eventual retomada deve gerar nova versão em `DRAFT`.

Cada transição deve registrar autor, data, estado anterior, estado novo e justificativa quando aplicável. `ACTIVE` é um estado técnico legado e não significa automaticamente revisado ou `APPROVED`.

## Política de fontes

1. Nenhuma referência, autor, instituição, DOI, PMID, ISBN, ano ou nível de evidência pode ser inferido ou inventado.
2. URLs devem apontar para uma fonte identificável e compatível com a referência informada; páginas genéricas ou resultados de busca não bastam.
3. Conteúdo sem comprovação permanece `DEMONSTRATIVE`, `LEGACY` ou `DRAFT`, conforme sua natureza e origem.
4. Versão, edição, vigência e data de acesso devem ser registradas quando necessárias para reproduzir a consulta.
5. A fonte primária deve permanecer separada de resumos, interpretações e notas internas.
6. Uma referência secundária não deve ser apresentada como publicação original.
7. Nome conhecido de instituição, tabela ou periódico não prova que o registro foi extraído corretamente nem que está integrado ao sistema.
8. Arquivos e links devem respeitar licença, direito de uso, confidencialidade e condições de redistribuição.

## Política para os 259 itens atuais

O número 259 representa a composição atual da interface e não o total de conteúdos científicos validados.

Até a consolidação individual:

- os IDs consumidos por planos, prescrições e demais contratos devem ser preservados temporariamente;
- registros mockados, demonstrativos, persistidos e provenientes do Banco Mestre devem ser identificados separadamente;
- nenhum item deve ser promovido a `SCIENTIFIC` ou `APPROVED` por lote, por nome, por tag, pelo estado `ACTIVE` ou pelo texto “revisão profissional”;
- nenhum item deve ser excluído ou migrado antes do mapeamento de todas as dependências;
- deve ser criado futuramente um processo de revisão item a item, com fonte e decisão editorial registradas;
- novas funcionalidades não devem criar dependências de IDs mockados;
- o Banco Mestre de Alimentos deve continuar sendo referenciado, não copiado para um segundo catálogo;
- itens sem comprovação devem permanecer demonstrativos, legados ou pendentes.

## Fontes prioritárias futuras

As categorias abaixo orientam pesquisa e verificação futuras, mas não representam fontes já integradas:

- tabelas oficiais de composição alimentar;
- órgãos públicos;
- conselhos profissionais;
- sociedades científicas;
- diretrizes e consensos;
- periódicos indexados;
- PubMed/MEDLINE;
- Cochrane;
- livros técnicos reconhecidos.

Cada fonte deverá ser verificada quanto a identidade, versão, escopo, licença, atualidade e aplicabilidade antes de qualquer importação ou declaração de integração.

## Critérios mínimos de aprovação

Antes de permitir `APPROVED`, o sistema deverá validar objetivamente:

- [ ] natureza elegível e diferente de `DEMONSTRATIVE` e `LEGACY`;
- [ ] título, área, domínio e tipo preenchidos;
- [ ] resumo e conteúdo técnico preenchidos;
- [ ] aplicação profissional e população explicitadas;
- [ ] indicações, contraindicações e precauções registradas ou justificadas como não aplicáveis;
- [ ] origem identificável;
- [ ] referência bibliográfica completa ou exceção aplicável documentada;
- [ ] autores ou instituição responsável identificados;
- [ ] ano e data da evidência registrados;
- [ ] DOI, PMID, ISBN, URL oficial ou identificador substitutivo válido, quando aplicável;
- [ ] tipo de publicação e categoria de evidência selecionados sem inferência automática;
- [ ] fonte primária separada do resumo interno;
- [ ] versão definida e sem conflito com versão anterior;
- [ ] responsável e data da revisão interna registrados;
- [ ] histórico de alterações iniciado;
- [ ] dependências conhecidas avaliadas;
- [ ] licença e direito de uso verificados quando necessários;
- [ ] revisão sem pendências impeditivas;
- [ ] transição realizada a partir de `UNDER_REVIEW`.

A aprovação deve falhar de forma explícita quando qualquer requisito obrigatório estiver ausente. A interface não deve preencher dados científicos automaticamente para contornar a validação.

## Critérios de apresentação na interface

A futura interface deverá distinguir visual e textualmente, sem depender apenas de cor:

- aprovado;
- em revisão;
- demonstrativo;
- legado;
- arquivado;
- fonte oficial;
- protocolo profissional.

Também deverá:

- mostrar natureza e status editorial separadamente;
- apresentar origem, referência, versão e revisão antes de sugerir reutilização;
- sinalizar campos ausentes e exceções documentadas;
- impedir que conteúdo demonstrativo ou legado use selo de aprovação científica;
- manter filtros por área, domínio, natureza, status, fonte e responsável;
- preservar acessibilidade, responsividade e navegação por teclado;
- manter detalhes e listas utilizáveis em telas pequenas, sem exigir rolagem excessiva para localizar o item selecionado.

## Segurança, versionamento e auditoria

- Conteúdo `APPROVED` deve possuir versão imutável.
- Toda aprovação deve identificar revisor e data.
- Criações, revisões, rejeições, substituições e arquivamentos devem integrar o histórico auditável.
- Conteúdo substituído ou arquivado não deve desaparecer nem perder sua referência original.
- Planos, prescrições, avaliações e entregáveis devem continuar apontando para a versão utilizada.
- Alterações de título, fonte ou conteúdo técnico de versão aprovada exigem nova versão, sem sobrescrever o registro anterior.
- Exclusão física só pode ser considerada quando não houver dependências e existir política específica de retenção; por padrão, deve-se arquivar.
- Logs e históricos não devem duplicar dados de pacientes nem material clínico fora do `MasterRecord` correspondente.

## Relação com a Central de Dados e módulos consumidores

Cadastros já existentes devem ser reutilizados por referência. A Central de Dados continua responsável pela infraestrutura compartilhada empresarial e operacional, e o Banco Mestre continua responsável por seus registros oficiais de alimentos e fontes. A Biblioteca organiza conhecimento técnico e sua proveniência, sem copiar essas entidades para catálogos locais.

Módulos consumidores devem:

1. armazenar o identificador e a versão do item utilizado;
2. respeitar permissões próprias e da área profissional;
3. não interpretar automaticamente exames, patologias, achados ou fatores;
4. não executar equações sem mecanismo aprovado;
5. não criar bibliotecas paralelas em Plano Alimentar, Plano de Treino, Avaliações ou Performance;
6. continuar rastreando versões substituídas ou arquivadas;
7. rejeitar novas dependências de registros explicitamente mockados.

## Estado atual e limites

A implementação atual reúne cadastros compartilhados demonstrativos, conteúdo complementar codificado localmente e a possibilidade de registros profissionais persistidos. Esse estado técnico não comprova validação científica.

No estágio atual:

- os mocks devem permanecer identificados e isolados em adaptadores;
- não há autorização para promover os 259 itens em lote;
- não há IA autorizada para criar referências, classificar evidência ou aprovar conteúdo;
- não há diagnóstico, interpretação clínica ou prescrição automática autorizados pela Biblioteca;
- fontes e descrições demonstrativas exigem revisão item a item antes de qualquer aprovação;
- favoritos e demais preferências locais não constituem decisão editorial;
- qualquer implementação futura depende de Sprint específica e aprovação prévia dos campos e regras correspondentes.
