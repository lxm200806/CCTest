"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LedgerItem, MeResponse, PublicUser, Student } from "@/lib/types";

type SessionValue = {
  ready: boolean;
  user: PublicUser | null;
  student: Student | null;
  ledger: LedgerItem[];
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function applyMe(
  data: MeResponse,
  setUser: (user: PublicUser | null) => void,
  setStudent: (student: Student | null) => void,
  setLedger: (ledger: LedgerItem[]) => void,
  setReady: (ready: boolean) => void,
) {
  setUser(data.user);
  setStudent(data.student);
  setLedger(data.ledger ?? []);
  setReady(true);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      applyMe((await response.json()) as MeResponse, setUser, setStudent, setLedger, setReady);
    } catch {
      setUser(null);
      setStudent(null);
      setLedger([]);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (await response.json()) as MeResponse)
      .then((data) => {
        if (controller.signal.aborted) return;
        applyMe(data, setUser, setStudent, setLedger, setReady);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setUser(null);
        setStudent(null);
        setLedger([]);
        setReady(true);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(
    () => ({ ready, user, student, ledger, refresh }),
    [ready, user, student, ledger, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider 缺失");
  return value;
}
