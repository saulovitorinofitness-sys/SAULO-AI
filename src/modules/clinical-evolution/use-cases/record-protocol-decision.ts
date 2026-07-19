import type { ClinicalEvidenceRepository } from "../../clinical-reasoning";
import type { EntityId } from "../../shared";
import type { ProtocolDecisionType, ProtocolType } from "../domain";
import type {
  ClinicalEvolutionSessionRepository,
  ProtocolDecisionRepository,
  ProtocolHistoryRepository,
} from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionClockService,
  EvolutionProfessionalContextService,
} from "../services";
import { ClinicalEvolutionFlowError } from "./open-clinical-evolution-session";

type ProtocolContext =
  | { readonly protocolHistoryId: EntityId; readonly protocolType?: never }
  | { readonly protocolHistoryId?: undefined; readonly protocolType: ProtocolType };

export type RecordProtocolDecisionUseCaseInput = ProtocolContext & {
  readonly evolutionSessionId: EntityId;
  readonly type: ProtocolDecisionType;
  readonly justification: string;
  readonly evidenceIds: readonly [EntityId, ...EntityId[]];
  readonly idempotencyKey: string;
  readonly nutritionExclusive: boolean;
};

export class RecordProtocolDecisionUseCase {
  constructor(
    private readonly sessionRepository: ClinicalEvolutionSessionRepository,
    private readonly protocolRepository: ProtocolHistoryRepository,
    private readonly decisionRepository: ProtocolDecisionRepository,
    private readonly evidenceRepository: ClinicalEvidenceRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly clock: EvolutionClockService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: RecordProtocolDecisionUseCaseInput) {
    const existing = await this.decisionRepository.findByIdempotencyKey(
      input.evolutionSessionId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const session = await this.sessionRepository.findById(input.evolutionSessionId);
    if (!session) {
      throw new ClinicalEvolutionFlowError("EVOLUTION_SESSION_NOT_FOUND", "Clinical evolution session was not found.");
    }

    const protocol = input.protocolHistoryId
      ? await this.protocolRepository.findById(input.protocolHistoryId)
      : undefined;
    const protocolType = protocol?.type ?? input.protocolType;
    if (!protocolType) {
      throw new ClinicalEvolutionFlowError("PROTOCOL_NOT_FOUND", "Protocol history was not found.");
    }

    const evidence = await this.evidenceRepository.findByIds(input.evidenceIds);
    if (evidence.length !== input.evidenceIds.length) {
      throw new ClinicalEvolutionFlowError("EVIDENCE_NOT_FOUND", "One or more evidence references were not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanManageProtocol(
      professionalUserId,
      protocolType,
      input.nutritionExclusive,
    );

    return this.decisionRepository.recordWithEvidence({
      evolutionSessionId: session.id,
      protocolHistoryId: input.protocolHistoryId,
      professionalUserId,
      type: input.type,
      decidedAt: this.clock.now(),
      justification: input.justification,
      evidenceIds: input.evidenceIds,
      idempotencyKey: input.idempotencyKey,
      nutritionExclusive: input.nutritionExclusive,
    });
  }
}
