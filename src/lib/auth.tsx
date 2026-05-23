import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ADMIN, INITIAL_CLIENTS, type ClientAccount } from "./mock-data";

export type Role = "admin" | "client";

export interface SessionUser {
  role: Role;
  email: string;
  name: string;
  clientId?: string;
}

interface AuthCtx {
  user: SessionUser | null;
  hydrated: boolean;
  clients: ClientAccount[];
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  addClient: (input: { name: string; company: string; email: string; password: string }) => ClientAccount;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "madar.session.v1";
const CLIENTS_KEY = "madar.clients.v1";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [clients, setClients] = useState<ClientAccount[]>(INITIAL_CLIENTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setUser(JSON.parse(s));
      const c = localStorage.getItem(CLIENTS_KEY);
      if (c) setClients(JSON.parse(c));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }, [clients, hydrated]);

  function persistUser(u: SessionUser | null) {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  }

  const value: AuthCtx = {
    user,
    hydrated,
    clients,
    login(email, password) {
      const e = email.trim().toLowerCase();
      if (e === ADMIN.email && password === ADMIN.password) {
        persistUser({ role: "admin", email: ADMIN.email, name: ADMIN.name });
        return { ok: true };
      }
      const c = clients.find((x) => x.email.toLowerCase() === e && x.password === password);
      if (c) {
        persistUser({ role: "client", email: c.email, name: c.name, clientId: c.id });
        return { ok: true };
      }
      return { ok: false, error: "Invalid email or password." };
    },
    logout() {
      persistUser(null);
    },
    addClient(input) {
      const newClient: ClientAccount = {
        id: `c${Date.now()}`,
        name: input.name,
        company: input.company,
        email: input.email,
        password: input.password,
        createdAt: new Date().toISOString().slice(0, 10),
        projects: [],
        finance: {
          income: 0,
          expenses: 0,
          netProfit: 0,
          months: [],
          breakdown: [],
        },
        emails: [],
      };
      setClients((prev) => [newClient, ...prev]);
      return newClient;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
