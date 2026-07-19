import type { EvidenceLevel, EvidenceType } from "../domain";
import type { ClinicalEvidenceRepository } from "../repositories";
import type {
  ClinicalClockService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";

export interface RegisterClinicalEvidenceInput {
  readonly key: string;
  readonly title: string;
  readonly reference: string;
  readonly type: EvidenceType;
  readonly level: EvidenceLevel;
}

export class RegisterClinicalEvidenceUseCase {
  constructor(
    private readonly evidenceRepository: ClinicalEvidenceRepository,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(input: RegisterClinicalEvidenceInput) {
    const existing = await this.evidenceRepository.findByKey(input.key);
    if (existing) return existing;

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanManageEvidence(professionalUserId);

    return this.evidenceRepository.register({
      ...input,
      professionalUserId,
      registeredAt: this.clock.now(),
    });
  }
}
