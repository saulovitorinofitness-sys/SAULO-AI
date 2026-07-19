import type { SessionUser } from "@/features/mvp";

export const SCIENTIFIC_LIBRARY_DOMAINS = ["FOOD", "RECIPE", "DATA_SOURCE", "EQUATION", "ACTIVITY_FACTOR", "INJURY_FACTOR", "PATHOLOGY", "SUPPLEMENT", "LABORATORY_EXAM", "EXERCISE", "TRAINING_METHOD", "ASSESSMENT", "POSTURAL_CHANGE", "PROTOCOL"] as const;
export type ScientificLibraryDomain = (typeof SCIENTIFIC_LIBRARY_DOMAINS)[number];

export interface ScientificLibraryItem {
  readonly id: string;
  readonly sourceSharedDataId?: string;
  readonly domain: ScientificLibraryDomain;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly source: string;
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly reusableBy: readonly string[];
  readonly reviewedAt: string;
  readonly reviewedBy: string;
  readonly initiallyFavorite: boolean;
}

export interface ScientificLibraryView {
  readonly connectedProfessional: string;
  readonly lastUpdatedAt: string;
  readonly items: readonly ScientificLibraryItem[];
  readonly domains: readonly ScientificLibraryDomain[];
}

export interface ScientificLibraryGateway {
  canAccess(user: SessionUser): boolean;
  getView(user: SessionUser): Promise<ScientificLibraryView | null>;
}
