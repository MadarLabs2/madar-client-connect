import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ExternalLink, Settings2, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: ClientDashboard,
});

const PIE_COLORS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.7 0.15 155)",
  "oklch(0.75 0.15 75)",
  "oklch(0.62 0.2 20)",
  "oklch(0.5 0.15 300)",
];

function ClientDashboard() {
  const { user, clients } = useAuth();
  if (user?.role === "admin") return <Navigate to="/admin" />;
  const client = clients.find((c) => c.id === user?.clientId);
  if (!client) return <Navigate to="/login" />;

  const fin = client.finance;
  const fmt = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {client.company}
        </p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Welcome, {client.name.split(" ")[0]}.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Here's the state of your digital workspace today.
        </p>
      </header>

      {/* Project hub */}
      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight">Project hub</h2>
        {client.projects.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No projects yet.</Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {client.projects.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs capitalize text-muted-foreground">{p.type.replace("_", " ")}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {p.liveUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.liveUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View live
                      </a>
                    </Button>
                  )}
                  {p.cmsUrl && (
                    <Button asChild size="sm">
                      <a href={p.cmsUrl} target="_blank" rel="noreferrer">
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage content
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Finance + Email side by side on desktop */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Finance */}
        <Card className="p-5 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl tracking-tight">Financial overview</h2>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Income" value={fmt(fin.income)} tone="text-[oklch(0.45_0.14_155)]" />
            <Stat label="Expenses" value={fmt(fin.expenses)} tone="text-[oklch(0.5_0.18_20)]" />
            <Stat label="Net profit" value={fmt(fin.netProfit)} tone="text-foreground" />
          </div>

          <div className="mt-6 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fin.months} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.15 155)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.7 0.15 155)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.2 20)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.62 0.2 20)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "oklch(0.5 0.012 250)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "oklch(0.5 0.012 250)" }} width={48} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(1 0 0)",
                    border: "1px solid oklch(0.91 0.006 80)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="income" stroke="oklch(0.55 0.13 155)" fill="url(#gIncome)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="oklch(0.55 0.2 20)" fill="url(#gExp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Where your money goes
              </div>
              <div className="mt-2 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fin.breakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={36}
                      outerRadius={64}
                      paddingAngle={2}
                    >
                      {fin.breakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(1 0 0)",
                        border: "1px solid oklch(0.91 0.006 80)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <ul className="space-y-2 self-center text-sm">
              {fin.breakdown.map((b, i) => (
                <li key={b.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-foreground">{b.name}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{fmt(b.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Email */}
        <Card className="p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-xl tracking-tight">Inbox</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {client.emails.filter((e) => e.unread).length} unread
            </span>
          </div>
          {client.emails.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Connect your business email to see messages here.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {client.emails.map((e) => (
                <li key={e.id} className="cursor-pointer px-5 py-3 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-x-3">
                    {e.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.55_0.18_250)]" />}
                    <span className={`truncate text-sm ${e.unread ? "font-semibold text-foreground" : "text-foreground"}`}>
                      {e.from}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{e.time}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-foreground">{e.subject}</div>
                  <div className="truncate text-xs text-muted-foreground">{e.preview}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-5 py-3">
            <Button size="sm" variant="outline" className="w-full">Connect business email</Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-xl tracking-tight tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
