import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";

type BakeryCouponsPageProps = { projectId: string };

type CouponRow = Record<string, unknown> & {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  used_count?: number;
  max_uses?: number | null;
  is_active?: boolean;
};

const empty = {
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  min_order_amount: 0,
  max_uses: null as number | null,
  expires_at: "",
  is_active: true,
};

export function BakeryCouponsPage({ projectId }: BakeryCouponsPageProps) {
  const db = useBakeryDb(projectId);
  const { t } = useBakeryT();
  const [items, setItems] = useState<CouponRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty & Record<string, unknown>>(empty);

  const load = () =>
    db
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setItems((data ?? []) as CouponRow[]);
      });

  useEffect(() => {
    void load();
  }, [projectId]);

  const save = async () => {
    const payload = {
      ...form,
      code: String(form.code).toUpperCase(),
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    };
    try {
      const { error } = await db.from("coupons").insert(payload);
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("genericError"));
      return;
    }
    toast.success(t("created"));
    setOpen(false);
    setForm(empty);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("adminDeleteConfirmCoupon"))) return;
    try {
      const { error } = await db.from("coupons").delete().eq("id", id);
      if (error) throw error;
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("genericError"));
    }
  };

  return (
    <div className="admin-page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="admin-header-enter font-display text-3xl font-bold text-[#1B4332]">
          {t("adminDashCouponsTitle")}
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> {t("adminBtnNewCoupon")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminDialogCouponNewTitle")}</DialogTitle>
              <DialogDescription className="sr-only">{t("adminDialogCouponFormSr")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("adminLabelCode")}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("adminLabelType")}</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v) => setForm({ ...form, discount_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t("adminDiscountTypePercentage")}</SelectItem>
                      <SelectItem value="fixed">{t("adminDiscountTypeFixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("adminLabelValue")}</Label>
                  <Input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("adminLabelMinOrder")}</Label>
                  <Input
                    type="number"
                    value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("adminLabelMaxUses")}</Label>
                  <Input
                    type="number"
                    value={form.max_uses ?? ""}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{t("adminLabelExpiresAt")}</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
              <Button onClick={() => void save()} className="w-full">
                {t("adminCreate")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div
        className="admin-section-enter overflow-hidden rounded-2xl border bg-card"
        style={{ animationDelay: "120ms" }}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">{t("adminThCode")}</th>
              <th>{t("adminThType")}</th>
              <th>{t("adminThValue")}</th>
              <th>{t("adminThMin")}</th>
              <th>{t("adminThUses")}</th>
              <th>{t("adminThStatus")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono">{c.code}</td>
                <td className="capitalize">{c.discount_type}</td>
                <td>
                  {c.discount_type === "percentage"
                    ? `${c.discount_value}%`
                    : `₪${c.discount_value}`}
                </td>
                <td>₪{c.min_order_amount}</td>
                <td>
                  {c.used_count}
                  {c.max_uses ? `/${c.max_uses}` : ""}
                </td>
                <td>{c.is_active ? t("adminActive") : t("adminInactive")}</td>
                <td className="pr-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => void remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
