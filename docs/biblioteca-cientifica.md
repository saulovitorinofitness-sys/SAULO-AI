# Biblioteca Científica Inteligente

## Objetivo

A Biblioteca Científica é a fonte oficial de conhecimento estruturado do SAULO AI. Cada informação deve ser cadastrada uma única vez e reutilizada por referência nos módulos autorizados. Esta versão é demonstrativa, não usa IA, banco real, cálculo, interpretação ou prescrição automática.

## Rota e acesso

- Rota: `/administracao/biblioteca-cientifica`.
- Menu: Administração > Biblioteca Científica.
- Acesso exclusivo: Saulo Xavier Vitorino.
- Maria de Lourdes Gomes não recebe o item no menu e encontra acesso negado ao tentar abrir a rota diretamente.

## Fonte única e relação com a Central de Dados

Os cadastros de Alimentos, Exercícios, Exames, Suplementos e Protocolos já existentes em `src/features/shared-data` não foram copiados. O serviço da Biblioteca os adapta por referência (`sourceSharedDataId`) e preserva origem, auditoria, tags e módulos consumidores.

A Biblioteca acrescenta somente catálogos científicos ainda inexistentes. A Central de Dados continua responsável pela infraestrutura compartilhada empresarial e operacional; a Biblioteca Científica passa a ser a visualização oficial para conhecimento científico. Módulos futuros devem consumir seus contratos/serviço, nunca criar catálogos locais.

## Domínios

1. Alimentos, com grupo, origem da base, medida caseira e observações.
2. Receitas compartilhadas para consumo referenciado pelo Plano Alimentar.
3. Bases de dados: TACO, TBCA, IBGE, USDA e outras.
4. Equações: Harris-Benedict, Mifflin, Owen, Schofield e Henry, sem execução.
5. Fatores de atividade, sem valores aplicados.
6. Fatores de injúria, sem aplicação clínica.
7. Patologias, sem diagnóstico ou protocolo automático.
8. Suplementos, sem dose ou recomendação.
9. Exames, sem interpretação.
10. Exercícios, com execução, variações e contraindicações registradas.
11. Métodos de treinamento de musculação e endurance, sem prescrição.
12. Avaliações, sem cálculo ou classificação.
13. Alterações posturais, sem análise automática.
14. Protocolos clínicos, físicos e posturais já compartilhados.

## Pesquisa e favoritos

A pesquisa local considera nome, categoria, descrição, origem, tags e atributos em todos os domínios. O filtro por domínio e o filtro de favoritos podem ser combinados. Favoritos existem somente no estado React e são perdidos ao recarregar.

## Estrutura técnica

- Contratos: `src/features/scientific-library/contracts.ts`.
- Labels: `src/features/scientific-library/labels.ts`.
- Mocks complementares: `src/features/scientific-library/mock-data.ts`.
- Serviço e adaptador da fonte compartilhada: `src/features/scientific-library/service.ts`.
- Interface: `src/components/scientific-library`.

## Componentes

- `ScientificLibraryHeader`.
- `ScientificDomainNavigation`.
- `ScientificLibraryList`.
- `ScientificLibraryDetails`.
- `ScientificLibraryWorkspace`.

Todos reutilizam o Design System existente.

## Regras para módulos futuros

1. Consultar a Biblioteca Científica por identificador.
2. Armazenar referência ao item, não uma cópia de seu conteúdo.
3. Respeitar permissões do módulo consumidor.
4. Não interpretar automaticamente exames, patologias ou fatores.
5. Não executar equações sem mecanismo clínico validado em sprint futura.
6. Não criar bibliotecas próprias dentro de Plano Alimentar, Plano de Treino, Avaliações ou Performance.

## Responsividade e acessibilidade

Os filtros usam botões semânticos com `aria-pressed`; a busca possui label; favoritos possuem nome acessível; status incluem texto. A listagem usa cards adaptativos e passa para uma coluna no celular, sem tabela ou rolagem horizontal obrigatória.

## Limitações do MVP

- Dados exclusivamente mockados.
- Sem persistência real.
- Sem criação ou edição nesta Sprint.
- Sem IA ou pesquisa externa.
- Sem cálculos, interpretação clínica ou recomendação.
- Fontes e descrições são demonstrativas e exigem validação científica antes de uso real.
