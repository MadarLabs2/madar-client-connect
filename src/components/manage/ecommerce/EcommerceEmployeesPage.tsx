import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Calendar,
  Clock,
  Download,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEcommerceTheme } from "@/lib/ecommerce/EcommerceThemeContext";
import { useEcommerceT } from "@/lib/ecommerce/i18n";
import {
  projectList,
  projectInsert,
  projectUpdate,
  projectDelete,
} from "@/lib/project-db.functions";

/* ---------- types ---------- */
type Employee = {
  id: string;
  employee_number: string;
  name: string;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  created_at: string;
};

const DAYS_HE = [
  "empSunday",
  "empMonday",
  "empTuesday",
  "empWednesday",
  "empThursday",
  "empFriday",
  "empSaturday",
];

const MANAGE_PASSWORD = "heba11051105"; // will be changed by the user later

/* ---------- helpers ---------- */
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtDateInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function hoursWorked(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function fmtHours(h: number) {
  if (h <= 0) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, "0")}`;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("he-IL", { year: "numeric", month: "long" });
}

/* ---------- PDF generation (plain) ---------- */
function generateAttendancePdf(
  employee: Employee,
  records: AttendanceRow[],
  t: (k: string, v?: Record<string, string>) => string,
  totalDays: number,
  totalHours: number,
) {
  const lines: string[] = [];
  lines.push(`${t("empDetails")}: ${employee.name} (${employee.employee_number})`);
  lines.push("");
  lines.push(
    [t("empDate"), t("empDay"), t("empClockInTime"), t("empClockOutTime"), t("empHours")]
      .join("  |  "),
  );
  lines.push("—".repeat(80));
  for (const r of records) {
    const d = new Date(r.clock_in);
    const day = t(DAYS_HE[d.getDay()]);
    const hrs = hoursWorked(r.clock_in, r.clock_out);
    lines.push(
      [fmtDate(r.clock_in), day, fmtTime(r.clock_in), fmtTime(r.clock_out), hrs > 0 ? fmtHours(hrs) : "—"]
        .join("  |  "),
    );
  }
  lines.push("—".repeat(80));
  lines.push(`${t("empTotalDays")}: ${totalDays}`);
  lines.push(`${t("empTotalHours")}: ${fmtHours(totalHours)}`);

  const content = lines.join("\n");

  // Build minimal PDF manually
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(content);
  const streamLines = content.split("\n");

  // Use a simple text/plain download wrapped as PDF-like text file
  // For a real PDF we'd need a library; use a clean text file instead
  const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${employee.employee_number}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ========== Main component ========== */
const dialogClass =
  "gap-4 overflow-hidden border-border/70 bg-background p-5 shadow-xl sm:rounded-2xl [&>button]:end-4 [&>button]:start-auto [&>button]:top-4";

export function EcommerceEmployeesPage({ projectId }: { projectId: string }) {
  const { t } = useEcommerceT();
  const { themeStyle } = useEcommerceTheme();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);

  /* state */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);

  // Clock in/out flow
  const [clockMode, setClockMode] = useState<"in" | "out" | null>(null);
  const [clockNumber, setClockNumber] = useState("");
  const [clockBusy, setClockBusy] = useState(false);

  // Manage dialog
  const [manageOpen, setManageOpen] = useState(false);
  const [manageAuth, setManageAuth] = useState(false);
  const [managePassword, setManagePassword] = useState("");

  // Employee form
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({ name: "", employee_number: "" });

  // Employee details
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [monthFilter, setMonthFilter] = useState("all");

  // Edit attendance
  const [editAttOpen, setEditAttOpen] = useState(false);
  const [editAttRecord, setEditAttRecord] = useState<AttendanceRow | null>(null);
  const [editAttDate, setEditAttDate] = useState("");
  const [editAttIn, setEditAttIn] = useState("");
  const [editAttOut, setEditAttOut] = useState("");

  /* ---------- load ---------- */
  const loadEmployees = useCallback(async () => {
    try {
      const res = await listFn({
        data: { projectId, table: "employees", select: "*", limit: 500, orderColumn: "name", orderAscending: true },
      });
      setEmployees(((res.rows ?? []) as unknown as Employee[]).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      /* ignore */
    }
  }, [listFn, projectId]);

  const loadAttendance = useCallback(async () => {
    try {
      const res = await listFn({
        data: { projectId, table: "attendance", select: "*", limit: 500, orderColumn: "clock_in", orderAscending: false },
      });
      setAttendance((res.rows ?? []) as unknown as AttendanceRow[]);
    } catch {
      /* ignore */
    }
  }, [listFn, projectId]);

  useEffect(() => {
    void loadEmployees();
    void loadAttendance();
  }, [loadEmployees, loadAttendance]);

  /* ---------- clock in/out ---------- */
  const handleClock = async () => {
    if (!clockNumber.trim()) return;
    const emp = employees.find((e) => e.employee_number === clockNumber.trim());
    if (!emp) {
      toast.error(t("empNotFound"));
      return;
    }
    setClockBusy(true);
    try {
      if (clockMode === "in") {
        const open = attendance.find((a) => a.employee_id === emp.id && !a.clock_out);
        if (open) {
          toast.error(t("empAlreadyIn"));
          return;
        }
        await insertFn({
          data: {
            projectId,
            table: "attendance",
            row: { employee_id: emp.id, clock_in: new Date().toISOString() },
          },
        });
        toast.success(t("empClockInSuccess", { name: emp.name }));
      } else {
        const open = attendance.find((a) => a.employee_id === emp.id && !a.clock_out);
        if (!open) {
          toast.error(t("empNoOpenShift"));
          return;
        }
        await updateFn({
          data: {
            projectId,
            table: "attendance",
            id: open.id,
            row: { clock_out: new Date().toISOString() },
          },
        });
        toast.success(t("empClockOutSuccess", { name: emp.name }));
      }
      setClockNumber("");
      setClockMode(null);
      await loadAttendance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setClockBusy(false);
    }
  };

  /* ---------- manage auth ---------- */
  const checkPassword = () => {
    if (managePassword === MANAGE_PASSWORD) {
      setManageAuth(true);
      setManagePassword("");
    } else {
      toast.error(t("empWrongPassword"));
    }
  };

  const openManage = () => {
    setManageOpen(true);
    setManageAuth(false);
    setManagePassword("");
    setEditEmp(null);
    setDetailEmp(null);
    setEditAttOpen(false);
  };

  /* ---------- employee CRUD ---------- */
  const saveEmployee = async () => {
    if (!empForm.name.trim() || !empForm.employee_number.trim()) {
      toast.error(t("empFillFields"));
      return;
    }
    const dup = employees.find(
      (e) => e.employee_number === empForm.employee_number.trim() && e.id !== editEmp?.id,
    );
    if (dup) {
      toast.error(t("empNumberExists"));
      return;
    }
    try {
      if (editEmp) {
        await updateFn({
          data: {
            projectId,
            table: "employees",
            id: editEmp.id,
            row: {
              name: empForm.name.trim(),
              employee_number: empForm.employee_number.trim(),
              updated_at: new Date().toISOString(),
            },
          },
        });
      } else {
        await insertFn({
          data: {
            projectId,
            table: "employees",
            row: {
              name: empForm.name.trim(),
              employee_number: empForm.employee_number.trim(),
            },
          },
        });
      }
      toast.success(t("empSaved"));
      setEditEmp(null);
      setEmpForm({ name: "", employee_number: "" });
      await loadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    }
  };

  const deleteEmployee = async (emp: Employee) => {
    if (!window.confirm(t("empDeleteConfirm"))) return;
    try {
      await deleteFn({ data: { projectId, table: "employees", id: emp.id } });
      toast.success(t("empDeleted"));
      await Promise.all([loadEmployees(), loadAttendance()]);
      if (detailEmp?.id === emp.id) setDetailEmp(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    }
  };

  /* ---------- attendance edit ---------- */
  const openEditRecord = (record: AttendanceRow | null, empId?: string) => {
    setEditAttOpen(true);
    if (record) {
      setEditAttRecord(record);
      setEditAttDate(fmtDateInput(record.clock_in));
      setEditAttIn(fmtTimeInput(record.clock_in));
      setEditAttOut(record.clock_out ? fmtTimeInput(record.clock_out) : "");
    } else {
      setEditAttRecord(null);
      const now = new Date();
      setEditAttDate(fmtDateInput(now.toISOString()));
      setEditAttIn(fmtTimeInput(now.toISOString()));
      setEditAttOut("");
    }
  };

  const saveAttendanceRecord = async () => {
    if (!editAttDate || !editAttIn) return;
    const empId = detailEmp?.id;
    if (!empId) return;
    const clockInISO = new Date(`${editAttDate}T${editAttIn}:00`).toISOString();
    const clockOutISO = editAttOut ? new Date(`${editAttDate}T${editAttOut}:00`).toISOString() : null;
    try {
      if (editAttRecord) {
        await updateFn({
          data: {
            projectId,
            table: "attendance",
            id: editAttRecord.id,
            row: { clock_in: clockInISO, clock_out: clockOutISO },
          },
        });
      } else {
        await insertFn({
          data: {
            projectId,
            table: "attendance",
            row: { employee_id: empId, clock_in: clockInISO, clock_out: clockOutISO },
          },
        });
      }
      toast.success(t("empRecordSaved"));
      setEditAttOpen(false);
      setEditAttRecord(null);
      await loadAttendance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    }
  };

  const deleteAttendanceRecord = async (rec: AttendanceRow) => {
    if (!window.confirm(t("empDeleteRecordConfirm"))) return;
    try {
      await deleteFn({ data: { projectId, table: "attendance", id: rec.id } });
      toast.success(t("empRecordDeleted"));
      await loadAttendance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    }
  };

  /* ---------- derived for details ---------- */
  const detailRecords = useMemo(() => {
    if (!detailEmp) return [];
    let recs = attendance
      .filter((a) => a.employee_id === detailEmp.id)
      .sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime());
    if (monthFilter !== "all") {
      recs = recs.filter((r) => monthKey(r.clock_in) === monthFilter);
    }
    return recs;
  }, [attendance, detailEmp, monthFilter]);

  const detailMonths = useMemo(() => {
    if (!detailEmp) return [];
    const keys = new Set(
      attendance.filter((a) => a.employee_id === detailEmp.id).map((a) => monthKey(a.clock_in)),
    );
    return Array.from(keys).sort().reverse();
  }, [attendance, detailEmp]);

  const detailTotalDays = useMemo(() => {
    const days = new Set(detailRecords.map((r) => fmtDate(r.clock_in)));
    return days.size;
  }, [detailRecords]);

  const detailTotalHours = useMemo(
    () => detailRecords.reduce((s, r) => s + hoursWorked(r.clock_in, r.clock_out), 0),
    [detailRecords],
  );

  /* ========== RENDER ========== */

  // ---------- Employee details view (inside manage dialog) ----------
  if (manageOpen && manageAuth && detailEmp) {
    return (
      <Dialog open onOpenChange={() => { setDetailEmp(null); }}>
        <DialogContent
          style={themeStyle}
          overlayClassName="bg-black/50 backdrop-blur-[1px]"
          className={cn(dialogClass, "max-h-[90vh] max-w-2xl overflow-y-auto")}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <button type="button" onClick={() => setDetailEmp(null)} className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="h-5 w-5" />
              </button>
              {detailEmp.name} — {detailEmp.employee_number}
            </DialogTitle>
            <DialogDescription>{t("empWorkLog")}</DialogDescription>
          </DialogHeader>

          {/* Month filter + totals */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("empMonthFilter")} />
              </SelectTrigger>
              <SelectContent style={themeStyle}>
                <SelectItem value="all">{t("empAllMonths")}</SelectItem>
                {detailMonths.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {t("empTotalDays")}: <strong>{detailTotalDays}</strong>
            </span>
            <span className="text-sm text-muted-foreground">
              {t("empTotalHours")}: <strong>{fmtHours(detailTotalHours)}</strong>
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditRecord(null)}
            >
              <Plus className="me-1 h-3.5 w-3.5" /> {t("empAddRecord")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                generateAttendancePdf(detailEmp, detailRecords, t, detailTotalDays, detailTotalHours)
              }
            >
              <Download className="me-1 h-3.5 w-3.5" /> {t("empDownloadPdf")}
            </Button>
          </div>

          {/* Table */}
          {detailRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("empNoRecords")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-2 py-2 text-start">{t("empDate")}</th>
                    <th className="px-2 py-2 text-start">{t("empDay")}</th>
                    <th className="px-2 py-2 text-start">{t("empClockInTime")}</th>
                    <th className="px-2 py-2 text-start">{t("empClockOutTime")}</th>
                    <th className="px-2 py-2 text-start">{t("empHours")}</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {detailRecords.map((r) => {
                    const d = new Date(r.clock_in);
                    const hrs = hoursWorked(r.clock_in, r.clock_out);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-2 py-2">{fmtDate(r.clock_in)}</td>
                        <td className="px-2 py-2">{t(DAYS_HE[d.getDay()])}</td>
                        <td className="px-2 py-2" dir="ltr">{fmtTime(r.clock_in)}</td>
                        <td className="px-2 py-2" dir="ltr">
                          {r.clock_out ? fmtTime(r.clock_out) : (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                              {t("empOpenShift")}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 tabular-nums" dir="ltr">{hrs > 0 ? fmtHours(hrs) : "—"}</td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditRecord(r)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-600 hover:text-red-700"
                              onClick={() => void deleteAttendanceRecord(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit attendance record dialog */}
          <Dialog open={editAttOpen} onOpenChange={setEditAttOpen}>
            <DialogContent
              style={themeStyle}
              overlayClassName="bg-black/50 backdrop-blur-[1px]"
              className={cn(dialogClass, "max-w-sm")}
            >
              <DialogHeader>
                <DialogTitle>{editAttRecord ? t("empEditRecord") : t("empAddRecord")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("empDate")}</label>
                  <Input type="date" value={editAttDate} onChange={(e) => setEditAttDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("empClockInTime")}</label>
                  <Input type="time" value={editAttIn} onChange={(e) => setEditAttIn(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("empClockOutTime")}</label>
                  <Input type="time" value={editAttOut} onChange={(e) => setEditAttOut(e.target.value)} dir="ltr" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => void saveAttendanceRecord()}>
                    {t("save")}
                  </Button>
                  <Button variant="outline" onClick={() => setEditAttOpen(false)}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-border/60 pb-6">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("tab.employees")}
        </p>
        <h1 className="mt-3 font-display text-2xl font-medium tracking-tight sm:text-3xl">
          {t("empPageTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("empPageSubtitle")}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => { setClockMode("in"); setClockNumber(""); }}
          className={cn(
            "rounded-2xl border p-4 text-center shadow-sm transition-all sm:p-7",
            clockMode === "in"
              ? "border-primary bg-primary text-primary-foreground shadow-md"
              : "border-border/70 bg-background text-foreground hover:border-primary/40 hover:shadow-md",
          )}
        >
          <div
            className={cn(
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14",
              clockMode === "in" ? "bg-primary-foreground/15" : "bg-primary/10",
            )}
          >
            <LogIn
              className={cn(
                "h-6 w-6 sm:h-7 sm:w-7",
                clockMode === "in" ? "text-primary-foreground" : "text-primary",
              )}
            />
          </div>
          <span className="mt-3 block text-base font-semibold sm:text-lg">{t("empClockIn")}</span>
        </button>
        <button
          type="button"
          onClick={() => { setClockMode("out"); setClockNumber(""); }}
          className={cn(
            "rounded-2xl border p-4 text-center shadow-sm transition-all sm:p-7",
            clockMode === "out"
              ? "border-primary bg-primary text-primary-foreground shadow-md"
              : "border-border/70 bg-background text-foreground hover:border-primary/40 hover:shadow-md",
          )}
        >
          <div
            className={cn(
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14",
              clockMode === "out" ? "bg-primary-foreground/15" : "bg-primary/10",
            )}
          >
            <LogOut
              className={cn(
                "h-6 w-6 sm:h-7 sm:w-7",
                clockMode === "out" ? "text-primary-foreground" : "text-primary",
              )}
            />
          </div>
          <span className="mt-3 block text-base font-semibold sm:text-lg">{t("empClockOut")}</span>
        </button>
      </div>

      {clockMode && (
        <Card className="mx-auto max-w-md space-y-4 border-border/70 p-5 shadow-sm">
          <p className="text-center text-sm font-medium">{t("empEnterNumber")}</p>
          <Input
            autoFocus
            type="text"
            inputMode="numeric"
            value={clockNumber}
            onChange={(e) => setClockNumber(e.target.value)}
            placeholder={t("empNumber")}
            className="h-11 text-center text-lg"
            dir="ltr"
            onKeyDown={(e) => e.key === "Enter" && void handleClock()}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={clockBusy || !clockNumber.trim()}
              onClick={() => void handleClock()}
            >
              {clockMode === "in" ? t("empConfirmClockIn") : t("empConfirmClockOut")}
            </Button>
            <Button variant="outline" onClick={() => setClockMode(null)}>
              {t("cancel")}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={openManage}
          className="gap-2 border-primary/25 text-primary hover:bg-primary/5 hover:text-primary"
        >
          <UserCog className="h-4 w-4" />
          {t("empManage")}
        </Button>
      </div>

      {/* ========== Manage dialog ========== */}
      <Dialog open={manageOpen} onOpenChange={(v) => { setManageOpen(v); if (!v) { setManageAuth(false); setDetailEmp(null); } }}>
        <DialogContent
          style={themeStyle}
          overlayClassName="bg-black/50 backdrop-blur-[1px]"
          className={cn(dialogClass, "max-h-[90vh] max-w-2xl overflow-y-auto")}
        >
          {!manageAuth ? (
            <>
              <DialogHeader className="space-y-1.5 text-start">
                <DialogTitle className="font-display text-xl tracking-tight">{t("empManage")}</DialogTitle>
                <DialogDescription>{t("empManagePassword")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="password"
                  value={managePassword}
                  onChange={(e) => setManagePassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkPassword()}
                  className="flex-1"
                  autoFocus
                  dir="ltr"
                />
                <Button onClick={checkPassword}>{t("confirm")}</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("empManage")}
                </DialogTitle>
              </DialogHeader>

              {/* Add / edit employee form */}
              <Card className="space-y-3 p-4">
                <p className="text-sm font-semibold">
                  {editEmp ? t("empEditEmployee") : t("empAddEmployee")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder={t("empName")}
                    value={empForm.name}
                    onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    placeholder={t("empNumber")}
                    value={empForm.employee_number}
                    onChange={(e) => setEmpForm({ ...empForm, employee_number: e.target.value })}
                    className="w-36"
                    dir="ltr"
                  />
                  <Button onClick={() => void saveEmployee()}>
                    {editEmp ? t("save") : t("add")}
                  </Button>
                  {editEmp && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditEmp(null);
                        setEmpForm({ name: "", employee_number: "" });
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  )}
                </div>
              </Card>

              {/* Employee list */}
              {employees.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-col text-start"
                        onClick={() => {
                          setDetailEmp(emp);
                          setMonthFilter("all");
                        }}
                      >
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          #{emp.employee_number}
                        </span>
                      </button>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditEmp(emp);
                            setEmpForm({ name: emp.name, employee_number: emp.employee_number });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => void deleteEmployee(emp)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
