export const CRM_TIMEZONE = "Asia/Jerusalem";

type JerusalemParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function jerusalemParts(date: Date): JerusalemParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CRM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function jerusalemWallTimeToUtcIso(y: number, mo: number, d: number, h: number, mi: number): string {
  let utc = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const parts = jerusalemParts(new Date(utc));
    const diff =
      Date.UTC(y, mo - 1, d, h, mi) -
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    utc -= diff;
  }
  return new Date(utc).toISOString();
}

/** datetime-local value (Jerusalem wall time) → UTC ISO for timestamptz */
export function crmDatetimeLocalToIso(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();
  if (/Z$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, ys, ms, ds, hs, mis] = match;
  return jerusalemWallTimeToUtcIso(
    Number(ys),
    Number(ms),
    Number(ds),
    Number(hs),
    Number(mis),
  );
}

/** UTC ISO → datetime-local value in Jerusalem */
export function crmIsoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = jerusalemParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatCrmDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: CRM_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Start/end of "today" in Jerusalem, as UTC ISO strings */
export function getJerusalemTodayRangeUtc(): { startIso: string; endIso: string } {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: CRM_TIMEZONE });
  const [y, mo, d] = ymd.split("-").map(Number);
  const startIso = jerusalemWallTimeToUtcIso(y, mo, d, 0, 0);
  const tomorrow = jerusalemParts(new Date(new Date(startIso).getTime() + 36 * 3_600_000));
  const endIso = jerusalemWallTimeToUtcIso(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0);
  return { startIso, endIso };
}
