import type { PerformanceEnduranceView } from "./contracts";

const allSports = ["ROAD_RUNNING", "SPEED_CYCLING", "MTB", "DUATHLON", "TRIATHLON"] as const;
export const performanceEnduranceMock: PerformanceEnduranceView = {
  athlete: { id: "athlete-demo-001", name: "Rafael Monteiro", initials: "RM", sport: "DUATHLON", objective: "Concluir prova alvo com estratégia profissional revisada", nextCompetition: "Duathlon Serra Azul · 20/09/2026", coach: "Saulo Xavier Vitorino", nutritionist: "Saulo Xavier Vitorino", lastTraining: "Ciclismo Speed · 42 km · 15/07/2026", status: "ACTIVE" },
  planning: [
    { id: "plan-1", level: "MACROCYCLE", name: "Temporada 2026", period: "Janeiro a dezembro", objective: "Estrutura anual demonstrativa", status: "ACTIVE" },
    { id: "plan-2", level: "MESOCYCLE", name: "Construção específica", period: "Julho e agosto", objective: "Organização de volume e especificidade", status: "ACTIVE" },
    { id: "plan-3", level: "MICROCYCLE", name: "Bloco 3", period: "13 a 26 de julho", objective: "Semana de carga mockada", status: "ACTIVE" },
    { id: "plan-4", level: "WEEK", name: "Semana 29", period: "13 a 19 de julho", objective: "4 sessões planejadas", status: "ACTIVE" },
    { id: "plan-5", level: "SESSION", name: "Corrida contínua", period: "17/07 · 06:00", objective: "Sessão demonstrativa", status: "PLANNED" },
  ],
  trainings: [
    { id: "training-1", type: "RUNNING", title: "Corrida contínua", scheduledAt: "2026-07-17T06:00:00-03:00", duration: "50 min", distance: "10 km", status: "PLANNED" },
    { id: "training-2", type: "SPEED", title: "Ciclismo em percurso misto", scheduledAt: "2026-07-15T05:45:00-03:00", duration: "1h 32min", distance: "42 km", status: "COMPLETED" },
    { id: "training-3", type: "MTB", title: "Técnica em trilha", scheduledAt: "2026-07-19T07:00:00-03:00", duration: "1h 40min", distance: "28 km", status: "PLANNED" },
    { id: "training-4", type: "STRENGTH", title: "Força geral", scheduledAt: "2026-07-16T18:00:00-03:00", duration: "55 min", status: "PLANNED" },
    { id: "training-5", type: "RECOVERY", title: "Recuperação ativa", scheduledAt: "2026-07-14T18:30:00-03:00", duration: "30 min", status: "COMPLETED" },
    { id: "training-6", type: "MOBILITY", title: "Mobilidade de quadril e tornozelo", scheduledAt: "2026-07-16T06:30:00-03:00", duration: "25 min", status: "COMPLETED" },
  ],
  metrics: [
    ["pace", "Pace", "4:48 min/km", "Última corrida", ["ROAD_RUNNING", "DUATHLON", "TRIATHLON"]], ["speed", "Velocidade", "27,4 km/h", "Último pedal", ["SPEED_CYCLING", "MTB", "DUATHLON", "TRIATHLON"]], ["cadence", "Cadência", "88 rpm", "Mock", allSports], ["avg-hr", "FC média", "148 bpm", "Mock", allSports], ["max-hr", "FC máxima", "176 bpm", "Mock", allSports], ["vo2", "VO₂", "52 ml/kg/min", "Valor demonstrativo", allSports], ["ftp", "FTP", "268 W", "Mock", ["SPEED_CYCLING", "MTB", "DUATHLON", "TRIATHLON"]], ["power", "Potência", "214 W", "Média demonstrativa", ["SPEED_CYCLING", "MTB", "DUATHLON", "TRIATHLON"]], ["altimetry", "Altimetria", "620 m", "Percurso", allSports], ["elevation", "Elevação", "1.140 m", "Semana", allSports], ["distance", "Distância", "128 km", "Semana", allSports], ["time", "Tempo", "7h 42min", "Semana", allSports], ["tss", "TSS", "386", "Mock sem cálculo", allSports], ["load", "Carga semanal", "Moderada · mock", "Sem classificação definitiva", allSports],
  ].map(([id, label, value, context, availableFor]) => ({ id, label, value, context, availableFor })) as PerformanceEnduranceView["metrics"],
  equipment: [
    { id: "eq-1", category: "WATCH", name: "Relógio esportivo demonstrativo", detail: "GPS e frequência", status: "ACTIVE" }, { id: "eq-2", category: "BIKE", name: "Bike Speed demonstrativa", detail: "Uso principal em asfalto", status: "ACTIVE" }, { id: "eq-3", category: "BIKE", name: "MTB demonstrativa", detail: "Uso em trilha", status: "MAINTENANCE" }, { id: "eq-4", category: "SHOE", name: "Tênis de rodagem", detail: "420 km registrados no mock", status: "REPLACE_SOON" }, { id: "eq-5", category: "SENSOR", name: "Sensor de cadência", detail: "Conectividade futura", status: "ACTIVE" }, { id: "eq-6", category: "POWER_METER", name: "Power meter", detail: "Dados apenas mockados", status: "ACTIVE" }, { id: "eq-7", category: "STRAP", name: "Cinta cardíaca", detail: "Registro de FC", status: "ACTIVE" },
  ],
  competitions: [
    { id: "race-1", name: "Duathlon Serra Azul", date: "2026-09-20", distance: "5 km + 40 km + 10 km", objective: "Prova alvo da temporada", status: "UPCOMING" }, { id: "race-2", name: "Desafio Speed Vale", date: "2026-08-16", distance: "80 km", objective: "Preparatória", status: "UPCOMING" }, { id: "race-3", name: "Circuito 10K SV", date: "2026-05-24", distance: "10 km", objective: "Controle demonstrativo", result: "48min 12s · mock", status: "COMPLETED" },
  ],
  nutrition: { preTraining: "Estratégia registrada pelo nutricionista · mock", duringTraining: "Estrutura de consumo durante sessões longas · mock", postTraining: "Organização pós-treino · mock", hydration: "Plano de hidratação registrado · sem cálculo", carbohydrate: "Quantidade definida profissionalmente · mock", electrolytes: "Estratégia registrada · mock", caffeine: "Uso sob revisão profissional · mock", supplementation: "Suplementação registrada, sem recomendação automática" },
  recovery: { sleep: "7h 32min", hrv: "62 ms · mock", pain: "2/10 · autorrelato", fatigue: "4/10 · autorrelato", rpe: "6/10 · última sessão", weight: "74,8 kg · origem compartilhada", mood: "Disposto · autorrelato", recordedAt: "2026-07-16T07:10:00-03:00" },
  timeline: [
    { id: "event-1", date: "2026-07-16T07:10:00-03:00", title: "Recuperação registrada", description: "Sono, fadiga, dor e humor mockados.", domain: "ASSESSMENT" }, { id: "event-2", date: "2026-07-15T07:40:00-03:00", title: "Treino Speed concluído", description: "42 km registrados sem integração externa.", domain: "TRAINING" }, { id: "event-3", date: "2026-07-12T10:00:00-03:00", title: "Consulta de acompanhamento", description: "Revisão profissional demonstrativa.", domain: "CONSULTATION" }, { id: "event-4", date: "2026-07-05T09:20:00-03:00", title: "Bioimpedância vinculada", description: "Referência ao registro compartilhado, sem duplicação.", domain: "BIOIMPEDANCE" }, { id: "event-5", date: "2026-06-28T08:00:00-03:00", title: "Exames organizados", description: "Existência registrada sem interpretação.", domain: "LABORATORY" }, { id: "event-6", date: "2026-06-22T06:30:00-03:00", title: "Peso atualizado", description: "74,8 kg no registro de origem.", domain: "WEIGHT" },
  ],
  futureIntegrations: [
    { id: "platform-1", name: "Garmin", format: "PLATFORM", status: "IN_DEVELOPMENT" }, { id: "platform-2", name: "Apple Watch", format: "PLATFORM", status: "IN_DEVELOPMENT" }, { id: "platform-3", name: "Strava", format: "PLATFORM", status: "IN_DEVELOPMENT" }, { id: "platform-4", name: "Coros", format: "PLATFORM", status: "IN_DEVELOPMENT" }, { id: "platform-5", name: "Polar", format: "PLATFORM", status: "IN_DEVELOPMENT" }, { id: "format-1", name: "FIT", format: "FIT", status: "IN_DEVELOPMENT" }, { id: "format-2", name: "TCX", format: "TCX", status: "IN_DEVELOPMENT" }, { id: "format-3", name: "GPX", format: "GPX", status: "IN_DEVELOPMENT" }, { id: "format-4", name: "CSV", format: "CSV", status: "IN_DEVELOPMENT" },
  ],
  updatedAt: "2026-07-16T10:35:00-03:00",
};
