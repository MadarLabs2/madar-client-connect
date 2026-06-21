export type SavedEmailTemplate = {
  id: string;
  title: string;
  tag: string;
  subject: string;
  body: string;
  discount: string;
  /** Optional image URL (https) shown on the template card and preview */
  imageUrl?: string | null;
  tint: "green" | "amber" | "brown" | "slate";
};

const STORAGE_KEY = "alnour_admin_email_templates_v1";

export function loadSavedEmailTemplates(): SavedEmailTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSaved);
  } catch {
    return [];
  }
}

function isValidSaved(row: unknown): row is SavedEmailTemplate {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    typeof r.tag === "string" &&
    typeof r.subject === "string" &&
    typeof r.body === "string" &&
    typeof r.discount === "string" &&
    (r.imageUrl === null || r.imageUrl === undefined || typeof r.imageUrl === "string") &&
    typeof r.tint === "string" &&
    ["green", "amber", "brown", "slate"].includes(r.tint as string)
  );
}

export function saveSavedEmailTemplates(templates: SavedEmailTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* quota or private mode */
  }
}
