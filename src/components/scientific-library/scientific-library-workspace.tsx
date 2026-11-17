"use client";

import { useMemo, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import type {
  ScientificLibraryDomain,
  ScientificLibraryItem,
  ScientificLibraryView,
} from "@/features/scientific-library/contracts";
import {
  SCIENTIFIC_LIBRARY_AREAS,
  filterScientificLibraryItems,
  itemBelongsToScientificArea,
  type ScientificLibraryArea,
} from "@/features/scientific-library/organization";

import { ScientificDomainNavigation } from "./scientific-domain-navigation";
import { ScientificLibraryDetails } from "./scientific-library-details";
import { ScientificLibraryHeader } from "./scientific-library-header";
import { ScientificLibraryImport } from "./scientific-library-import";
import { ScientificLibraryItemForm } from "./scientific-library-item-form";
import { ScientificLibraryList } from "./scientific-library-list";

type AreaSelection = "ALL" | ScientificLibraryArea;
type DomainSelection = "ALL" | ScientificLibraryDomain;

export function ScientificLibraryWorkspace({
  view,
}: {
  view: ScientificLibraryView;
}) {
  const [items, setItems] = useState<readonly ScientificLibraryItem[]>(view.items);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<AreaSelection>("ALL");
  const [domain, setDomain] = useState<DomainSelection>("ALL");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(
    () =>
      new Set(
        view.items
          .filter((item) => item.initiallyFavorite)
          .map((item) => item.id),
      ),
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(
    view.items[0]?.id,
  );
  const [management, setManagement] = useState<"NEW" | "IMPORT" | "EDIT">();

  const areaCounts = useMemo(
    () =>
      Object.fromEntries(
        SCIENTIFIC_LIBRARY_AREAS.map((itemArea) => [
          itemArea,
          items.filter((item) => itemBelongsToScientificArea(item, itemArea)).length,
        ]),
      ) as Record<ScientificLibraryArea, number>,
    [items],
  );
  const domainCounts = useMemo(
    () =>
      Object.fromEntries(
        view.domains.map((itemDomain) => [
          itemDomain,
          items.filter(
            (item) =>
              item.domain === itemDomain &&
              itemBelongsToScientificArea(item, area),
          ).length,
        ]),
      ) as Record<ScientificLibraryDomain, number>,
    [area, items, view.domains],
  );
  const visible = useMemo(
    () =>
      filterScientificLibraryItems(items, {
        area,
        domain,
        query,
        favoritesOnly,
        favorites,
      }),
    [area, domain, favorites, favoritesOnly, items, query],
  );
  const selected =
    items.find(
      (item) =>
        item.id === selectedId &&
        visible.some((entry) => entry.id === item.id),
    ) ?? visible[0];
  const managementArea = area === "ALL" ? "NUTRITION" : area;
  const managementDomain = domain === "ALL" ? undefined : domain;

  function selectArea(nextArea: AreaSelection) {
    setArea(nextArea);
    setDomain("ALL");
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function includeCreated(item: ScientificLibraryItem, disposition: "EXIT" | "ADD_ANOTHER") {
    setItems((current) => [item, ...current]);
    setArea(item.area ?? managementArea);
    setDomain(item.domain);
    setSelectedId(item.id);
    if (disposition === "EXIT") setManagement(undefined);
  }

  function includeUpdated(item: ScientificLibraryItem) {
    setItems((current) => current.map((entry) => entry.id === item.id ? item : entry));
    setArea(item.area ?? "PERFORMANCE");
    setDomain(item.domain);
    setSelectedId(item.id);
    setManagement(undefined);
  }

  function includeImported(created: readonly ScientificLibraryItem[]) {
    if (!created.length) return;
    setItems((current) => [...created, ...current]);
    const first = created[0];
    setArea(first.area ?? managementArea);
    setDomain(first.domain);
    setSelectedId(first.id);
    setManagement(undefined);
  }

  if (management === "NEW") {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <ScientificLibraryItemForm
          initialArea={managementArea}
          initialDomain={managementDomain}
          onCancel={() => setManagement(undefined)}
          onSaved={includeCreated}
        />
      </div>
    );
  }

  return (
    <div>
      <ScientificLibraryHeader view={{ ...view, items }} />
      <Card className="mb-4 p-4 md:p-5">
        <label className="block text-sm font-black text-[var(--text-primary)]" htmlFor="scientific-search">
          Pesquisar em toda a biblioteca
        </label>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row">
          <Input
            id="scientific-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, categoria, tag, origem ou descrição"
            type="search"
            value={query}
          />
          <Button
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((value) => !value)}
            variant={favoritesOnly ? "secondary" : "outline"}
          >
            ★ Favoritos ({favorites.size})
          </Button>
          <Button onClick={() => setManagement("NEW")} variant="outline">
            + Novo item
          </Button>
          <Button onClick={() => setManagement("IMPORT")} variant={management === "IMPORT" ? "secondary" : "outline"}>
            Importar arquivo
          </Button>
          {selected?.domain === "EXERCISE" && selected.originKind ? (
            <Button onClick={() => setManagement("EDIT")} variant={management === "EDIT" ? "secondary" : "outline"}>
              Editar exercício
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          A busca respeita a área e o domínio selecionados. Dados mockados e cadastros profissionais permanecem identificados por origem.
        </p>
      </Card>

      {management === "EDIT" && selected?.domain === "EXERCISE" && selected.originKind ? (
        <ScientificLibraryItemForm
          initialArea="PERFORMANCE"
          initialDomain="EXERCISE"
          initialItem={selected}
          onCancel={() => setManagement(undefined)}
          onSaved={(item) => includeUpdated(item)}
        />
      ) : null}
      {management === "IMPORT" ? (
        <ScientificLibraryImport
          currentItems={items}
          initialArea={managementArea}
          initialDomain={managementDomain}
          onCancel={() => setManagement(undefined)}
          onImported={includeImported}
        />
      ) : null}

      <ScientificDomainNavigation
        area={area}
        areaCounts={areaCounts}
        domain={domain}
        domainCounts={domainCounts}
        domains={view.domains}
        onSelectArea={selectArea}
        onSelectDomain={setDomain}
        total={items.length}
      />
      <p aria-live="polite" className="my-4 text-sm font-bold text-[var(--text-secondary)]">
        {visible.length} item(ns) encontrado(s)
      </p>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.28fr)]">
        <ScientificLibraryList
          favorites={favorites}
          items={visible}
          onSelect={setSelectedId}
          onToggleFavorite={toggleFavorite}
          selectedId={selected?.id}
        />
        <ScientificLibraryDetails item={selected} />
      </div>
    </div>
  );
}
