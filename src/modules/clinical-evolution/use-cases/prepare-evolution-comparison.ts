import type { AttendanceRepository } from "../../attendance";
import type { EvolutionDimension } from "../domain";
import type { ClinicalEvolutionSessionRepository, EvolutionComparisonRepository } from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionClassificationService,
  EvolutionClockService,
  EvolutionDataReferenceService,
  EvolutionProfessionalContextService,
} from "../services";
import { ClinicalEvolutionFlowError } from "./open-clinical-evolution-session";

const comparisonDimensions: readonly EvolutionDimension[] = [
  "WEIGHT",
  "BODY_COMPOSITION",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "PHYSICAL_ASSESSMENT",
  "POSTURAL_ASSESSMENT",
  "SYMPTOMS",
  "LABORATORY_EXAMS",
  "TRAINING_PERFORMANCE",
  "DIETARY_ADHERENCE",
  "TRAINING_ADHERENCE",
  "HYDRATION",
  "SLEEP",
  "SUPPLEMENTATION",
];

export class PrepareEvolutionComparisonUseCase {
  constructor(
    private readonly sessionRepository: ClinicalEvolutionSessionRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly comparisonRepository: EvolutionComparisonRepository,
    private readonly referenceService: EvolutionDataReferenceService,
    private readonly classificationService: EvolutionClassificationService,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly clock: EvolutionClockService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new ClinicalEvolutionFlowError("EVOLUTION_SESSION_NOT_FOUND", "Clinical evolution session was not found.");
    }

    const previousSession = session.previousSessionId
      ? await this.sessionRepository.findById(session.previousSessionId)
      : undefined;
    const previousAttendance = previousSession
      ? await this.attendanceRepository.findById(previousSession.attendanceId)
      : undefined;

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanCompare(professionalUserId, session.id);

    const references = await this.referenceService.collect(
      session.masterRecordId,
      session.attendanceId,
      previousAttendance?.id,
      comparisonDimensions,
    );
    const classifiedAt = this.clock.now();
    const drafts = await Promise.all(
      references.map(async (reference) => ({
        ...reference,
        classification: await this.classificationService.classify(reference),
        classifiedAt,
      })),
    );

    return this.comparisonRepository.createMany(session.id, professionalUserId, drafts);
  }
}
