import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

function randomPassword() {
  return Math.random().toString(36).slice(2, 10);
}

function AdminDashboard() {
  const { user, clients, addClient } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", password: randomPassword() });

  if (user?.role !== "admin") return <Navigate to="/dashboard" />;

  const metrics = useMemo(() => {
    const projects = clients.flatMap((c) => c.projects);
    return {
      clients: clients.length,
      active: projects.filter((p) => p.status === "in_progress" || p.status === "review").length,
      live: projects.filter((p) => p.status === "live" || p.status === "maintenance").length,
      total: projects.length,
    };
  }, [clients]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.company || !form.email || !form.password) {
      toast.error("All fields are required");
      return;
    }
    addClient(form);
    toast.success(`Client created · ${form.email}`);
    setOpen(false);
    setForm({ name: "", company: "", email: "", password: randomPassword() });
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin · Master view
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Client portfolio</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add new client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New client account</DialogTitle>
              <DialogDescription>
                Generate initial login credentials. The client can sign in with the email and password below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="n">Contact name</Label>
                <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c">Company</Label>
                <Input id="c" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="e">Email</Label>
                <Input id="e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p">Temporary password</Label>
                <div className="flex gap-2">
                  <Input id="p" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <Button type="button" variant="outline" onClick={() => setForm({ ...form, password: randomPassword() })}>
                    Regenerate
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create client</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: "Clients", value: metrics.clients },
          { label: "Active projects", value: metrics.active },
          { label: "Live products", value: metrics.live },
          { label: "Total projects", value: metrics.total },
        ].map((m) => (
          <Card key={m.label} className="p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.label}</div>
            <div className="mt-2 font-display text-3xl tracking-tight">{m.value}</div>
          </Card>
        ))}
      </section>

      {/* Clients list */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-tight">All clients</h2>
          <span className="text-sm text-muted-foreground">System status · <span className="text-[oklch(0.45_0.14_155)]">Operational</span></span>
        </div>

        <div className="space-y-3">
          {clients.map((c) => (
            <Card key={c.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="truncate text-base font-semibold text-foreground">{c.company}</span>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="truncate text-sm text-muted-foreground">{c.name}</span>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="truncate text-sm text-muted-foreground">{c.email}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span>Since {c.createdAt}</span>
                  <span className="hidden sm:inline">·</span>
                  <span>{c.projects.length} project{c.projects.length === 1 ? "" : "s"}</span>
                </div>
              </div>
              {c.projects.length === 0 ? (
                <div className="px-5 py-4 text-sm text-muted-foreground">No projects assigned yet.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {c.projects.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs capitalize text-muted-foreground">{p.type.replace("_", " ")}</span>
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        <span>{p.progress}%</span>
                        <span className="hidden sm:inline">·</span>
                        <span>Updated {p.updatedAt}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
