import { AthleteDashboardHeader } from "./athlete-dashboard-header";
import { EnduranceHistory, FutureImportsPanel } from "./endurance-history";
import { CompetitionPanel, EquipmentPanel } from "./equipment-and-competitions";
import { SportsNutritionPanel, RecoveryPanel } from "./nutrition-and-recovery";
import { PerformanceMetrics } from "./performance-metrics";
import { TrainingPlanning, TrainingSessions } from "./planning-and-training";
import type { PerformanceEnduranceView } from "@/features/performance-endurance";

const sections = [["planejamento", "Planejamento"], ["treinos", "Treinos"], ["metricas", "Métricas"], ["equipamentos", "Equipamentos"], ["competicoes", "Competições"], ["nutricao", "Nutrição"], ["recuperacao", "Recuperação"], ["historico", "Histórico"], ["importacoes", "Importações futuras"]] as const;
export function PerformanceEnduranceWorkspace({ view }: { view: PerformanceEnduranceView }) { return <div className="grid gap-6"><AthleteDashboardHeader athlete={view.athlete} updatedAt={view.updatedAt} /><nav aria-label="Módulos do Performance Endurance" className="flex flex-wrap gap-2 rounded-[var(--radius-large)] border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-subtle)]">{sections.map(([id, label]) => <a className="inline-flex min-h-10 items-center rounded-[var(--radius-medium)] border border-[var(--line)] px-3 text-xs font-black text-[var(--text-secondary)] transition hover:bg-[var(--secondary)] hover:text-[var(--primary-hover)]" href={`#${id}`} key={id}>{label}</a>)}</nav><div className="grid items-start gap-6 xl:grid-cols-2"><TrainingPlanning cycles={view.planning} /><TrainingSessions sessions={view.trainings} /></div><PerformanceMetrics metrics={view.metrics} /><div className="grid items-start gap-6 xl:grid-cols-2"><EquipmentPanel items={view.equipment} /><CompetitionPanel competitions={view.competitions} /></div><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]"><SportsNutritionPanel strategy={view.nutrition} /><RecoveryPanel recovery={view.recovery} /></div><EnduranceHistory events={view.timeline} /><FutureImportsPanel integrations={view.futureIntegrations} /></div>; }

