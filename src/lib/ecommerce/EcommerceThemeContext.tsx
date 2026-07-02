import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { projectList } from "@/lib/project-db.functions";
import {
  ECOMMERCE_ACCENT_PRESETS,
  DEFAULT_ECOMMERCE_ACCENT,
  accentThemeStyle,
  resolveAccentId,
  type EcommerceAccentId,
  type EcommerceAccentPreset,
} from "@/lib/ecommerce/theme";

type EcommerceThemeContextValue = {
  projectId: string;
  accentId: EcommerceAccentId;
  preset: EcommerceAccentPreset;
  themeStyle: CSSProperties;
  isLoading: boolean;
};

const EcommerceThemeContext = createContext<EcommerceThemeContextValue | null>(null);

export function EcommerceThemeProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const listFn = useServerFn(projectList);
  const { data, isLoading } = useQuery({
    queryKey: ["ecommerce", projectId, "theme"],
    queryFn: () => listFn({ data: { projectId, table: "site_settings", limit: 1 } }),
  });

  const row = (data?.rows ?? [])[0] as { admin_accent_preset?: string } | undefined;
  const accentId = resolveAccentId(projectId, row?.admin_accent_preset);
  const preset = ECOMMERCE_ACCENT_PRESETS[accentId] ?? ECOMMERCE_ACCENT_PRESETS[DEFAULT_ECOMMERCE_ACCENT];

  const value = useMemo(
    () => ({
      projectId,
      accentId,
      preset,
      themeStyle: accentThemeStyle(preset),
      isLoading,
    }),
    [projectId, accentId, preset, isLoading],
  );

  return (
    <EcommerceThemeContext.Provider value={value}>
      <div className="ecommerce-manage min-h-full" style={value.themeStyle}>
        {children}
      </div>
    </EcommerceThemeContext.Provider>
  );
}

export function useEcommerceTheme() {
  const ctx = useContext(EcommerceThemeContext);
  if (!ctx) {
    throw new Error("useEcommerceTheme must be used within EcommerceThemeProvider");
  }
  return ctx;
}
