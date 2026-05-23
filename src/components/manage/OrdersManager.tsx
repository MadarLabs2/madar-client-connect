import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  projectList,
  projectUpdate,
  projectDelete,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Eye, Trash2 } from "lucide-react";

const ORDER_STATUSES = [
  "received",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const STATUS_LABELS: Record<string, string> = {
  received: "התקבלה",
  processing: "בטיפול",
  shipped: "נשלחה",
  delivered: "נמסרה",
  cancelled: "בוטלה",
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  status: string;
  total: number;
  subtotal?: number;
  shipping_fee?: number;
  discount_amount?: number;
  coupon_code?: string;
  shipping_method?: string;
  shipping_address?: any;
  order_items?: any[];
  created_at: string;
};

export function OrdersManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [statusDraft, setStatusDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "orders"],
    queryFn: () => listFn({ data: { projectId, table: "orders", limit: 500 } }),
  });

  const orders: OrderRow[] = useMemo(() => {
    const rows: any[] = data?.rows ?? [];
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      order_number: String(r.order_number ?? r.id ?? ""),
      customer_name: String(r.customer_name ?? ""),
      customer_email: String(r.customer_email ?? ""),
      customer_phone: r.customer_phone ?? "",
      status: String(r.status ?? "received"),
      total: Number(r.total ?? 0),
      subtotal: Number(r.subtotal ?? 0),
      shipping_fee: Number(r.shipping_fee ?? 0),
      discount_amount: Number(r.discount_amount ?? 0),
      coupon_code: r.coupon_code ?? "",
      shipping_method: r.shipping_method ?? "",
      shipping_address: r.shipping_address ?? null,
      order_items: Array.isArray(r.order_items) ? r.order_items : [],
      created_at: String(r.created_at ?? ""),
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.coupon_code?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orders, query, statusFilter]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, "orders"] });

  const openOrder = (o: OrderRow) => {
    setSelected(o);
    setStatusDraft(o.status);
  };

  const saveStatus = async () => {
    if (!selected || statusDraft === selected.status) return;
    setSaving(true);
    try {
      await updateFn({
        data: { projectId, table: "orders", id: selected.id, row: { status: statusDraft } },
      });
      toast.success("הסטטוס עודכן");
      setSelected({ ...selected, status: statusDraft });
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "עדכון נכשל");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את ההזמנה?")) return;
    try {
      await deleteFn({ data: { projectId, table: "orders", id } });
      toast.success("נמחק");
      if (selected?.id === id) setSelected(null);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "מחיקה נכשלה");
    }
  };

  const addressFields = useMemo(() => {
    const a = selected?.shipping_address;
    if (!a || typeof a !== "object" || Array.isArray(a)) return [];
    const pick = (k: string) => (typeof a[k] === "string" ? a[k].trim() : "");
    const fields = [
      ["עיר", pick("city")],
      ["רחוב", pick("street")],
      ["מספר בית", pick("house_number")],
      ["מספר דירה", pick("apartment_number")],
      ["הערות משלוח", pick("delivery_notes")],
      ["כתובת", pick("address") || pick("line1")],
      ["מיקוד", pick("postal_code") || pick("zip")],
    ] as const;
    return fields.filter(([, v]) => v);
  }, [selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">הזמנות</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש…"
              className="w-56 pr-7"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">טוען…</div>
        ) : data?.error ? (
          <div className="p-6 text-sm">
            <div className="font-medium">לא ניתן לטעון את הטבלה</div>
            <div className="mt-1 text-muted-foreground">{data.error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">לא נמצאו הזמנות.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">מס' הזמנה</th>
                  <th className="px-3 py-2 text-right font-medium">לקוח</th>
                  <th className="px-3 py-2 text-right font-medium">תאריך</th>
                  <th className="px-3 py-2 text-right font-medium">סה״כ</th>
                  <th className="px-3 py-2 text-right font-medium">סטטוס</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-right font-mono text-xs">{o.order_number}</td>
                    <td className="px-3 py-2 text-right">
                      <div>{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">₪{o.total}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openOrder(o)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(o.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              הזמנה {selected?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              {/* Status update */}
              <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-xs text-muted-foreground">סטטוס</Label>
                  <Select value={statusDraft} onValueChange={setStatusDraft}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                      {!ORDER_STATUSES.includes(selected.status as any) && (
                        <SelectItem value={selected.status}>{selected.status}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={saveStatus}
                  disabled={saving || statusDraft === selected.status}
                >
                  {saving ? "שומר…" : "עדכון סטטוס"}
                </Button>
              </div>

              {/* Customer */}
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="p-3 text-sm">
                  <div className="mb-1 text-xs uppercase text-muted-foreground">לקוח</div>
                  <div className="font-medium">{selected.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{selected.customer_email}</div>
                  {selected.customer_phone && (
                    <div className="text-xs text-muted-foreground">{selected.customer_phone}</div>
                  )}
                </Card>
                <Card className="p-3 text-sm">
                  <div className="mb-1 text-xs uppercase text-muted-foreground">משלוח</div>
                  <div>{selected.shipping_method || "—"}</div>
                  {addressFields.length > 0 && (
                    <div className="mt-2 space-y-0.5 text-xs">
                      {addressFields.map(([label, value]) => (
                        <div key={label}>
                          <span className="text-muted-foreground">{label}: </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Items */}
              {selected.order_items && selected.order_items.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="border-b bg-muted/30 px-3 py-2 text-xs uppercase text-muted-foreground">
                    פריטים
                  </div>
                  <div className="divide-y">
                    {selected.order_items.map((it: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {it.image_url && (
                          <img
                            src={it.image_url}
                            alt={it.product_name || ""}
                            className="h-12 w-10 shrink-0 object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div>{it.product_name || it.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {[it.color, it.size].filter(Boolean).join(" / ")} × {it.quantity ?? 1}
                          </div>
                        </div>
                        <div className="text-sm">
                          ₪{Number(it.unit_price ?? it.price ?? 0) * Number(it.quantity ?? 1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Totals */}
              <Card className="p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">סכום ביניים</span>
                  <span>₪{selected.subtotal ?? 0}</span>
                </div>
                {selected.coupon_code && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">קופון</span>
                    <span className="font-mono text-xs">{selected.coupon_code}</span>
                  </div>
                )}
                {Number(selected.discount_amount) > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">הנחה</span>
                    <span>−₪{selected.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">משלוח</span>
                  <span>₪{selected.shipping_fee ?? 0}</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                  <span>סה״כ</span>
                  <span>₪{selected.total}</span>
                </div>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              סגירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
