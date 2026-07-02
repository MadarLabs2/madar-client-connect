export const CRM_TIMEZONE = "Asia/Jerusalem";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = get("hour");
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** Wall-clock time in Jerusalem → UTC Date */
function jerusalemWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const offset = getTimezoneOffsetMs(new Date(guess), CRM_TIMEZONE);
    guess = Date.UTC(y, mo - 1, d, h, mi) - offset;
  }
  return new Date(guess);
}

function jerusalemYmd(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: CRM_TIMEZONE });
}

function addDaysToJerusalemYmd(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const probe = jerusalemWallTimeToUtc(y, mo, d, 12, 0);
  probe.setUTCDate(probe.getUTCDate() + days);
  return jerusalemYmd(probe);
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
  return jerusalemWallTimeToUtc(
    Number(ys),
    Number(ms),
    Number(ds),
    Number(hs),
    Number(mis),
  ).toISOString();
}

/** UTC ISO → datetime-local value in Jerusalem */
export function crmIsoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CRM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** date input (YYYY-MM-DD, Jerusalem) → UTC ISO (noon Jerusalem) */
export function crmDateToIso(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, ys, ms, ds] = match;
  return jerusalemWallTimeToUtc(Number(ys), Number(ms), Number(ds), 12, 0).toISOString();
}

/** UTC ISO → date input in Jerusalem */
export function crmIsoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: CRM_TIMEZONE });
}

export function formatCrmDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: CRM_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatCrmDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: CRM_TIMEZONE });
}

/** Start/end of "today" in Jerusalem, as UTC ISO strings */
export function getJerusalemTodayRangeUtc(): { startIso: string; endIso: string } {
  const ymd = jerusalemYmd();
  const [y, mo, d] = ymd.split("-").map(Number);
  const startIso = jerusalemWallTimeToUtc(y, mo, d, 0, 0).toISOString();
  const tomorrowYmd = addDaysToJerusalemYmd(ymd, 1);
  const [ty, tmo, td] = tomorrowYmd.split("-").map(Number);
  const endIso = jerusalemWallTimeToUtc(ty, tmo, td, 0, 0).toISOString();
  return { startIso, endIso };
}
