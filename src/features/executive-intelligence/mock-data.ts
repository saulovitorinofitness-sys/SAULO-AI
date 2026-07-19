import type { ExecutiveIntelligenceView } from "./contracts";

export const executiveIntelligenceMock: ExecutiveIntelligenceView = {
  generatedAt: "2026-07-16T17:10:00-03:00",
  professionalName: "Saulo Xavier Vitorino",
  summary: {
    week: "Semana 29",
    period: "13 a 19 de julho de 2026",
    revenue: "R$ 18.640",
    expenses: "R$ 10.480",
    profit: "R$ 8.160",
    goal: "R$ 21.000",
    goalPercent: 89,
    status: "attention",
  },
  areas: [
    {
      id: "clinic", title: "Clínica", description: "Movimento semanal da Clínica SV.", comparison: "+8% em relação à semana anterior", status: "on_track",
      metrics: [
        { id: "clinic-new", label: "Pacientes novos", value: "6" }, { id: "clinic-returns", label: "Retornos", value: "17" },
        { id: "clinic-absences", label: "Faltas", value: "3" }, { id: "clinic-consultations", label: "Consultas", value: "31" },
        { id: "clinic-ticket", label: "Ticket médio", value: "R$ 352" }, { id: "clinic-revenue", label: "Receita", value: "R$ 7.860" },
      ],
    },
    {
      id: "academy", title: "Academia", description: "Movimento semanal da Academia Saulo Fitness.", comparison: "-3% em relação à semana anterior", status: "attention",
      metrics: [
        { id: "gym-active", label: "Alunos ativos", value: "214" }, { id: "gym-blocked", label: "Bloqueados", value: "9" },
        { id: "gym-cancelled", label: "Cancelamentos", value: "5" }, { id: "gym-new", label: "Novas matrículas", value: "7" },
        { id: "gym-retention", label: "Retenção", value: "94%" }, { id: "gym-ticket", label: "Ticket médio", value: "R$ 199" },
        { id: "gym-revenue", label: "Receita", value: "R$ 10.780" },
      ],
    },
    {
      id: "financial", title: "Financeiro", description: "Consolidado demonstrativo, sem fechamento contábil.", comparison: "+R$ 740 de lucro semanal", status: "on_track",
      metrics: [
        { id: "fin-revenue", label: "Receitas", value: "R$ 18.640" }, { id: "fin-expenses", label: "Despesas", value: "R$ 10.480" },
        { id: "fin-profit", label: "Lucro", value: "R$ 8.160" }, { id: "fin-cash", label: "Fluxo de caixa", value: "+ R$ 5.920" },
      ],
    },
    {
      id: "marketing", title: "Marketing", description: "Produção e aquisição registradas no mock.", comparison: "+4 leads em relação à semana anterior", status: "attention",
      metrics: [
        { id: "mkt-posts", label: "Posts", value: "3" }, { id: "mkt-reels", label: "Reels", value: "1" },
        { id: "mkt-stories", label: "Stories", value: "14" }, { id: "mkt-reach", label: "Alcance", value: "8,7 mil" },
        { id: "mkt-engagement", label: "Engajamento", value: "6,2%" }, { id: "mkt-leads", label: "Leads", value: "18" },
        { id: "mkt-conversions", label: "Conversões", value: "6" },
      ],
    },
    {
      id: "commercial", title: "Comercial", description: "Acompanhamento demonstrativo de oportunidades.", comparison: "Conversão estável na semana", status: "on_track",
      metrics: [
        { id: "sales-quotes", label: "Orçamentos", value: "24" }, { id: "sales-conversions", label: "Conversões", value: "11" },
        { id: "sales-losses", label: "Perdas", value: "5" }, { id: "sales-reason", label: "Principal motivo", value: "Prazo" },
      ],
    },
  ],
  financialPeriods: [
    { label: "Sem 26", revenue: 16200, expenses: 9700, profit: 6500 },
    { label: "Sem 27", revenue: 17450, expenses: 10030, profit: 7420 },
    { label: "Sem 28", revenue: 17900, expenses: 10480, profit: 7420 },
    { label: "Sem 29", revenue: 18640, expenses: 10480, profit: 8160 },
  ],
  alerts: [
    { id: "int-alert-1", title: "Poucas consultas", description: "A sexta-feira tem três horários demonstrativos preenchidos.", area: "Clínica", level: "attention" },
    { id: "int-alert-2", title: "Queda nas matrículas", description: "O volume semanal está abaixo do cenário anterior.", area: "Academia", level: "attention" },
    { id: "int-alert-3", title: "Academia abaixo da meta", description: "Faltam R$ 1.420 para a meta demonstrativa da semana.", area: "Academia", level: "priority" },
    { id: "int-alert-4", title: "Financeiro em revisão", description: "Duas despesas aguardam conferência manual.", area: "Financeiro", level: "information" },
    { id: "int-alert-5", title: "Poucos Reels", description: "Um Reel foi registrado nesta semana demonstrativa.", area: "Marketing", level: "information" },
  ],
  problems: [
    { id: "problem-1", title: "Agenda de sexta abaixo do esperado", description: "Há horários livres no período da tarde.", area: "Clínica", responsible: "Saulo Xavier Vitorino", priority: "high", status: "pending" },
    { id: "problem-2", title: "Conversão de matrículas", description: "Contatos recentes ainda aguardam retorno.", area: "Academia", responsible: "Equipe comercial", priority: "medium", status: "in_progress" },
    { id: "problem-3", title: "Cadência de conteúdo", description: "A frequência de vídeos ficou abaixo do plano semanal.", area: "Marketing", responsible: "Marketing", priority: "low", status: "pending" },
  ],
  actions: [
    { id: "action-1", description: "Revisar agenda e lista de retornos", responsible: "Saulo", dueDate: "17/07/2026", status: "in_progress" },
    { id: "action-2", description: "Contatar leads de matrícula", responsible: "Equipe comercial", dueDate: "18/07/2026", status: "pending" },
    { id: "action-3", description: "Conferir despesas em revisão", responsible: "Saulo", dueDate: "18/07/2026", status: "pending" },
  ],
  goals: [
    { id: "goal-1", description: "Preencher a agenda clínica prioritária", area: "Clínica", target: "8 consultas", status: "pending" },
    { id: "goal-2", description: "Recuperar contatos comerciais", area: "Academia", target: "10 contatos", status: "in_progress" },
    { id: "goal-3", description: "Regularizar a cadência de conteúdo", area: "Marketing", target: "2 Reels", status: "pending" },
  ],
};

