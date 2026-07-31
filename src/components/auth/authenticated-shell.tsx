"use client";

import {
  BookOpen,
  BrainCircuit,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  Database,
  LogOut,
  Palette,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { AppBrand, type AppBrandVariant } from "@/components/ui/app-brand";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import {
  canDevelopmentUserOpenPath,
  DevelopmentUserSelector,
  useDevelopmentSession,
} from "@/features/development-session";
import { BUILT_IN_IDS } from "@/modules/permissions";

type NavigationItem = {
  id: string;
  href?: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  sauloOnly: boolean;
  bottom?: boolean;
  future?: boolean;
  showActive?: boolean;
};

type NavigationGroup = {
  id: string;
  label: string;
  sauloOnly: boolean;
  items: readonly NavigationItem[];
};

const groups: readonly NavigationGroup[] = [
  {
    id: "clinic",
    label: "Clínica",
    sauloOnly: false,
    items: [
      {
        id: "patients",
        href: "/pacientes",
        label: "Pacientes",
        mobileLabel: "Pacientes",
        icon: Users,
        sauloOnly: false,
        bottom: true,
      },
      {
        id: "clinical-agenda",
        href: "/atendimentos",
        label: "Agenda clínica",
        mobileLabel: "Agenda",
        icon: CalendarClock,
        sauloOnly: false,
        bottom: true,
        showActive: false,
      },
      {
        id: "attendances",
        href: "/atendimentos",
        label: "Atendimentos",
        icon: ClipboardList,
        sauloOnly: false,
      },
    ],
  },
  {
    id: "management",
    label: "Gestão",
    sauloOnly: true,
    items: [
      {
        id: "ceo-dashboard",
        href: "/dashboard",
        label: "Painel do CEO",
        mobileLabel: "CEO",
        icon: ChartNoAxesCombined,
        sauloOnly: true,
        bottom: true,
      },
      {
        id: "intelligence",
        href: "/gestao/inteligencia",
        label: "Central de Inteligência",
        icon: BrainCircuit,
        sauloOnly: true,
      },
      {
        id: "shared-data",
        href: "/central-de-dados",
        label: "Central de Dados",
        mobileLabel: "Dados",
        icon: Database,
        sauloOnly: true,
        bottom: true,
      },
      {
        id: "imports",
        href: "/gestao/importacoes",
        label: "Importações",
        icon: Upload,
        sauloOnly: true,
      },
    ],
  },
  {
    id: "knowledge",
    label: "Conhecimento",
    sauloOnly: true,
    items: [
      {
        id: "scientific-library",
        href: "/administracao/biblioteca-cientifica",
        label: "Biblioteca Científica",
        icon: BookOpen,
        sauloOnly: true,
      },
    ],
  },
  {
    id: "settings",
    label: "Configurações",
    sauloOnly: true,
    items: [
      {
        id: "users",
        label: "Usuários",
        icon: UsersRound,
        sauloOnly: true,
        future: true,
      },
      {
        id: "permissions",
        label: "Permissões",
        icon: ShieldCheck,
        sauloOnly: true,
        future: true,
      },
      {
        id: "branding",
        label: "Branding",
        icon: Palette,
        sauloOnly: true,
        future: true,
      },
      {
        id: "future-settings",
        label: "Configurações futuras",
        icon: Settings,
        sauloOnly: true,
        future: true,
      },
    ],
  },
];

const logout: NavigationItem = {
  id: "logout",
  href: "/sair",
  label: "Sair",
  mobileLabel: "Sair",
  icon: LogOut,
  sauloOnly: false,
  bottom: true,
};

const subscribeToLocation = () => () => undefined;

const readMockScenario = () =>
  new URLSearchParams(window.location.search).get("scenario");

const readServerMockScenario = () => null;

const scenarioRoutes = [
  "/dashboard",
  "/gestao/inteligencia",
  "/central-de-dados",
  "/gestao/importacoes",
  "/performance-endurance",
  "/administracao/biblioteca-cientifica",
];

function contextualHref(href: string, scenario?: string | null) {
  return scenario && scenarioRoutes.includes(href)
    ? `${href}?scenario=${scenario}`
    : href;
}

function isItemActive(item: NavigationItem, pathname: string) {
  if (!item.href || item.showActive === false || item.href === "/sair") {
    return false;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Brand({ variant }: { variant: AppBrandVariant }) {
  return (
    <Link href="/pacientes">
      <AppBrand context="clinic" variant={variant} />
    </Link>
  );
}

function DesktopBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      aria-label="Clínica SV — Sistema Integrado SV"
      className={`flex min-w-0 items-center ${
        collapsed ? "justify-center" : "gap-2.5"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2`}
      href="/pacientes"
      title={collapsed ? "Clínica SV — Sistema Integrado SV" : undefined}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#12664f] text-xs font-black tracking-[0.08em] text-[#ead28c]">
        SV
      </span>

      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-black tracking-tight text-[#183029]">
            Clínica SV
          </span>

          <span className="block truncate text-[10px] font-bold text-slate-500">
            Sistema Integrado SV
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function NavigationItemView({
  collapsed = false,
  item,
  pathname,
  scenario,
  onNavigate,
}: {
  collapsed?: boolean;
  item: NavigationItem;
  pathname: string;
  scenario?: string | null;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(item, pathname);

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${item.label}, em desenvolvimento`}
        className={`flex min-h-9 items-center rounded-lg text-xs font-semibold text-slate-400 ${
          collapsed
            ? "justify-center px-2"
            : "justify-between gap-2 px-3"
        }`}
        title={collapsed ? `${item.label} — em desenvolvimento` : undefined}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon aria-hidden="true" className="size-[18px] shrink-0" />

          {!collapsed ? <span className="truncate">{item.label}</span> : null}
        </span>

        {!collapsed ? (
          <span className="shrink-0 text-[8px] font-black uppercase tracking-wide text-slate-400">
            Em breve
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`relative flex min-h-10 items-center rounded-xl text-[13px] font-bold transition-colors ${
        collapsed ? "justify-center px-2" : "gap-2.5 px-3"
      } ${
        active
          ? "bg-[#e8f3ec] text-[#174f3a]"
          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
      }`}
      href={contextualHref(item.href, scenario)}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#1f6a4d]"
        />
      ) : null}

      <Icon
        aria-hidden="true"
        className={`size-[18px] shrink-0 ${
          active ? "text-[#1f6a4d]" : "text-slate-500"
        }`}
        strokeWidth={active ? 2.1 : 1.8}
      />

      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function GroupedNavigation({
  collapsed = false,
  pathname,
  scenario,
  userId,
  onNavigate,
}: {
  collapsed?: boolean;
  pathname: string;
  scenario?: string | null;
  userId: string;
  onNavigate?: () => void;
}) {
  const saulo = userId === BUILT_IN_IDS.users.sauloXavierVitorino;
  const visibleGroups = groups.filter((group) => !group.sauloOnly || saulo);
  const activeGroup =
    visibleGroups.find((group) =>
      group.items.some((item) => isItemActive(item, pathname)),
    )?.id ?? "clinic";
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(
    () => new Set([activeGroup]),
  );

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = new Set(current);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  }

  if (collapsed) {
    return (
      <div className="grid gap-1.5">
        {visibleGroups.map((group, groupIndex) => (
          <div
            className={
              groupIndex > 0
                ? "border-t border-slate-100 pt-1.5"
                : undefined
            }
            key={group.id}
          >
            <div className="grid gap-1">
              {group.items
                .filter((item) => !item.sauloOnly || saulo)
                .map((item) => (
                  <NavigationItemView
                    collapsed
                    item={item}
                    key={item.id}
                    onNavigate={onNavigate}
                    pathname={pathname}
                    scenario={scenario}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {visibleGroups.map((group) => {
        const hasActiveItem = group.items.some((item) =>
          isItemActive(item, pathname),
        );
        const open = openGroups.has(group.id) || hasActiveItem;

        return (
          <section
            aria-labelledby={`nav-${group.id}`}
            className="mb-2.5"
            key={group.id}
          >
            <button
              aria-controls={`nav-items-${group.id}`}
              aria-expanded={open}
              className="flex min-h-7 w-full items-center justify-between rounded-lg px-3 text-left text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              id={`nav-${group.id}`}
              onClick={() => toggleGroup(group.id)}
              type="button"
            >
              {group.label}

              <ChevronLeft
                aria-hidden="true"
                className={`size-3 transition-transform ${
                  open ? "-rotate-90" : ""
                }`}
              />
            </button>

            {open ? (
              <div
                className="mt-0.5 grid gap-0.5"
                id={`nav-items-${group.id}`}
              >
                {group.items
                  .filter((item) => !item.sauloOnly || saulo)
                  .map((item) => (
                    <NavigationItemView
                      item={item}
                      key={item.id}
                      onNavigate={onNavigate}
                      pathname={pathname}
                      scenario={scenario}
                    />
                  ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}

export function AuthenticatedShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const mockScenario = useSyncExternalStore(
    subscribeToLocation,
    readMockScenario,
    readServerMockScenario,
  );

  const { professional } = useDevelopmentSession();
  const connectedUser = professional.user;
  const canOpenCurrentPath = canDevelopmentUserOpenPath(
    professional,
    pathname,
  );
  const pageContent = canOpenCurrentPath ? (
    children
  ) : (
    <section
      className="mx-auto mt-8 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"
      role="alert"
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
        Acesso não permitido
      </p>
      <h1 className="mt-2 text-xl font-black text-amber-950">
        Este módulo não está disponível para {connectedUser.fullName}.
      </h1>
      <p className="mt-2 text-sm text-amber-900">
        Troque o usuário de desenvolvimento ou retorne aos módulos de
        Educação Física autorizados.
      </p>
    </section>
  );

  const initials = connectedUser.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  const saulo =
    connectedUser.id === BUILT_IN_IDS.users.sauloXavierVitorino;

  const bottomItems = [
    ...groups
      .flatMap((group) => group.items)
      .filter((item) => item.bottom && (!item.sauloOnly || saulo)),
    logout,
  ];

  const isOperationsHub =
    pathname === "/centro-operacoes" ||
    pathname.startsWith("/centro-operacoes/");

  if (isOperationsHub) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-white/90 px-4 backdrop-blur sm:px-6 lg:h-[4.5rem] lg:px-8">
          <Link
            className="text-sm font-black uppercase tracking-[0.24em] text-[var(--primary)]"
            href="/centro-operacoes"
          >
            SAULO AI
          </Link>

          <div className="flex items-center gap-3">
            <DevelopmentUserSelector />

            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-800">
                {connectedUser.fullName}
              </p>

              <p className="text-xs text-slate-500">Usuário conectado</p>
            </div>

            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-[var(--primary)] text-xs font-black text-white"
            >
              {initials}
            </span>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] w-full overflow-x-clip lg:min-h-[calc(100vh-4.5rem)]">
          {pageContent}
        </main>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-[grid-template-columns] duration-200 lg:grid ${
        sidebarCollapsed
          ? "lg:grid-cols-[5rem_minmax(0,1fr)]"
          : "lg:grid-cols-[15.25rem_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#e1e7e3] bg-white/95 py-4 backdrop-blur transition-[width,padding] duration-200 lg:flex lg:flex-col ${
          sidebarCollapsed ? "w-20 px-2" : "w-[15.25rem] px-3"
        }`}
      >
        <div
          className={`flex items-center ${
            sidebarCollapsed
              ? "min-h-[4.75rem] flex-col justify-center gap-1"
              : "min-h-10 justify-between gap-1 px-1"
          }`}
        >
          <DesktopBrand collapsed={sidebarCollapsed} />

          <button
            aria-label={
              sidebarCollapsed
                ? "Expandir barra lateral"
                : "Recolher barra lateral"
            }
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#eef5f0] hover:text-[#1f6a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d]"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={
              sidebarCollapsed
                ? "Expandir barra lateral"
                : "Recolher barra lateral"
            }
            type="button"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-[18px]" />
            ) : (
              <ChevronLeft aria-hidden="true" className="size-[18px]" />
            )}
          </button>
        </div>

        {!sidebarCollapsed ? (
          <div className="mx-1 mt-3 h-px bg-gradient-to-r from-[#1f6a4d]/30 via-[#d1ad52]/50 to-transparent" />
        ) : null}

        <nav
          aria-label="Navegação principal por áreas"
          className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-color:#dbe5df_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
        >
          <GroupedNavigation
            collapsed={sidebarCollapsed}
            pathname={pathname}
            scenario={mockScenario}
            userId={connectedUser.id}
          />

          <div className="mt-2 border-t border-slate-100 pt-2">
            <NavigationItemView
              collapsed={sidebarCollapsed}
              item={logout}
              pathname={pathname}
            />
          </div>
        </nav>

        <div
          className={`mt-3 shrink-0 border-t border-slate-100 pt-3 ${
            sidebarCollapsed ? "px-1" : ""
          }`}
          title={
            sidebarCollapsed
              ? `${connectedUser.fullName} — ${connectedUser.roleName}`
              : undefined
          }
        >
          <div
            className={`flex items-center ${
              sidebarCollapsed ? "justify-center" : "gap-2.5 px-1.5"
            }`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f3ec] text-[10px] font-black text-[#174f3a] ring-1 ring-[#d4e5da]">
              {initials}
            </span>

            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">
                  {connectedUser.fullName}
                </p>

                <p className="truncate text-[10px] text-slate-500">
                  {connectedUser.roleName}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="min-w-0 max-w-full overflow-x-clip lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-white/90 px-4 backdrop-blur md:px-7 lg:h-[4.5rem]">
          <div className="lg:hidden">
            <Brand variant="header" />
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <DevelopmentUserSelector />

            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-slate-800">
                {connectedUser.fullName}
              </p>

              <p className="text-xs text-slate-500">Usuário conectado</p>
            </div>

            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-[var(--primary)] text-xs font-black text-white"
            >
              {initials}
            </span>
          </div>

          <button
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className="ml-3 grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </header>

        {menuOpen ? (
          <div
            className="fixed inset-0 top-16 z-40 bg-slate-950/30 lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <nav
              aria-label="Navegação móvel por áreas"
              className="ml-auto h-full w-[min(20rem,92vw)] overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl [scrollbar-color:#dbe5df_transparent] [scrollbar-width:thin]"
              id="mobile-menu"
              onClick={(event) => event.stopPropagation()}
            >
              <GroupedNavigation
                onNavigate={() => setMenuOpen(false)}
                pathname={pathname}
                scenario={mockScenario}
                userId={connectedUser.id}
              />

              <div className="mt-2 border-t border-slate-100 pt-2">
                <NavigationItemView
                  item={logout}
                  onNavigate={() => setMenuOpen(false)}
                  pathname={pathname}
                />
              </div>
            </nav>
          </div>
        ) : null}

        <main className="mx-auto min-w-0 w-full max-w-[92rem] overflow-x-clip px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-8 lg:pb-10">
          {pageContent}
        </main>

        <nav
          aria-label="Navegação inferior"
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgb(15_23_42/0.06)] lg:hidden"
          style={{
            gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))`,
          }}
        >
          {bottomItems.map((item) => {
            const active =
              item.href !== "/sair" &&
              Boolean(item.href && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-center text-[9px] font-bold ${
                  active
                    ? "text-[var(--primary-hover)]"
                    : "text-slate-500"
                }`}
                href={contextualHref(item.href!, mockScenario)}
                key={item.id}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
                {item.mobileLabel}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
