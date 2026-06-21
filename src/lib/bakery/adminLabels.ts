import { bakeryAdminDict } from "@/lib/bakery/admin-i18n";

export function adminOrderStatusPillClass(status: string): string {
  switch (status) {
    case "ready":
      return "bg-emerald-100 text-emerald-800";
    case "preparing":
    case "confirmed":
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "out_for_delivery":
      return "bg-sky-100 text-sky-800";
    case "completed":
      return "bg-zinc-100 text-zinc-700";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export function adminOrderStatusLabel(
  status: string,
  t: (key: keyof typeof bakeryAdminDict) => string,
) {
  const k = `adminOrderStatus_${status}` as keyof typeof bakeryAdminDict;
  return k in bakeryAdminDict ? t(k) : status;
}
