"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { ScientificLibraryDomain, ScientificLibraryView } from "@/features/scientific-library";
import { ScientificDomainNavigation } from "./scientific-domain-navigation";
import { ScientificLibraryDetails } from "./scientific-library-details";
import { ScientificLibraryHeader } from "./scientific-library-header";
import { ScientificLibraryList } from "./scientific-library-list";

function searchableText(item: ScientificLibraryView["items"][number]): string {
  return [item.name, item.category, item.description, item.source, ...item.tags, ...Object.values(item.attributes).flatMap((value) => Array.isArray(value) ? value : [value])].join(" ").toLocaleLowerCase("pt-BR");
}

export function ScientificLibraryWorkspace({ view }: { view: ScientificLibraryView }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<"ALL" | ScientificLibraryDomain>("ALL");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(view.items.filter((item) => item.initiallyFavorite).map((item) => item.id)));
  const [selectedId, setSelectedId] = useState<string | undefined>(view.items[0]?.id);
  const counts = useMemo(() => Object.fromEntries(view.domains.map((item) => [item, view.items.filter((entry) => entry.domain === item).length])) as Record<ScientificLibraryDomain, number>, [view.domains, view.items]);
  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("pt-BR"); return view.items.filter((item) => (domain === "ALL" || item.domain === domain) && (!favoritesOnly || favorites.has(item.id)) && (!normalized || searchableText(item).includes(normalized))); }, [domain, favorites, favoritesOnly, query, view.items]);
  const selected = view.items.find((item) => item.id === selectedId && visible.some((entry) => entry.id === item.id)) ?? visible[0];
  function toggleFavorite(id: string) { setFavorites((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  return <div><ScientificLibraryHeader view={view} /><Card className="mb-4 p-4 md:p-5"><label className="block text-sm font-black text-[var(--text-primary)]" htmlFor="scientific-search">Pesquisar em toda a biblioteca</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input id="scientific-search" onChange={(event) => setQuery(event.target.value)} placeholder="Nome, categoria, tag, origem ou descrição" type="search" value={query} /><Button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} variant={favoritesOnly ? "secondary" : "outline"}>★ Favoritos ({favorites.size})</Button></div><p className="mt-2 text-xs text-[var(--muted)]">Busca local sobre dados mockados. Nenhuma consulta externa é realizada.</p></Card><ScientificDomainNavigation counts={counts} domains={view.domains} onSelect={setDomain} selected={domain} /><p aria-live="polite" className="my-4 text-sm font-bold text-[var(--text-secondary)]">{visible.length} item(ns) encontrado(s)</p><div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.28fr)]"><ScientificLibraryList favorites={favorites} items={visible} onSelect={setSelectedId} onToggleFavorite={toggleFavorite} selectedId={selected?.id} /><ScientificLibraryDetails item={selected} /></div></div>;
}

