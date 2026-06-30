import type { useBakeryDb } from "@/lib/bakery/db";

type BakeryDb = ReturnType<typeof useBakeryDb>;

export type FulfillmentType = "pickup" | "delivery";

export type FulfillmentDayRow = {
  id: string;
  fulfillment_type: FulfillmentType;
  day_of_week: number;
  enabled: boolean;
};

export type WeekdayAvailability = Record<number, boolean>;

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatShortDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function rowsToWeekdayMap(rows: FulfillmentDayRow[], type: FulfillmentType): WeekdayAvailability {
  const map: WeekdayAvailability = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
  for (const row of rows) {
    if (row.fulfillment_type === type) {
      map[row.day_of_week] = row.enabled;
    }
  }
  return map;
}

export function enabledDaysFromMap(map: WeekdayAvailability): number[] {
  return Object.entries(map)
    .filter(([, enabled]) => enabled)
    .map(([dow]) => Number.parseInt(dow, 10));
}

export type ScheduleDateOption = {
  isoDate: string;
  label: string;
  isOpen: boolean;
};

type RestDayForSchedule = {
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};

function scheduleRestDayEnd(row: RestDayForSchedule): string {
  return row.end_date ?? row.start_date;
}

function isDateClosedByRestDays(isoDate: string, restDays: RestDayForSchedule[]): boolean {
  return restDays.some(
    (row) =>
      row.is_active && isoDate >= row.start_date && isoDate <= scheduleRestDayEnd(row),
  );
}

export function buildScheduleDateOptions(
  enabledWeekdays: number[],
  weekdayLabel: (dayOfWeek: number) => string,
  restDays: RestDayForSchedule[],
  horizonDays = 14,
): ScheduleDateOption[] {
  const enabled = new Set(enabledWeekdays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const options: ScheduleDateOption[] = [];

  for (let offset = 0; offset < horizonDays; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const dayOfWeek = date.getDay();
    if (!enabled.has(dayOfWeek)) continue;

    const isoDate = toIsoDate(date);
    const weekday = weekdayLabel(dayOfWeek);
    const label = `${weekday}, ${formatShortDate(date)}`;
    options.push({
      isoDate,
      label,
      isOpen: !isDateClosedByRestDays(isoDate, restDays),
    });
  }

  return options;
}

/** Union of open schedule dates from pickup/delivery (deduped, sorted). */
export function mergeOpenScheduleDates(...lists: ScheduleDateOption[]): ScheduleDateOption[] {
  const byIso = new Map<string, ScheduleDateOption>();
  for (const list of lists) {
    for (const option of list) {
      if (!option.isOpen) continue;
      if (!byIso.has(option.isoDate)) byIso.set(option.isoDate, option);
    }
  }
  return [...byIso.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

export function hasAtLeastOneEnabled(map: WeekdayAvailability): boolean {
  return enabledDaysFromMap(map).length > 0;
}

export async function fetchFulfillmentDays(
  db: BakeryDb,
): Promise<{ ok: true; rows: FulfillmentDayRow[] } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("fulfillment_available_days")
    .select("id, fulfillment_type, day_of_week, enabled")
    .order("day_of_week", { ascending: true })
    .limit(50);
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []) as FulfillmentDayRow[] };
}

export async function saveFulfillmentAvailability(
  db: BakeryDb,
  pickup: WeekdayAvailability,
  delivery: WeekdayAvailability,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!hasAtLeastOneEnabled(pickup)) return { ok: false, message: "MIN_ONE_DAY_REQUIRED" };
  if (!hasAtLeastOneEnabled(delivery)) return { ok: false, message: "MIN_ONE_DAY_REQUIRED" };

  const existing = await fetchFulfillmentDays(db);
  if (!existing.ok) return existing;

  const byKey = new Map(
    existing.rows.map((r) => [`${r.fulfillment_type}:${r.day_of_week}`, r] as const),
  );

  for (const fulfillment_type of ["pickup", "delivery"] as const) {
    const map = fulfillment_type === "pickup" ? pickup : delivery;
    for (let day_of_week = 0; day_of_week <= 6; day_of_week++) {
      const enabled = map[day_of_week] ?? false;
      const key = `${fulfillment_type}:${day_of_week}`;
      const row = byKey.get(key);
      if (row?.id) {
        const { error } = await db.from("fulfillment_available_days").update({ enabled }).eq("id", row.id);
        if (error) return { ok: false, message: error.message };
      } else {
        const { error } = await db.from("fulfillment_available_days").insert({
          fulfillment_type,
          day_of_week,
          enabled,
        });
        if (error) return { ok: false, message: error.message };
      }
    }
  }

  return { ok: true };
}
