import Link from "next/link";

const systemAreas = [
  {
    title: "Nutrição",
    description:
      "Atendimentos nutricionais, estratégia clínica, plano alimentar e evolução.",
    href: "/pacientes",
    icon: "🥗",
    accent:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400",
  },
  {
    title: "Treinamento Físico",
    description:
      "Avaliação física, prescrição, periodização e acompanhamento dos treinos.",
    href: "/pacientes",
    icon: "🏋️",
    accent:
      "border-orange-200 bg-orange-50 text-orange-800 hover:border-orange-400",
  },
  {
    title: "Performance",
    description:
      "Corrida, ciclismo, testes, zonas de treinamento e monitoramento esportivo.",
    href: "/pacientes",
    icon: "🏃",
    accent:
      "border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-400",
  },
  {
    title: "Avaliação Postural",
    description:
      "Avaliação postural, análise funcional e exercícios corretivos.",
    href: "/pacientes",
    icon: "🧍",
    accent:
      "border-cyan-200 bg-cyan-50 text-cyan-800 hover:border-cyan-400",
  },
  {
    title: "Academia Saulo Fitness",
    description:
      "Operação da academia, alunos, retenção, serviços e indicadores.",
    href: "/dashboard",
    icon: "🏢",
    accent:
      "border-red-200 bg-red-50 text-red-800 hover:border-red-400",
  },
  {
    title: "Marketing",
    description:
      "Planejamento editorial, campanhas, conteúdos e acompanhamento de resultados.",
    href: "/dashboard",
    icon: "📢",
    accent:
      "border-pink-200 bg-pink-50 text-pink-800 hover:border-pink-400",
  },
  {
    title: "Painel CEO",
    description:
      "Visão estratégica da clínica, academia, financeiro e produtividade.",
    href: "/dashboard",
    icon: "📊",
    accent:
      "border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-500",
  },
  {
    title: "Biblioteca Científica",
    description:
      "Diretrizes, consensos, artigos, protocolos e bases profissionais.",
    href: "/dashboard",
    icon: "📚",
    accent:
      "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-400",
  },
] as const;

const secondaryActions = [
  {
    title: "Buscar paciente",
    description: "Localize um paciente cadastrado.",
    href: "/pacientes",
    icon: "🔎",
  },
  {
    title: "Novo paciente",
    description: "Inicie um cadastro no Prontuário Mestre.",
    href: "/pacientes",
    icon: "👤",
  },
  {
    title: "Abrir agenda",
    description: "Consulte atendimentos e compromissos.",
    href: "/agenda",
    icon: "📅",
  },
] as const;

const dailyIndicators = [
  {
    label: "Consultas hoje",
    value: "8",
    detail: "Agenda clínica",
  },
  {
    label: "Em atendimento",
    value: "2",
    detail: "Fluxos em andamento",
  },
  {
    label: "Retornos",
    value: "3",
    detail: "Acompanhamentos",
  },
  {
    label: "Planos pendentes",
    value: "4",
    detail: "Aguardando revisão",
  },
  {
    label: "Alertas",
    value: "2",
    detail: "Precisam de atenção",
  },
] as const;

const pendingItems = [
  {
    title: "Plano alimentar aguardando aprovação",
    description:
      "Existe uma proposta assistida por IA pendente de validação profissional.",
    area: "Nutrição",
    icon: "🥗",
  },
  {
    title: "Avaliação física incompleta",
    description:
      "O atendimento possui dados pendentes antes da prescrição do treinamento.",
    area: "Treinamento",
    icon: "🏋️",
  },
  {
    title: "Paciente sem retorno há mais de 30 dias",
    description:
      "Verifique a necessidade de contato e continuidade do acompanhamento.",
    area: "Acompanhamento",
    icon: "⚠️",
  },
] as const;

const appointments = [
  {
    time: "08:00",
    patient: "João da Silva",
    type: "Consulta inicial",
    area: "Nutrição",
  },
  {
    time: "10:00",
    patient: "Anna Tazia Rodrigues",
    type: "Retorno nutricional",
    area: "Nutrição",
  },
  {
    time: "14:30",
    patient: "Maria Oliveira",
    type: "Avaliação física",
    area: "Treinamento",
  },
] as const;

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-900 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-8">
        <div className="grid gap-7 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                SAULO AI
              </p>

              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                Centro de Operações
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Bom dia, Saulo.
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-200 sm:text-base">
              Visualize a operação, identifique prioridades e acesse todas as
              áreas profissionais do SAULO AI a partir de um único ambiente.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Unidade
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  Clínica SV
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Operação
                </p>

                <p className="mt-1 text-sm font-black text-emerald-300">
                  Pronta para atendimento
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-72 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
              Usuário
            </p>

            <p className="mt-2 text-lg font-black text-white">
              Saulo Xavier Vitorino
            </p>

            <div className="mt-4 space-y-2">
              <p className="rounded-xl bg-black/15 px-3 py-2 text-xs font-bold text-slate-100">
                Nutricionista
              </p>

              <p className="rounded-xl bg-black/15 px-3 py-2 text-xs font-bold text-slate-100">
                Profissional de Educação Física
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-emerald-400"
              />

              <p className="text-xs font-bold text-emerald-200">
                SAULO AI pronto para operar
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="system-areas-title">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Ecossistema integrado
          </p>

          <h2
            id="system-areas-title"
            className="mt-1 text-2xl font-black text-slate-950"
          >
            Áreas do SAULO AI
          </h2>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Selecione o centro de operação que deseja acessar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {systemAreas.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className={`group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${area.accent}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                  {area.icon}
                </div>

                <span
                  aria-hidden="true"
                  className="text-lg font-black opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100"
                >
                  →
                </span>
              </div>

              <h3 className="mt-5 text-lg font-black">{area.title}</h3>

              <p className="mt-2 text-sm font-semibold leading-6 opacity-75">
                {area.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="main-action-title">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Operação
          </p>

          <h2
            id="main-action-title"
            className="mt-1 text-2xl font-black text-slate-950"
          >
            O que precisa ser feito agora?
          </h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <Link
            href="/pacientes"
            className="group overflow-hidden rounded-3xl border border-emerald-800 bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl sm:p-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">
              🩺
            </div>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              Ação principal
            </p>

            <h3 className="mt-2 text-2xl font-black sm:text-3xl">
              Iniciar atendimento
            </h3>

            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-emerald-100 sm:text-base">
              Selecione o paciente e inicie um atendimento de Nutrição,
              Treinamento Físico, Performance ou Avaliação Postural.
            </p>

            <div className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-emerald-900 transition group-hover:bg-emerald-50">
              Iniciar novo atendimento
              <span
                aria-hidden="true"
                className="ml-2 transition group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          </Link>

          <div className="grid gap-3">
            {secondaryActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                  {action.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-950">
                    {action.title}
                  </h3>

                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    {action.description}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="font-black text-emerald-700 transition group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <article className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4 sm:px-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                SAULO AI recomenda
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Continue de onde parou
              </h2>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                      Nutrição
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Tempo estimado: 6 minutos
                    </span>
                  </div>

                  <p className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Paciente
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-950">
                    Anna Tazia Rodrigues
                  </h3>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">
                        Etapa atual
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-900">
                        Estratégia Nutricional
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">
                        Próxima etapa
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-900">
                        Plano Alimentar
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/pacientes"
                  className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-6 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  Continuar atendimento
                </Link>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
              Prioridades
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Sua atenção agora
            </h2>

            <p className="mt-2 text-sm font-medium text-slate-600">
              Pendências organizadas por impacto na continuidade dos
              atendimentos.
            </p>

            <div className="mt-5 space-y-3">
              {pendingItems.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                    {item.icon}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">{item.title}</p>

                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                        {item.area}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Compromissos
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Agenda de hoje
          </h2>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Próximos atendimentos programados.
          </p>

          <div className="mt-5 space-y-3">
            {appointments.map((appointment) => (
              <div
                key={`${appointment.time}-${appointment.patient}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-black text-emerald-700">
                    {appointment.time}
                  </p>

                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600">
                    {appointment.area}
                  </span>
                </div>

                <p className="mt-3 font-black text-slate-950">
                  {appointment.patient}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {appointment.type}
                </p>
              </div>
            ))}
          </div>

          <Link
            href="/agenda"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-700 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
          >
            Abrir agenda completa
          </Link>
        </aside>
      </section>

      <section
        aria-labelledby="daily-summary-title"
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Indicadores
          </p>

          <h2
            id="daily-summary-title"
            className="mt-1 text-2xl font-black text-slate-950"
          >
            Resumo da operação
          </h2>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Visão consolidada das atividades registradas no dia.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {dailyIndicators.map((indicator) => (
            <div
              key={indicator.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-xs font-bold text-slate-500">
                {indicator.label}
              </p>

              <p className="mt-2 text-3xl font-black text-slate-950">
                {indicator.value}
              </p>

              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                {indicator.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}