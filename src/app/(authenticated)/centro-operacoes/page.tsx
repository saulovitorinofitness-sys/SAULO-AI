import Link from "next/link";
import {
  Activity,
  Apple,
  BarChart3,
  Bike,
  BookOpen,
  Building2,
  Dumbbell,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

type Modulo = {
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  href: string;
  cor: string;
  fundo: string;
  borda: string;
  sombra: string;
  icone: LucideIcon;
};

const modulos: Modulo[] = [
  {
    codigo: "NU",
    titulo: "Nutrição",
    descricao: "Estratégia clínica e plano alimentar",
    categoria: "Clínica SV",
    href: "/clinica",
    cor: "text-emerald-700",
    fundo: "bg-emerald-100",
    borda: "hover:border-emerald-300",
    sombra: "group-hover:shadow-emerald-100",
    icone: Apple,
  },
  {
    codigo: "TF",
    titulo: "Treinamento Físico",
    descricao: "Prescrição e periodização",
    categoria: "Clínica SV",
    href: "/pacientes",
    cor: "text-blue-700",
    fundo: "bg-blue-100",
    borda: "hover:border-blue-300",
    sombra: "group-hover:shadow-blue-100",
    icone: Dumbbell,
  },
  {
    codigo: "PE",
    titulo: "Performance",
    descricao: "Corrida e ciclismo",
    categoria: "Clínica SV",
    href: "/performance-endurance",
    cor: "text-violet-700",
    fundo: "bg-violet-100",
    borda: "hover:border-violet-300",
    sombra: "group-hover:shadow-violet-100",
    icone: Bike,
  },
  {
    codigo: "AP",
    titulo: "Avaliação Postural",
    descricao: "Análise postural e correção",
    categoria: "Clínica SV",
    href: "/pacientes",
    cor: "text-cyan-700",
    fundo: "bg-cyan-100",
    borda: "hover:border-cyan-300",
    sombra: "group-hover:shadow-cyan-100",
    icone: Activity,
  },
  {
    codigo: "SF",
    titulo: "Academia Saulo Fitness",
    descricao: "Gestão e inteligência da academia",
    categoria: "Gestão",
    href: "/gestao/inteligencia",
    cor: "text-orange-700",
    fundo: "bg-orange-100",
    borda: "hover:border-orange-300",
    sombra: "group-hover:shadow-orange-100",
    icone: Building2,
  },
  {
    codigo: "MK",
    titulo: "Marketing",
    descricao: "Conteúdo, campanhas e crescimento",
    categoria: "Crescimento",
    href: "/dashboard",
    cor: "text-pink-700",
    fundo: "bg-pink-100",
    borda: "hover:border-pink-300",
    sombra: "group-hover:shadow-pink-100",
    icone: Megaphone,
  },
  {
    codigo: "CEO",
    titulo: "Painel CEO",
    descricao: "Indicadores e decisões estratégicas",
    categoria: "Direção",
    href: "/dashboard",
    cor: "text-amber-700",
    fundo: "bg-amber-100",
    borda: "hover:border-amber-300",
    sombra: "group-hover:shadow-amber-100",
    icone: BarChart3,
  },
  {
    codigo: "BC",
    titulo: "Biblioteca Científica",
    descricao: "Artigos, evidências e protocolos",
    categoria: "Conhecimento",
    href: "/administracao/biblioteca-cientifica",
    cor: "text-slate-700",
    fundo: "bg-slate-200",
    borda: "hover:border-slate-400",
    sombra: "group-hover:shadow-slate-200",
    icone: BookOpen,
  },
  {
    codigo: "CF",
    titulo: "Configurações",
    descricao: "Dados, usuários e integrações",
    categoria: "Sistema",
    href: "/central-de-dados",
    cor: "text-zinc-700",
    fundo: "bg-zinc-200",
    borda: "hover:border-zinc-400",
    sombra: "group-hover:shadow-zinc-200",
    icone: Settings,
  },
];

export default function CentroOperacoesPage() {
  return (
    <main className="min-h-screen bg-[#f2f4f2]">
      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-10">
        <header className="rounded-[26px] border border-[#dce2dd] bg-white px-6 py-6 shadow-sm sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#123d2d] to-[#1f6a4d] text-sm font-bold tracking-[0.12em] text-[#e4c878] shadow-lg shadow-emerald-950/10">
                SV
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1f6a4d]">
                  Sistema Integrado SV
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Centro de Operações
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Clínica SV · Academia Saulo Fitness
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#dce5df] bg-[#f4faf6] px-5 py-3">
                <p className="text-xl font-bold text-[#123d2d]">9</p>
                <p className="text-xs font-medium text-slate-500">
                  Módulos disponíveis
                </p>
              </div>

              <div className="rounded-2xl border border-[#eadfbe] bg-[#fcfaf3] px-5 py-3">
                <p className="text-xl font-bold text-[#8a6a24]">4</p>
                <p className="text-xs font-medium text-slate-500">
                  Áreas clínicas
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1f6a4d]">
                Áreas de trabalho
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Escolha um módulo
              </h2>
            </div>

            <p className="text-sm text-slate-500">
              A decisão final permanece sempre com o profissional.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {modulos.map((modulo) => {
              const Icone = modulo.icone;

              return (
                <Link
                  key={modulo.codigo}
                  href={modulo.href}
                  aria-label={`Abrir módulo ${modulo.titulo}`}
                  className={`group relative flex min-h-[205px] cursor-pointer flex-col rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2 ${modulo.borda} ${modulo.sombra}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-[20px] shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:-rotate-1 ${modulo.fundo} ${modulo.cor}`}
                    >
                      <Icone
                        aria-hidden="true"
                        className="h-8 w-8"
                        strokeWidth={1.8}
                      />
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      {modulo.categoria}
                    </span>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-[17px] font-bold leading-tight text-slate-900">
                      {modulo.titulo}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {modulo.descricao}
                    </p>
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-5">
                    <span className={`text-xs font-bold ${modulo.cor}`}>
                      Abrir módulo
                    </span>

                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold transition-all duration-300 group-hover:translate-x-1 group-hover:bg-slate-900 group-hover:text-white ${modulo.fundo} ${modulo.cor}`}
                    >
                      <span aria-hidden="true">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="mt-9 flex flex-col gap-2 border-t border-slate-200 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Sistema Integrado SV · Apoio profissional e gestão</p>
          <p>Nutrição · Saúde · Performance</p>
        </footer>
      </div>
    </main>
  );
}
