# Importação de Dados do Next Fit

## 1. Objetivo

Validar localmente relatórios empresariais antes de simular sua entrada no Painel do CEO, sem persistência ou interpretação automática.

## 2. Formatos aceitos

XLSX, XLS e CSV, com limite demonstrativo de 10 MB.

## 3. Por que priorizar Excel e CSV

Esses formatos possuem linhas, colunas e cabeçalhos estruturados, permitindo validação e mapeamento explícitos.

## 4. Limitações do PDF

PDF e imagens não são lidos. Não há OCR. A interface orienta solicitar Excel ou CSV.

## 5. Tipos de relatórios

Alunos ativos, bloqueados, cancelados, novas matrículas, frequência, inadimplência, contas a receber, recebimentos, cancelamentos, planos, CRM e leads, agenda e relatório geral de clientes.

## 6. Fluxo de importação

Origem → relatório → arquivo → validação → mapeamento → prévia → inconsistências → confirmação → impacto demonstrativo → histórico local.

## 7. Validação

Confere extensão, tamanho, planilha, cabeçalho, linhas, colunas duplicadas, obrigatoriedade por relatório, datas, números, status, planos e possíveis duplicidades. Não interpreta desempenho empresarial.

## 8. Mapeamento de colunas

Cada cabeçalho pode ser associado a um campo interno, ignorado ou revisado. Os campos obrigatórios variam conforme o relatório.

## 9. Modelos de mapeamento

Há modelos para alunos ativos, bloqueados, cancelamentos, frequência, financeiro e CRM. Alterações são locais.

## 10. Inconsistências

Linhas podem ser ignoradas, corrigidas localmente, marcadas para revisão ou receber correção confirmada em casos semelhantes. Não existe correção automática silenciosa.

## 11. Prévia

Tabela no desktop e cards em telas menores, com filtros por válido, alerta, inválido e duplicado.

## 12. Histórico

O histórico mockado suporta resumo, repetição, consulta de inconsistências e remoção local.

## 13. Integração com o Painel do CEO

Após confirmação, a interface apresenta o impacto demonstrativo para alunos ativos, bloqueios, cancelamentos, matrículas, inadimplência, frequência, receita e ticket médio. O Dashboard identifica seus dados da academia como provenientes da última importação demonstrativa. Não há sincronização persistente entre rotas.

## 14. Permissões

Saulo Xavier Vitorino possui acesso total. Maria de Lourdes Gomes não recebe conteúdo do módulo e encontra acesso negado na URL direta.

## 15. Estrutura de tipos

Contratos em `src/features/business-import/contracts.ts`; mocks em `mock-data.ts`; leitura local e autorização em `service.ts`; validação em `validation.ts`.

## 16. Segurança futura

Uma versão real deverá validar conteúdo também no servidor, aplicar antivírus, limites, autorização, trilha de auditoria, retenção e descarte seguro de arquivos.

## 17. Limitações do MVP

Sem banco, API Next Fit, OCR, PDF estruturado, dados reais, previsões, automações ou persistência após recarregar.

## 18. Evolução para banco real

Persistir lotes, versões de mapeamento, hash do arquivo, autoria, inconsistências e vínculos com indicadores sem duplicar registros empresariais.

## 19. Evolução para importação semanal

Adicionar agenda autorizada, idempotência, comparação de lote e aprovação antes de publicar indicadores.

## 20. Evolução para API

Criar adaptador separado para API oficial do Next Fit, mantendo os contratos da feature e substituindo somente o gateway de entrada.

## Dependência de planilhas

O processamento usa `@e965/xlsx`, fork mantido e compatível com SheetJS. A dependência é carregada dinamicamente apenas quando o usuário escolhe um arquivo e processa tudo no navegador. O pacote `xlsx` antigo foi avaliado e removido por apresentar vulnerabilidade alta no npm audit; a instalação final registra zero vulnerabilidades.
