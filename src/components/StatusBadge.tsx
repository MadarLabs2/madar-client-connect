import { useI18n } from "@/lib/i18n";

export type ProjectStatus = "planning" | "in_progress" | "review" | "live" | "paused";

const TONE: Record<ProjectStatus, string> = {
  planning: "bg-[oklch(0.94_0.02_75)] text-[oklch(0.4_0.12_75)]",
  in_progress: "bg-[oklch(0.94_0.03_260)] text-[oklch(0.4_0.16_260)]",
  review: "bg-[oklch(0.94_0.03_300)] text-[oklch(0.4_0.14_300)]",
  live: "bg-[oklch(0.93_0.07_155)] text-[oklch(0.38_0.13_155)]",
  paused: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {t(`status.${status}`)}
    </span>
  );
}
