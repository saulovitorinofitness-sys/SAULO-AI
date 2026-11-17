import type { ScientificLibraryDomain } from "@/features/scientific-library/contracts";
import { scientificLibraryDomainLabelForArea } from "@/features/scientific-library/labels";
import {
  SCIENTIFIC_LIBRARY_AREAS,
  scientificLibraryAreaDomains,
  scientificLibraryAreaLabels,
  type ScientificLibraryArea,
} from "@/features/scientific-library/organization";

type AreaSelection = "ALL" | ScientificLibraryArea;
type DomainSelection = "ALL" | ScientificLibraryDomain;

const buttonClass = (active: boolean) =>
  `min-h-10 rounded-[var(--radius-full)] border px-3 text-xs font-black ${
    active
      ? "border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary-hover)]"
      : "border-[var(--line)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
  }`;

export function ScientificDomainNavigation({
  area,
  domain,
  domains,
  areaCounts,
  domainCounts,
  total,
  onSelectArea,
  onSelectDomain,
}: {
  area: AreaSelection;
  domain: DomainSelection;
  domains: readonly ScientificLibraryDomain[];
  areaCounts: Readonly<Record<ScientificLibraryArea, number>>;
  domainCounts: Readonly<Partial<Record<ScientificLibraryDomain, number>>>;
  total: number;
  onSelectArea: (area: AreaSelection) => void;
  onSelectDomain: (domain: DomainSelection) => void;
}) {
  const visibleDomains =
    area === "ALL" ? domains : scientificLibraryAreaDomains[area];

  return (
    <nav
      aria-label="Áreas e domínios da Biblioteca Científica"
      className="rounded-[var(--radius-large)] border border-[var(--line)] bg-[var(--surface)] p-3"
    >
      <p className="px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
        Área profissional
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          aria-pressed={area === "ALL"}
          className={buttonClass(area === "ALL")}
          onClick={() => onSelectArea("ALL")}
          type="button"
        >
          Todos <span className="font-medium">({total})</span>
        </button>
        {SCIENTIFIC_LIBRARY_AREAS.map((option) => (
          <button
            aria-pressed={area === option}
            className={buttonClass(area === option)}
            key={option}
            onClick={() => onSelectArea(option)}
            type="button"
          >
            {scientificLibraryAreaLabels[option]}{" "}
            <span className="font-medium">({areaCounts[option]})</span>
          </button>
        ))}
      </div>

      <div className="my-3 border-t border-[var(--line)]" />
      <p className="px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
        {area === "ALL"
          ? "Domínios da biblioteca"
          : `Domínios · ${scientificLibraryAreaLabels[area]}`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          aria-pressed={domain === "ALL"}
          className={buttonClass(domain === "ALL")}
          onClick={() => onSelectDomain("ALL")}
          type="button"
        >
          {area === "ALL" ? "Todos os domínios" : "Todos da área"}
        </button>
        {visibleDomains.map((option) => (
          <button
            aria-pressed={domain === option}
            className={buttonClass(domain === option)}
            key={option}
            onClick={() => onSelectDomain(option)}
            type="button"
          >
            {scientificLibraryDomainLabelForArea(area, option)}{" "}
            <span className="font-medium">({domainCounts[option] ?? 0})</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
