# Central de Dados Compartilhados

> A Biblioteca Científica (`/administracao/biblioteca-cientifica`) reutiliza por referência os cadastros científicos desta Central. Novos módulos não devem copiar alimentos, exercícios, exames, suplementos ou protocolos para catálogos locais.

## 1. Objetivo

Oferecer uma fonte única, tipada e reutilizável para cadastros usados por diferentes módulos do SAULO AI. Nesta Sprint a fonte é mockada e as alterações existem somente no estado local da interface.

## 2. Problema resolvido

Evita que alimentos, exercícios, exames, suplementos, protocolos e documentos sejam redefinidos em cada módulo. O item compartilhado mantém identidade, categoria, tags, autoria, estado e destinos de reutilização.

## 3. Domínios suportados

`FOOD`, `EXERCISE`, `LABORATORY_EXAM`, `SUPPLEMENT`, `RECIPE`, `CLINICAL_PROTOCOL`, `PHYSICAL_ASSESSMENT_PROTOCOL`, `POSTURAL_ASSESSMENT_PROTOCOL`, `DOCUMENT_TEMPLATE`, `MARKETING_CAMPAIGN`, `OPERATIONAL_PROCEDURE` e `CATEGORY_TAG`.

## 4. Estrutura de tipos

Os contratos ficam em `src/features/shared-data/contracts.ts`. `SharedDataItemBase` contém os metadados comuns. `SharedDataItem` é uma união discriminada com atributos específicos para alimento, exercício, exame, suplemento e protocolo; outros domínios usam atributos genéricos tipados, sem `any`.

`SharedDataGateway` define leitura do workspace, criação, atualização, arquivamento e restauração. Esses métodos são o ponto de substituição por endpoints futuros.

## 5. Categorias

As categorias ficam no catálogo central e são associadas a um domínio. O MVP permite criar, renomear, arquivar e restaurar categorias localmente, sem hierarquia.

## 6. Tags

Tags possuem identificador, nome e tom visual. Podem ser aplicadas a múltiplos domínios. O gerenciador permite criar tags locais; `TagSelector` aplica várias tags aos itens.

## 7. Permissões

Saulo Xavier Vitorino recebe todos os domínios e ações. Maria de Lourdes Gomes recebe exercícios, protocolos físicos, funcionais e posturais e documentos autorizados. Alimentos, receitas, suplementos nutricionais, protocolos clínicos restritos, campanhas e procedimentos administrativos não são serializados nem renderizados para Maria.

A filtragem mockada deriva o usuário pelo cenário existente e não cria novos grants. Um back-end futuro deve repetir a autorização; ocultação visual não é segurança suficiente.

## 8. Serviços mockados

`src/features/shared-data/service.ts` implementa `SharedDataGateway`. `getWorkspace` filtra antes de devolver os itens. `create`, `update`, `archive` e `restore` retornam clones sem persistência. O estado interativo fica no cliente e é perdido ao recarregar.

## 9. Componentes

- `SharedDataWorkspace`
- `SharedDataHeader`
- `SharedDataFilters`
- `SharedDataList`
- `SharedDataDetails`
- `SharedDataForm`
- `SharedDataStatusBadge`
- `CategoryManager`
- `TagManager`
- `TagSelector`

São reutilizados `PageHeading`, `Button`, `Card`, `Badge`, `StatusBadge`, `Input`, `Select`, `Textarea`, `FormField`, `SectionHeader`, `PageState` e as primitivas de tabela do Design System.

## 10. Fluxo de criação e edição

“Novo item” abre um formulário base. O domínio define os atributos especializados iniciais. Editar preserva o discriminante e os atributos existentes. Duplicar cria rascunho local. Arquivar altera o status sem excluir; restaurar retorna o item ao estado ativo.

## 11. Auditoria

Cada item contém criação, última atualização, revisão e histórico mockado. Alterações locais adicionam uma entrada visual, mas não representam auditoria persistida ou juridicamente válida.

## 12. Integrações futuras

Módulos futuros devem guardar o `SharedDataItem.id`, não copiar o item inteiro. Adaptadores podem apresentar uma visão específica do domínio enquanto a autoria e o cadastro permanecem centrais. Integrações previstas: Plano Alimentar, Plano de Treino, avaliações, prontuário, Motor de Decisão, Entregáveis, Marketing, Gestão da Academia e Inteligência Empresarial.

## 13. Regras para novos domínios

1. Confirmar que não existe domínio equivalente.
2. Acrescentar o discriminante em `SHARED_DATA_DOMAINS`.
3. Criar atributos específicos quando houver campos estáveis.
4. Definir visibilidade e módulos consumidores.
5. Adicionar categorias e exemplos mínimos.
6. Incluir filtragem de permissão antes da serialização.
7. Nunca colocar regra clínica, prescrição ou cálculo no catálogo.

## 14. Limitações do MVP

Sem banco, API, upload, IA, cálculos, interpretação de exames ou prescrição. Busca, filtros e alterações são locais. Datas de auditoria são demonstrativas. Não há exclusão definitiva nem hierarquia de categorias.

## 15. Como conectar Plano Alimentar

O Plano Alimentar deverá trocar seus alimentos internos por referências `SharedDataItem.id` do domínio `FOOD`. Substituições e receitas referenciam os mesmos IDs. Quantidades e decisões específicas continuam pertencendo ao plano e ao nutricionista, não ao catálogo.

## 16. Como conectar Plano de Treino

Exercícios do domínio `EXERCISE` serão referenciados pelo plano, exercícios corretivos e evolução. Séries, repetições e prescrição pertencem ao Plano de Treino; a Central guarda somente a definição reutilizável autorizada.

## 17. Como conectar Inteligência Empresarial

Relatórios empresariais futuros poderão agregar códigos, domínios, status e uso dos itens por referência. A Central não deve armazenar conclusões analíticas nem dados clínicos duplicados; a camada empresarial consumirá eventos ou projeções autorizadas.
