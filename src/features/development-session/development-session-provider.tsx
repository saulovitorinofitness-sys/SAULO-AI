"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import type { SessionUser } from "@/features/mvp";

import {
  DEVELOPMENT_PROFESSIONALS,
  DEVELOPMENT_USER_QUERY_KEY,
  DEVELOPMENT_USER_STORAGE_KEY,
  developmentProfessionalFromUserId,
  isDevelopmentUserKey,
  type DevelopmentProfessional,
  type DevelopmentUserKey,
} from "./config";

interface DevelopmentSessionValue {
  readonly professional: DevelopmentProfessional;
  readonly selectUser: (key: DevelopmentUserKey) => void;
}

const DevelopmentSessionContext =
  createContext<DevelopmentSessionValue | null>(null);
const developmentUserChangedEvent =
  "saulo-ai:development-user-changed";

function subscribeToDevelopmentUser(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(
    developmentUserChangedEvent,
    onStoreChange,
  );
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(
      developmentUserChangedEvent,
      onStoreChange,
    );
  };
}

function readDevelopmentUser() {
  const query = new URLSearchParams(window.location.search);
  const queryKey = query.get(DEVELOPMENT_USER_QUERY_KEY);
  const storedKey = window.localStorage.getItem(
    DEVELOPMENT_USER_STORAGE_KEY,
  );

  if (isDevelopmentUserKey(storedKey)) return storedKey;
  if (isDevelopmentUserKey(queryKey)) return queryKey;
  if (
    query.get("scenario") === "maria-continuity" ||
    query.get("scenario") === "previous-comparison"
  ) {
    return "maria";
  }
  return "saulo";
}

export function DevelopmentSessionProvider({
  children,
  initialUser,
}: {
  readonly children: ReactNode;
  readonly initialUser: SessionUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const initialKey =
    developmentProfessionalFromUserId(initialUser.id).key;
  const selectedKey = useSyncExternalStore(
    subscribeToDevelopmentUser,
    readDevelopmentUser,
    () => initialKey,
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    window.localStorage.setItem(
      DEVELOPMENT_USER_STORAGE_KEY,
      selectedKey,
    );

    const query = new URLSearchParams(window.location.search);
    if (query.get(DEVELOPMENT_USER_QUERY_KEY) !== selectedKey) {
      query.set(DEVELOPMENT_USER_QUERY_KEY, selectedKey);
      router.replace(`${pathname}?${query.toString()}`, {
        scroll: false,
      });
    }
  }, [pathname, router, selectedKey]);

  const selectUser = useCallback((key: DevelopmentUserKey) => {
    window.localStorage.setItem(
      DEVELOPMENT_USER_STORAGE_KEY,
      key,
    );
    const query = new URLSearchParams(window.location.search);
    query.set(DEVELOPMENT_USER_QUERY_KEY, key);
    router.replace(`${pathname}?${query.toString()}`, {
      scroll: false,
    });
    window.dispatchEvent(
      new Event(developmentUserChangedEvent),
    );
  }, [pathname, router]);

  const value = useMemo(
    () => ({
      professional: DEVELOPMENT_PROFESSIONALS[selectedKey],
      selectUser,
    }),
    [selectUser, selectedKey],
  );

  return (
    <DevelopmentSessionContext.Provider value={value}>
      {children}
    </DevelopmentSessionContext.Provider>
  );
}

export function useDevelopmentSession() {
  const context = useContext(DevelopmentSessionContext);

  if (!context) {
    throw new Error(
      "useDevelopmentSession deve ser usado dentro de DevelopmentSessionProvider.",
    );
  }

  return context;
}
