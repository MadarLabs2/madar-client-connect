export const ECOMMERCE_GUARDED_TABS = new Set(["overview", "reports", "settings"]);

export const DEFAULT_ECOMMERCE_ADMIN_GATE = {
  enabled: true,
  password: "heba11051105",
};

export type EcommerceAdminGate = {
  enabled: boolean;
  password: string;
};

function gateStorageKey(projectId: string) {
  return `ecommerce-admin-gate:${projectId}`;
}

function intentStorageKey(projectId: string) {
  return `ecommerce-admin-intent:${projectId}`;
}

export function readEcommerceAdminGate(projectId: string): EcommerceAdminGate {
  if (typeof window === "undefined") return DEFAULT_ECOMMERCE_ADMIN_GATE;
  try {
    const raw = localStorage.getItem(gateStorageKey(projectId));
    if (!raw) return DEFAULT_ECOMMERCE_ADMIN_GATE;
    const parsed = JSON.parse(raw) as Partial<EcommerceAdminGate>;
    const password = String(parsed.password ?? "").trim();
    return {
      enabled: parsed.enabled !== false,
      password: password || DEFAULT_ECOMMERCE_ADMIN_GATE.password,
    };
  } catch {
    return DEFAULT_ECOMMERCE_ADMIN_GATE;
  }
}

export function writeEcommerceAdminGate(projectId: string, gate: EcommerceAdminGate) {
  try {
    localStorage.setItem(
      gateStorageKey(projectId),
      JSON.stringify({
        enabled: gate.enabled,
        password: gate.password.trim() || DEFAULT_ECOMMERCE_ADMIN_GATE.password,
      }),
    );
  } catch {
    /* private mode */
  }
}

export function gateFromSettingsRow(row: {
  admin_gate_enabled?: boolean | null;
  admin_gate_password?: string | null;
} | null): EcommerceAdminGate | null {
  if (!row || (row.admin_gate_enabled == null && row.admin_gate_password == null)) return null;
  const password = String(row.admin_gate_password ?? "").trim();
  return {
    enabled: row.admin_gate_enabled !== false,
    password: password || DEFAULT_ECOMMERCE_ADMIN_GATE.password,
  };
}

export function markEcommerceGuardedIntent(projectId: string, tab: string) {
  try {
    sessionStorage.setItem(intentStorageKey(projectId), tab);
  } catch {
    /* private mode */
  }
}

export function peekEcommerceGuardedIntent(projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(intentStorageKey(projectId));
  } catch {
    return null;
  }
}

export function clearEcommerceGuardedIntent(projectId: string) {
  try {
    sessionStorage.removeItem(intentStorageKey(projectId));
  } catch {
    /* private mode */
  }
}

function storageKey(projectId: string) {
  return `ecommerce-admin-unlock:${projectId}`;
}

export function isEcommerceAdminUnlocked(projectId: string) {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(storageKey(projectId)) === "1";
  } catch {
    return false;
  }
}

export function unlockEcommerceAdmin(projectId: string) {
  try {
    sessionStorage.setItem(storageKey(projectId), "1");
  } catch {
    /* private mode */
  }
}

export function lockEcommerceAdmin(projectId: string) {
  try {
    sessionStorage.removeItem(storageKey(projectId));
  } catch {
    /* private mode */
  }
}
