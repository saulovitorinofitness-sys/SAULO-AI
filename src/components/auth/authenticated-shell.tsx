"use client";

import {
  Apple,
  Banknote,
  BookOpen,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Database,
  Dumbbell,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  LogOut,
  PanelLeftOpen,
  ReceiptText,
  RefreshCcw,
  Settings,
  Users,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { AppBrand, type AppBrandVariant } from "@/components/ui/app-brand";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { PageState } from "@/components/ui/page-state";
import { loginPathFor } from "@/features/mvp/authentication-navigation";
import {
  canAccess,
  type FrontendAccessSnapshot,
} from "@/features/mvp/contracts";
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
  exact?: boolean;
  inactivePathPatterns?: readonly RegExp[];
  requiredPermission?: {
    moduleKey: Parameters<typeof canAccess>[1];
    action: Parameters<typeof canAccess>[2];
  };
  requiredAnyPermission?: readonly {
    moduleKey: Parameters<typeof canAccess>[1];
    action: Parameters<typeof canAccess>[2];
  }[];
};

type NavigationGroup = {
  id: string;
  label: string;
  sauloOnly: boolean;
  items: readonly NavigationItem[];
  activePathPatterns?: readonly RegExp[];
  activeRoute?: (pathname: string, view: string | null) => boolean;
};

type AuthenticatedSessionUser = {
  id: string;
  fullName: string;
  roleName: string;
  access: FrontendAccessSnapshot;
};

const nutritionPatientPathPatterns = [
  /^\/pacientes\/[^/]+\/estrategia-nutricional(?:\/|$)/,
  /^\/pacientes\/[^/]+\/plano-alimentar(?:\/|$)/,
] as const;

const assessmentPatientPathPatterns = [
  /^\/pacientes\/[^/]+\/atendimentos\/[^/]+\/coleta(?:\/|$)/,
  /^\/pacientes\/[^/]+\/atendimentos\/[^/]+\/painel-clinico(?:\/|$)/,
] as const;

const professionalDeliverablePathPattern =
  /^\/clinica\/plano-alimentar\/entregavel(?:\/|$)/;

const groups: readonly NavigationGroup[] = [
  {
    id: "clinic",
    label: "Atendimento",
    sauloOnly: false,
    items: [
      {
        id: "overview",
        href: "/dashboard",
        label: "Visão Geral",
        icon: LayoutDashboard,
        sauloOnly: false,
        exact: true,
      },
      {
        id: "patients",
        href: "/pacientes",
        label: "Pacientes",
        mobileLabel: "Pacientes",
        icon: Users,
        sauloOnly: false,
        bottom: true,
        inactivePathPatterns: [
          ...nutritionPatientPathPatterns,
          ...assessmentPatientPathPatterns,
        ],
      },
      {
        id: "clinical-agenda",
        href: "/agenda",
        label: "Agenda clínica",
        mobileLabel: "Agenda",
        icon: CalendarClock,
        sauloOnly: false,
        bottom: true,
      },
      {
        id: "attendances",
        href: "/atendimentos",
        label: "Atendimentos",
        icon: ClipboardList,
        sauloOnly: false,
      },
      {
        id: "evaluation-comparisons",
        href: "/avaliacoes?view=comparativos",
        label: "Evolução e comparativos",
        icon: ChartNoAxesCombined,
        sauloOnly: false,
        exact: true,
        requiredPermission: {
          moduleKey: "MASTER_RECORD",
          action: "READ",
        },
        requiredAnyPermission: [
          { moduleKey: "PHYSICAL_ASSESSMENT", action: "READ" },
          { moduleKey: "PERIMETRY", action: "READ" },
          { moduleKey: "BIOIMPEDANCE", action: "READ" },
          { moduleKey: "WORKOUT_PLAN", action: "READ" },
        ],
      },
      {
        id: "exam-requests",
        href: "/entregaveis/solicitacoes-exames",
        label: "Solicitações de exames",
        icon: FlaskConical,
        sauloOnly: false,
        requiredPermission: {
          moduleKey: "MASTER_RECORD",
          action: "READ",
        },
        requiredAnyPermission: [
          { moduleKey: "DELIVERABLES", action: "READ" },
        ],
      },
      {
        id: "herbal-prescriptions",
        href: "/entregaveis/fitoterapicos",
        label: "Fitoterápicos",
        icon: Leaf,
        sauloOnly: false,
        requiredPermission: {
          moduleKey: "MASTER_RECORD",
          action: "READ",
        },
        requiredAnyPermission: [
          { moduleKey: "DELIVERABLES", action: "READ" },
        ],
      },
      {
        id: "deliverables",
        href: "/entregaveis",
        label: "Entregáveis",
        icon: ClipboardCheck,
        sauloOnly: false,
        exact: true,
      },
    ],
  },
  {
    id: "nutrition",
    label: "Nutrição",
    sauloOnly: false,
    activePathPatterns: nutritionPatientPathPatterns,
    activeRoute: (pathname, view) =>
      professionalDeliverablePathPattern.test(pathname) && view !== "postural",
    items: [
      {
        id: "nutrition-overview",
        href: "/clinica",
        label: "Central da Nutrição",
        icon: Apple,
        sauloOnly: false,
        exact: true,
      },
      {
        id: "recipes-products",
        href: "/nutricao/receitas-produtos",
        label: "Receitas e Produtos",
        icon: ClipboardList,
        sauloOnly: false,
        requiredPermission: {
          moduleKey: "MEAL_PLAN",
          action: "READ",
        },
      },
    ],
  },
  {
    id: "assessments",
    label: "Avaliações",
    sauloOnly: false,
    activePathPatterns: assessmentPatientPathPatterns,
    activeRoute: (pathname, view) =>
      professionalDeliverablePathPattern.test(pathname) && view === "postural",
    items: [
      {
        id: "assessments-overview",
        href: "/avaliacoes",
        label: "Central de Avaliações",
        icon: ClipboardCheck,
        sauloOnly: false,
        exact: true,
      },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    sauloOnly: false,
    items: [
      {
        id: "performance-overview",
        href: "/performance-endurance",
        label: "Central da Performance",
        icon: LayoutDashboard,
        sauloOnly: false,
        exact: true,
      },
      {
        id: "exercise-library",
        href: "/performance-endurance/exercicios",
        label: "Biblioteca de Exercícios",
        icon: Dumbbell,
        sauloOnly: false,
      },
    ],
  },
  {
    id: "management",
    label: "Gestão",
    sauloOnly: false,
    items: [
      {
        id: "management-overview",
        href: "/gestao",
        label: "Visão Geral da Gestão",
        icon: LayoutDashboard,
        sauloOnly: true,
        exact: true,
      },
      {
        id: "financial",
        href: "/gestao/financeiro",
        label: "Financeiro",
        icon: WalletCards,
        sauloOnly: true,
        inactivePathPatterns: [/^\/gestao\/financeiro\/recibos-servicos(?:\/|$)/],
      },
      {
        id: "professional-service-receipts",
        href: "/gestao/financeiro/recibos-servicos",
        label: "Recibos de Serviços",
        icon: ReceiptText,
        sauloOnly: false,
      },
      {
        id: "professional-service-issuer-configuration",
        href: "/gestao/financeiro/recibos-servicos/configuracao-emissores",
        label: "Configuração dos emissores",
        icon: Settings,
        sauloOnly: true,
      },
      {
        id: "employees",
        href: "/gestao/funcionarios",
        label: "Funcionários",
        icon: UsersRound,
        sauloOnly: true,
      },
      {
        id: "payroll",
        href: "/gestao/folha-pagamento",
        label: "Folha de Pagamento",
        icon: Banknote,
        sauloOnly: true,
      },
      {
        id: "management-documents",
        href: "/gestao/documentos",
        label: "Documentos da Gestão",
        icon: ReceiptText,
        sauloOnly: true,
      },
    ],
  },
  {
    id: "master-base",
    label: "Base Mestre SV",
    sauloOnly: true,
    items: [
      {
        id: "foods",
        href: "/central-de-dados/alimentos",
        label: "Alimentos",
        icon: Database,
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
];

const subscribeToLocation = () => () => undefined;

const readMockScenario = () =>
  new URLSearchParams(window.location.search).get("scenario");

const readServerMockScenario = () => null;

const scenarioRoutes = [
  "/gestao/inteligencia",
  "/central-de-dados",
  "/gestao/importacoes",
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
  const hrefPath = item.href.split("?", 1)[0];

  if (item.inactivePathPatterns?.some((pattern) => pattern.test(pathname))) {
    return false;
  }

  return item.exact
    ? pathname === hrefPath
    : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function matchesSpecificGroupRoute(
  group: NavigationGroup,
  pathname: string,
  routeView: string | null,
) {
  return (
    group.activePathPatterns?.some((pattern) => pattern.test(pathname)) ===
      true || group.activeRoute?.(pathname, routeView) === true
  );
}

function isGroupActive(
  group: NavigationGroup,
  pathname: string,
  routeView: string | null,
) {
  return (
    group.items.some((item) => isItemActive(item, pathname)) ||
    matchesSpecificGroupRoute(group, pathname, routeView)
  );
}

function activeNavigationGroupId(
  visibleGroups: readonly NavigationGroup[],
  pathname: string,
  routeView: string | null,
) {
  const specificGroup = visibleGroups.find((group) =>
    matchesSpecificGroupRoute(group, pathname, routeView),
  );

  return (
    specificGroup?.id ??
    visibleGroups.find((group) =>
      group.items.some((item) => isItemActive(item, pathname)),
    )?.id ??
    "clinic"
  );
}

function Brand({ variant }: { variant: AppBrandVariant }) {
  return (
    <Link href="/dashboard">
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
      } rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6bc70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#163a32]`}
      href="/dashboard"
      title={collapsed ? "Clínica SV — Sistema Integrado SV" : undefined}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#0f2e27] text-xs font-black tracking-[0.08em] text-[#ead28c] shadow-sm">
        SV
      </span>

      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-black tracking-tight text-white">
            Clínica SV
          </span>

          <span className="block truncate text-[10px] font-bold text-[#a9beb5]">
            Sistema Integrado SV
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function AccountMenu({
  fullName,
  initials,
  roleName,
  darkOnDesktop = false,
}: {
  fullName: string;
  initials: string;
  roleName: string;
  darkOnDesktop?: boolean;
}) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const unavailableItemClass =
    "flex min-h-10 w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-400 disabled:opacity-100";
  const menuItemClass =
    "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d]";

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-controls={menuId}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`${fullName} — ${roleName}`}
        className={`flex min-h-11 items-center gap-2 rounded-xl px-1.5 pl-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6bc70] ${
          darkOnDesktop
            ? "text-slate-800 hover:bg-slate-100 lg:text-white lg:hover:bg-white/10"
            : "text-slate-800 hover:bg-slate-100"
        }`}
        onClick={() => setMenuOpen((value) => !value)}
        type="button"
      >
        <span className="max-w-48 truncate text-sm font-bold">
          {fullName}
        </span>

        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-xs font-black text-white ${
            darkOnDesktop
              ? "lg:bg-[#0f2e27] lg:ring-1 lg:ring-white/15"
              : ""
          }`}
        >
          {initials}
        </span>
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgb(15_23_42/0.18)]"
          id={menuId}
          role="menu"
        >
          <button
            className={unavailableItemClass}
            disabled
            role="menuitem"
            title="Funcionalidade ainda não disponível"
            type="button"
          >
            <UsersRound aria-hidden="true" className="size-[17px]" />
            Meu perfil
          </button>

          <button
            className={unavailableItemClass}
            disabled
            role="menuitem"
            title="Funcionalidade ainda não disponível"
            type="button"
          >
            <Settings
              aria-hidden="true"
              className="size-[17px] shrink-0"
            />
            <span className="whitespace-nowrap">Configurações</span>
          </button>

          <Link
            className={menuItemClass}
            href="/sair"
            onClick={() => setMenuOpen(false)}
            role="menuitem"
          >
            <RefreshCcw aria-hidden="true" className="size-[17px]" />
            Trocar profissional
          </Link>

          <div className="my-1 border-t border-slate-100" />

          <Link
            className={`${menuItemClass} text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
            href="/sair"
            onClick={() => setMenuOpen(false)}
            role="menuitem"
          >
            <LogOut aria-hidden="true" className="size-[17px]" />
            Sair do sistema
          </Link>
        </div>
      ) : null}
    </div>
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
        className={`flex min-h-9 items-center rounded-lg text-xs font-semibold text-white/35 ${
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
          <span className="shrink-0 text-[8px] font-black uppercase tracking-wide text-white/30">
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
          ? "bg-[#f4f7f5] text-[#173f35] shadow-[0_3px_12px_rgb(5_25_19/0.16)]"
          : "text-[#d5e2dd] hover:bg-white/10 hover:text-white"
      }`}
      href={contextualHref(item.href, scenario)}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#c9ab59]"
        />
      ) : null}

      <Icon
        aria-hidden="true"
        className={`size-[18px] shrink-0 ${
          active ? "text-[#1f6a4d]" : "text-[#9eb7ad]"
        }`}
        strokeWidth={active ? 2.1 : 1.8}
      />

      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function GroupedNavigation({
  access,
  collapsed = false,
  pathname,
  routeView,
  scenario,
  userId,
  onNavigate,
}: {
  access: FrontendAccessSnapshot;
  collapsed?: boolean;
  pathname: string;
  routeView: string | null;
  scenario?: string | null;
  userId: string;
  onNavigate?: () => void;
}) {
  const saulo = userId === BUILT_IN_IDS.users.sauloXavierVitorino;
  const visibleGroups = groups
    .filter((group) => !group.sauloOnly || saulo)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.sauloOnly || saulo) &&
          (!item.requiredPermission ||
            canAccess(
              access,
              item.requiredPermission.moduleKey,
              item.requiredPermission.action,
            )) &&
          (!item.requiredAnyPermission ||
            item.requiredAnyPermission.some((permission) =>
              canAccess(access, permission.moduleKey, permission.action),
            )),
      ),
    }));
  const activeGroup = activeNavigationGroupId(
    visibleGroups,
    pathname,
    routeView,
  );
  const routeKey = `${pathname}?view=${routeView ?? ""}`;
  const [navigationState, setNavigationState] = useState<{
    routeKey: string;
    openGroupId: string | null;
  }>(() => ({ routeKey, openGroupId: activeGroup }));
  const openGroupId =
    navigationState.routeKey === routeKey
      ? navigationState.openGroupId
      : activeGroup;

  function toggleGroup(groupId: string) {
    setNavigationState({
      routeKey,
      openGroupId: openGroupId === groupId ? null : groupId,
    });
  }

  if (collapsed) {
    return (
      <div className="grid gap-1.5">
        {visibleGroups.map((group, groupIndex) => (
          <div
            className={
              groupIndex > 0
                ? "border-t border-white/10 pt-1.5"
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
        const hasActiveItem = isGroupActive(group, pathname, routeView);
        const open = openGroupId === group.id;

        return (
          <section
            aria-labelledby={`nav-${group.id}`}
            className={`mb-2.5 rounded-xl border py-1 transition-colors ${
              hasActiveItem
                ? "border-white/10 bg-white/[0.055]"
                : "border-transparent"
            }`}
            key={group.id}
          >
            <button
              aria-controls={`nav-items-${group.id}`}
              aria-expanded={open}
              className={`flex min-h-7 w-full items-center justify-between rounded-lg px-3 text-left text-[9px] font-black uppercase tracking-[0.16em] transition hover:bg-white/[0.06] hover:text-white ${
                hasActiveItem ? "text-[#e0c878]" : "text-[#91aaa0]"
              }`}
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
  const routeSearchParams = useSearchParams();
  const routeView = routeSearchParams.get("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connectedUser, setConnectedUser] =
    useState<AuthenticatedSessionUser | null>(null);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  const mockScenario = useSyncExternalStore(
    subscribeToLocation,
    readMockScenario,
    readServerMockScenario,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (response.status === 401) {
          const query = routeSearchParams.toString();
          window.location.assign(loginPathFor(`${pathname}${query ? `?${query}` : ""}`));
          return;
        }

        if (!response.ok) {
          setSessionUnavailable(true);
          return;
        }

        const payload = (await response.json()) as {
          profile?: unknown;
          permissions?: {
            allowsNutritionModules?: unknown;
            entries?: unknown;
            grantsAllModules?: unknown;
          };
          user?: { id?: unknown; name?: unknown };
        };

        if (
          typeof payload.user?.id !== "string" ||
          typeof payload.user.name !== "string" ||
          typeof payload.profile !== "string" ||
          typeof payload.permissions?.allowsNutritionModules !== "boolean" ||
          typeof payload.permissions.grantsAllModules !== "boolean" ||
          !Array.isArray(payload.permissions.entries)
        ) {
          setSessionUnavailable(true);
          return;
        }

        setConnectedUser({
          id: payload.user.id,
          fullName: payload.user.name,
          roleName: payload.profile,
          access: {
            user: {
              id: payload.user.id,
              fullName: payload.user.name,
              roleName: payload.profile,
              status: "ACTIVE",
            },
            allowsNutritionModules:
              payload.permissions.allowsNutritionModules,
            grantsAllModules: payload.permissions.grantsAllModules,
            overrides: payload.permissions
              .entries as FrontendAccessSnapshot["overrides"],
          },
        });
      } catch {
        if (!controller.signal.aborted) {
          setSessionUnavailable(true);
        }
      }
    }

    void loadSession();
    return () => controller.abort();
  }, [pathname, routeSearchParams]);

  if (!connectedUser) {
    return (
      <div
        aria-busy={!sessionUnavailable}
        className="min-h-screen bg-slate-50"
      >
        {sessionUnavailable ? (
          <PageState
            description="Não foi possível consultar a sessão autenticada. Atualize a página para tentar novamente."
            title="Sessão indisponível"
            tone="blocked"
          />
        ) : (
          <span className="sr-only" role="status">
            Carregando sessão…
          </span>
        )}
      </div>
    );
  }

  const pageContent = children;
  const isFocusedPerformanceDeliverable =
    pathname === "/clinica/plano-alimentar/entregavel" &&
    routeView === "performance";
  const isExamRequestPrint =
    pathname.startsWith("/entregaveis/solicitacoes-exames/") &&
    pathname.endsWith("/imprimir");

  if (isExamRequestPrint) return <>{pageContent}</>;

  if (isFocusedPerformanceDeliverable) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="min-h-screen w-full overflow-x-clip px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {pageContent}
        </main>
      </div>
    );
  }

  const initials = connectedUser.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  const saulo =
    connectedUser.id === BUILT_IN_IDS.users.sauloXavierVitorino;

  const bottomItems = groups
    .flatMap((group) => group.items)
    .filter((item) => item.bottom && (!item.sauloOnly || saulo));

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

          <AccountMenu
            fullName={connectedUser.fullName}
            initials={initials}
            roleName={connectedUser.roleName}
          />
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
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#244b40] bg-[#163a32] py-4 shadow-[8px_0_28px_rgb(15_46_39/0.08)] transition-[width,padding] duration-200 lg:flex lg:flex-col ${
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
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[#9eb7ad] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6bc70]"
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
          <div className="mx-1 mt-3 h-px bg-white/10" />
        ) : null}

        <nav
          aria-label="Navegação principal por áreas"
          className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-color:#59766b_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#59766b] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
        >
          <GroupedNavigation
            access={connectedUser.access}
            collapsed={sidebarCollapsed}
            pathname={pathname}
            routeView={routeView}
            scenario={mockScenario}
            userId={connectedUser.id}
          />
        </nav>
      </aside>

      <div className="min-w-0 max-w-full overflow-x-clip lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-white/90 px-4 backdrop-blur md:px-7 lg:h-[4.5rem] lg:border-[#244b40] lg:bg-[#163a32]">
          <div className="lg:hidden">
            <Brand variant="header" />
          </div>

          <div className="ml-auto min-w-0">
            <AccountMenu
              darkOnDesktop
              fullName={connectedUser.fullName}
              initials={initials}
              roleName={connectedUser.roleName}
            />
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
              className="ml-auto h-full w-[min(20rem,92vw)] overflow-y-auto border-l border-[#244b40] bg-[#163a32] p-4 shadow-xl [scrollbar-color:#59766b_transparent] [scrollbar-width:thin]"
              id="mobile-menu"
              onClick={(event) => event.stopPropagation()}
            >
              <GroupedNavigation
                access={connectedUser.access}
                onNavigate={() => setMenuOpen(false)}
                pathname={pathname}
                routeView={routeView}
                scenario={mockScenario}
                userId={connectedUser.id}
              />
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
