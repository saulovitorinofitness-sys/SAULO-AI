# Branding do SAULO AI

## Contextos institucionais

O branding distingue três contextos sem alterar a arquitetura funcional:

- **SAULO AI** é o nome interno da plataforma, do projeto de software e da tecnologia compartilhada.
- **Clínica SV** é o nome provisório exibido no contexto clínico. A configuração mantém `isProvisional: true` até a confirmação institucional.
- **Academia Saulo Fitness** é o nome confirmado para o contexto futuro da academia. Esta Sprint não cria módulos da academia.

## Implementação

A configuração tipada está em `src/config/branding.ts`. O componente reutilizável está em `src/components/ui/app-brand.tsx` e oferece as variantes `full`, `compact`, `sidebar`, `header` e `footer`.

O layout clínico consome `AppBrand` pelo shell autenticado. Na ausência de imagem, o componente apresenta um fallback tipográfico acessível e identifica o SAULO AI de forma secundária como tecnologia da plataforma.

## Ativos oficiais

Não há logotipos oficiais, favicon ou manifest institucional no repositório. Os futuros arquivos devem ser armazenados em:

- `public/branding/platform/`
- `public/branding/clinic/`
- `public/branding/academy/`

Somente ativos aprovados podem ser adicionados. É proibido desenhar, reconstruir, gerar ou baixar imitações de logotipos institucionais.

Depois que um ativo oficial for incluído, sua referência deve ser registrada na identidade correspondente por `logoPath`, `logoCompactPath` ou `faviconPath`. O fallback tipográfico deve continuar disponível para falhas de carregamento e contextos compactos.

## Pendências

- confirmar o nome institucional definitivo da clínica;
- receber e validar os logotipos oficiais;
- receber e configurar o favicon oficial;
- definir eventuais cores institucionais definitivas;
- criar ou atualizar o Documento Mestre do Front-end quando `docs/frontend-master.md` estiver disponível.
