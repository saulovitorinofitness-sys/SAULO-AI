# Design System SAULO AI

## 1. Objetivo

O Design System mantém as interfaces do SAULO AI consistentes, acessíveis e preparadas para os contextos `platform`, `clinic` e `academy`, sem incorporar regras clínicas. A aparência atual foi preservada; a mudança centraliza decisões antes dispersas.

## 2. Princípios

- Reutilizar antes de criar.
- Usar tokens semânticos em vez de valores visuais ligados a uma tela.
- Manter estado e ação compreensíveis sem depender somente de cor.
- Preservar os dados essenciais em qualquer largura.
- Componentes visuais não decidem permissões nem regras clínicas.

## 3. Tokens de cor

Os tokens ficam em `src/app/globals.css`: `--background`, `--surface`, `--surface-elevated`, `--line`, `--line-strong`, `--text-primary`, `--text-secondary`, `--muted`, `--primary`, `--primary-hover`, `--primary-foreground`, `--secondary`, `--success`, `--warning`, `--danger`, `--info`, `--focus`, `--disabled` e `--overlay`.

É proibido adicionar uma cor hardcoded quando um token equivalente existir. Cores semânticas locais de estado, como as escalas `emerald`, `amber`, `rose` e `sky`, são permitidas em variantes de feedback centralizadas.

## 4. Tipografia

Os tokens `--font-page-title`, `--font-page-subtitle`, `--font-section-title`, `--font-card-title`, `--font-body`, `--font-body-small` e `--font-caption` cobrem a hierarquia. Títulos de página usam peso `font-black`; corpo usa peso normal; labels e ações usam `font-bold` ou `font-black`.

## 5. Espaçamento

Usar a escala Tailwind (`gap-2`, `gap-3`, `gap-4`, `p-4`, `p-5`, `p-6`). Valores arbitrários só são aceitáveis quando descrevem uma restrição real de layout, como a largura da sidebar ou uma coluna clínica específica.

## 6. Bordas e raios

`--radius-small`, `--radius-medium`, `--radius-large` e `--radius-full`. Campos e botões usam `medium`; cards usam `large`; badges e indicadores circulares usam `full`.

## 7. Sombras

`--shadow-subtle` para superfícies, `--shadow-medium` para interação e `--shadow-elevated` para cabeçalhos ou camadas em destaque. Não usar sombra para comunicar estado.

## 8. Botões

`src/components/ui/button.tsx` oferece `Button`, `ButtonLink`, `IconButton` e `buttonStyles`. Variantes: `primary`, `secondary`, `outline`, `ghost`, `destructive` e `link`. Tamanhos: `small`, `medium`, `large` e `icon`. O estado `loading` expõe `aria-busy` e desabilita a ação.

Botões somente com ícone exigem `aria-label`. Links de navegação devem continuar links, usando `ButtonLink`, e não botões com redirecionamento imperativo.

## 9. Cards

`src/components/ui/card.tsx` oferece `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` e `CardFooter`. Variantes: `default`, `elevated`, `interactive`, `outlined`, `muted`, `success`, `warning`, `danger` e `info`.

## 10. Badges e status

`Badge` centraliza tons; `StatusBadge` centraliza estados operacionais. Todo status contém texto e marcador, sem depender somente da cor. Estados suportados incluem ativo, concluído, pendente, em andamento, revisado, bloqueado, indisponível, informativo, atenção, prioridade, sucesso e erro.

## 11. Formulários

`src/components/ui/form.tsx` contém `FormField`, `Input`, `NumberInput`, `Select`, `Textarea`, `Checkbox` e `fieldControlStyles`. Controles têm altura mínima de 44 px, foco visível, estados `disabled` e `readOnly`, placeholder consistente e mensagens associáveis pelo padrão `${id}-description`.

Campos clínicos existentes reutilizam essa base por `clinicalInputClass` e `MeasurementField`. Labels obrigatórias precisam de indicação visual e texto para leitor de tela. Erros usam `role="alert"`.

## 12. Navegação

`PatientNavigation` compõe `PatientBreadcrumb`, `PatientHubHeader`, `MasterRecordTabs`, `Progress` e botões sequenciais. Rotas, bloqueios e permissões continuam vindo dos serviços existentes. Breadcrumbs podem rolar internamente quando estritamente necessário; a página não pode gerar overflow horizontal.

## 13. Timeline

`PatientTimeline` é o padrão consolidado atual: lista cronológica sem tabela, data em elemento `time`, título, descrição, profissional, módulo e ação opcional. No celular, cada evento funciona como card; no desktop, a linha vertical é apenas um reforço visual.

## 14. Tabelas

As primitivas `TableRegion`, `Table`, `TableHead`, `TableBody`, `TableHeaderCell` e `TableCell` ficam em `src/components/ui/table.tsx`. Tabelas devem usar cabeçalho semântico (`thead`/`th`), caption acessível e ações nomeadas. Em telas pequenas, prefira cards por registro. Se a tabela for indispensável, envolva apenas o elemento em uma região rolável identificada, nunca a página inteira. Loading, vazio e erro devem usar os estados padronizados.

## 15. Estados de interface

`PageState` cobre vazio, erro e bloqueio; `Skeleton` cobre carregamento; `Badge` e `StatusBadge` cobrem sucesso e andamento. Estados específicos existentes (`EmptyState`, `ErrorState`, `PermissionDeniedState`) continuam válidos quando adicionam contexto do módulo, mas devem reutilizar essas superfícies.

Dados mockados devem permanecer identificados pelo aviso global e pelos textos dos módulos. Mensagens são operacionais, curtas e não produzem interpretação clínica.

## 16. Ícones

O projeto não possui biblioteca externa. Os ícones SVG internos ficam em `src/components/ui/icons.tsx`, evitando dependência adicional. Ícones decorativos usam `aria-hidden`; ações sem texto exigem nome acessível.

## 17. Responsividade

Breakpoints de referência: 390, 768, 1024, 1280 e 1440 px. Campos ficam em uma coluna no celular; grids crescem progressivamente; tabs quebram linha; cabeçalhos empilham; ações mantêm área mínima de toque. Informações clínicas essenciais não são removidas para caber.

## 18. Acessibilidade

- Ordem lógica de headings e landmarks.
- Foco global definido por `--focus`.
- Respeito a `prefers-reduced-motion`.
- Labels ligados por `htmlFor`/`id`.
- `aria-describedby` para ajuda e erro quando o controle for composto.
- Status com texto e marcador.
- Diálogos futuros devem controlar foco, fechar com Escape e devolver foco ao acionador.

## 19. Branding por contexto

Branding continua em `src/config/branding.ts` e `AppBrand`. `clinic` usa Clínica SV provisoriamente; `platform` preserva SAULO AI; `academy` está preparado para Academia Saulo Fitness. Tokens visuais não inventam logotipos nem cores institucionais definitivas.

## 20. Convenções para novas telas

1. Verificar `src/components/ui` e componentes do domínio antes de criar outro.
2. Compor `PageHeading`, `Card`, `Button`, `Badge`, controles de formulário e `PageState`.
3. Não copiar cadeias longas de classes já representadas por uma variante.
4. Não embutir permissão ou regra clínica em componente visual.
5. Testar teclado, 390 px e desktop antes de entregar.
6. Adicionar variante ao componente existente quando o padrão for recorrente; não criar um duplicado local.

## 21. Exemplos de uso

```tsx
import { Button, Card, CardContent, CardTitle, FormField, Input, StatusBadge } from "@/components/ui";

<Card className="p-5">
  <CardTitle>Dados compartilhados</CardTitle>
  <CardContent className="mt-4">
    <StatusBadge status="completed" />
    <FormField id="observation" label="Observação" help="Registro operacional.">
      <Input id="observation" />
    </FormField>
    <Button type="submit">Salvar</Button>
  </CardContent>
</Card>
```

Para criar um componente novo, comece pela semântica HTML, componha primitivas existentes e exponha somente variantes necessárias. A localização preferencial das primitivas é `src/components/ui`; componentes com linguagem de domínio permanecem em sua pasta funcional.
