import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  projectList,
  projectUpdate,
  projectDelete,
  ecommerceOrdersList,
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
import { Search, Eye, Trash2, Ban, CheckCircle2, ShoppingCart } from "lucide-react";
import { formatEcommerceDateTime, formatEcommerceNumber, useEcommerceT } from "@/lib/ecommerce/i18n";

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
  order_count: number;
};

export function CustomersManager({ projectId }: { projectId: string }) {
  const { t, lang } = useEcommerceT();
  const formatCount = (n: number) => formatEcommerceNumber(n, lang);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(projectList);
  const ordersListFn = useServerFn(ecommerceOrdersList);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profilesRes, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "profiles"],
    queryFn: () => listFn({ data: { projectId, table: "profiles", limit: 500 } }),
  });

  const { data: ordersRes } = useQuery({
    queryKey: ["ecommerce", projectId, "orders", "all"],
    queryFn: () => ordersListFn({ data: { projectId, limit: 500 } }),
  });

  const customers: CustomerRow[] = useMemo(() => {
    const rows: any[] = profilesRes?.rows ?? [];
    const orders: any[] = ordersRes?.rows ?? [];
    const counts = new Map<string, number>();
    for (const o of orders) {
      const uid = String(o.user_id ?? "");
      const email = String(o.customer_email ?? "").trim().toLowerCase();
      if (uid) counts.set(uid, (counts.get(uid) ?? 0) + 1);
      if (email) counts.set(`email:${email}`, (counts.get(`email:${email}`) ?? 0) + 1);
    }
    return rows.map((r) => {
      const id = String(r.id ?? "");
      const email = String(r.email ?? "").trim().toLowerCase();
      const byUser = counts.get(id) ?? 0;
      const byEmail = email ? counts.get(`email:${email}`) ?? 0 : 0;
      return {
        id,
        full_name: String(r.full_name ?? r.name ?? ""),
        email: String(r.email ?? ""),
        phone: String(r.phone ?? ""),
        role: String(r.role ?? "customer"),
        is_blocked: Boolean(r.is_blocked),
        created_at: String(r.created_at ?? ""),
        order_count: Math.max(byUser, byEmail),
      };
    });
  }, [profilesRes, ordersRes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, "profiles"] });

  const open = (c: CustomerRow) => {
    setSelected(c);
    setFullName(c.full_name);
    setPhone(c.phone);
  };

  const onSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          projectId,
          table: "profiles",
          id: selected.id,
          row: { full_name: fullName, phone },
        },
      });
      toast.success(t("saved"));
      setSelected({ ...selected, full_name: fullName, phone });
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || t("loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = async () => {
    if (!selected) return;
    const next = !selected.is_blocked;
    try {
      await updateFn({
        data: {
          projectId,
          table: "profiles",
          id: selected.id,
          row: { is_blocked: next },
        },
      });
      toast.success(next ? t("blockSuccess") : t("unblockSuccess"));
      setSelected({ ...selected, is_blocked: next });
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || t("blockFailed"));
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm(t("customersConfirmDelete"))) return;
    try {
      await deleteFn({ data: { projectId, table: "profiles", id } });
      toast.success(t("deleted"));
      if (selected?.id === id) setSelected(null);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || t("deleteFailed"));
    }
  };

  const isAdmin = selected?.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{t("customersTitle")}</h1>
        <div className="relative">
          <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="w-56 pr-7"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>
        ) : profilesRes?.error ? (
          <div className="p-6 text-sm">
            <div className="font-medium">{t("errorLoadTable")}</div>
            <div className="mt-1 text-muted-foreground">{profilesRes.error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">{t("noCustomers")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">{t("customersName")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("contact")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("role")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("ordersCol")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("statusCol")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-right">
                      <div>{c.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatEcommerceDateTime(c.created_at, lang, { dateStyle: "short" })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-xs">{c.email || "—"}</div>
                      {c.phone && (
                        <div className="text-xs text-muted-foreground">{c.phone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                        {c.role === "admin" ? t("admin") : t("customerRole")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCount(c.order_count)}</td>
                    <td className="px-3 py-2 text-right">
                      {c.is_blocked ? (
                        <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          {t("blocked")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("active")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("ordersCol")}
                          onClick={() =>
                            navigate({
                              to: ".",
                              search: { tab: "orders", userId: c.id },
                              params: { projectId },
                            })
                          }
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => open(c)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(c.id)}>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.full_name || selected?.email || selected?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          {selected?.is_blocked && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t("blockedBanner")}
            </div>
          )}

          {selected && (
            <div className="space-y-4">
              <Card className="p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-xs">{selected.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("email")}</span>
                  <span>{selected.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("role")}</span>
                  <span>{isAdmin ? t("admin") : t("customerRole")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("ordersCol")}</span>
                  <span>{formatCount(selected.order_count)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("joinDate")}</span>
                  <span>{formatEcommerceDateTime(selected.created_at, lang)}</span>
                </div>
              </Card>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("fullName")}</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("customersPhone")}</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <Button onClick={onSave} disabled={saving} className="w-full">
                  {saving ? t("saving") : t("saveChanges")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelected(null);
                    navigate({
                      to: ".",
                      search: { tab: "orders", userId: selected.id },
                      params: { projectId },
                    });
                  }}
                >
                  <ShoppingCart className="ml-1 h-4 w-4" /> {t("viewOrders")}
                </Button>
              </div>

              {isAdmin ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  {t("blockUnavailable")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" onClick={toggleBlock} className="flex-1">
                    {selected.is_blocked ? (
                      <>
                        <CheckCircle2 className="ml-1 h-4 w-4" /> {t("unblock")}
                      </>
                    ) : (
                      <>
                        <Ban className="ml-1 h-4 w-4" /> {t("blockUser")}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(selected.id)}
                    className="flex-1"
                  >
                    <Trash2 className="ml-1 h-4 w-4" /> {t("deleteUser")}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
