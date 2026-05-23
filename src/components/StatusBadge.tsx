export type ProjectStatus = "planning" | "in_progress" | "review" | "live" | "paused";

const STATUS_META: Record<ProjectStatus, { label: string; tone: string }> = {
  planning: { label: "Planning", tone: "bg-[oklch(0.94_0.02_75)] text-[oklch(0.4_0.12_75)]" },
  in_progress: { label: "In progress", tone: "bg-[oklch(0.94_0.03_250)] text-[oklch(0.4_0.16_250)]" },
  review: { label: "In review", tone: "bg-[oklch(0.94_0.03_300)] text-[oklch(0.4_0.14_300)]" },
  live: { label: "Live", tone: "bg-[oklch(0.93_0.07_155)] text-[oklch(0.38_0.13_155)]" },
  paused: { label: "Paused", tone: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${m.tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}
