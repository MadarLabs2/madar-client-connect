import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ecommerceAdminDict } from "@/lib/ecommerce/admin-i18n";
import {
  langStorageKey,
  parseEcommerceLang,
  type EcommerceLang,
} from "@/lib/ecommerce/i18n-utils";

type EcommerceI18nContextValue = {
  projectId: string;
  lang: EcommerceLang;
  dir: "rtl";
  setLang: (lang: EcommerceLang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const EcommerceI18nContext = createContext<EcommerceI18nContextValue | null>(null);

export function EcommerceI18nProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<EcommerceLang>("he");

  useEffect(() => {
    const stored = parseEcommerceLang(localStorage.getItem(langStorageKey(projectId)));
    if (stored) setLangState(stored);
  }, [projectId]);

  const setLang = useCallback(
    (next: EcommerceLang) => {
      setLangState(next);
      try {
        localStorage.setItem(langStorageKey(projectId), next);
      } catch {
        /* ignore */
      }
    },
    [projectId],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = ecommerceAdminDict[key];
      let value = entry ? entry[lang] : key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replaceAll(`{${k}}`, String(v)).replaceAll(`{{${k}}}`, String(v));
        }
      }
      return value;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ projectId, lang, dir: "rtl" as const, setLang, t }),
    [projectId, lang, setLang, t],
  );

  return <EcommerceI18nContext.Provider value={value}>{children}</EcommerceI18nContext.Provider>;
}

export function useEcommerceT() {
  const ctx = useContext(EcommerceI18nContext);
  if (!ctx) throw new Error("useEcommerceT must be used within EcommerceI18nProvider");
  return ctx;
}

export function useEcommerceOrderLabels() {
  const { lang, t } = useEcommerceT();
  return {
    statusLabel: (status: string) => {
      const key = `status.${status}`;
      const entry = ecommerceAdminDict[key];
      return entry ? entry[lang] : status;
    },
    shippingLabel: (method: string) => {
      const key = `shipping.${method}`;
      const entry = ecommerceAdminDict[key];
      return entry ? entry[lang] : method;
    },
    cardcomLabel: (type: string) => {
      const key = `cardcom.${type}`;
      const entry = ecommerceAdminDict[key];
      return entry ? entry[lang] : type;
    },
    t,
    lang,
  };
}
