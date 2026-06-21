import type { useBakeryDb } from "@/lib/bakery/db";
import { formatShortDate, toIsoDate } from "@/lib/bakery/fulfillmentDays";

type BakeryDb = ReturnType<typeof useBakeryDb>;

export type RestDayRow = {
  id: string;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function restDayEndDate(row: RestDayRow): string {
  return row.end_date ?? row.start_date;
}

export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function hasOverlappingRestDay(
  startDate: string,
  endDate: string,
  existing: RestDayRow[],
  excludeId?: string,
): boolean {
  return existing.some((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (!row.is_active) return false;
    return dateRangesOverlap(startDate, endDate, row.start_date, restDayEndDate(row));
  });
}

export function formatRestDayRange(row: RestDayRow): string {
  const end = restDayEndDate(row);
  if (end === row.start_date) {
    const parts = row.start_date.split("-").map(Number);
    if (parts.length !== 3) return row.start_date;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return formatShortDate(d);
  }
  const sp = row.start_date.split("-").map(Number);
  const ep = end.split("-").map(Number);
  if (sp.length !== 3 || ep.length !== 3) return `${row.start_date} – ${end}`;
  const sd = new Date(sp[0], sp[1] - 1, sp[2]);
  const ed = new Date(ep[0], ep[1] - 1, ep[2]);
  return `${formatShortDate(sd)} – ${formatShortDate(ed)}`;
}

function normalize(row: Record<string, unknown>): RestDayRow {
  return {
    id: String(row.id ?? ""),
    start_date: String(row.start_date ?? row.starts_at ?? "").slice(0, 10),
    end_date: row.end_date
      ? String(row.end_date).slice(0, 10)
      : row.ends_at
        ? String(row.ends_at).slice(0, 10)
        : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    is_active: row.is_active !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function fetchAdminRestDays(
  db: BakeryDb,
): Promise<{ ok: true; rows: RestDayRow[] } | { ok: false; message: string }> {
  const today = toIsoDate(new Date());
  const { data, error } = await db
    .from("bakery_rest_days")
    .select("id, start_date, end_date, reason, is_active, created_at, updated_at")
    .order("start_date", { ascending: true })
    .limit(300);
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? [])
    .map((row) => normalize(row as Record<string, unknown>))
    .filter((r) => restDayEndDate(r) >= today);
  return { ok: true, rows };
}

export async function createRestDay(
  db: BakeryDb,
  input: {
    startDate: string;
    endDate: string | null;
    reason: string | null;
  },
): Promise<{ ok: true; row: RestDayRow } | { ok: false; message: string }> {
  const end = input.endDate?.trim() || null;
  if (end && end < input.startDate) {
    return { ok: false, message: "END_BEFORE_START" };
  }

  const existing = await fetchAdminRestDays(db);
  if (!existing.ok) return existing;
  if (hasOverlappingRestDay(input.startDate, end ?? input.startDate, existing.rows)) {
    return { ok: false, message: "OVERLAP" };
  }

  try {
    await db.from("bakery_rest_days").insert({
      start_date: input.startDate,
      end_date: end,
      reason: input.reason?.trim() || null,
      is_active: true,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  const refreshed = await fetchAdminRestDays(db);
  if (!refreshed.ok) return refreshed;
  const row = refreshed.rows.find((r) => r.start_date === input.startDate);
  if (!row) return { ok: false, message: "INSERT_FAILED" };
  return { ok: true, row };
}

export async function deleteRestDay(
  db: BakeryDb,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await db.from("bakery_rest_days").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateRestDayStatus(
  db: BakeryDb,
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await db.from("bakery_rest_days").update({ is_active: isActive }).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
