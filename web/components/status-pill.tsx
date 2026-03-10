import { SiteStatus } from "@/types/domain";

const labels: Record<SiteStatus, string> = {
  healthy: "正常",
  degraded: "警告",
  down: "エラー",
  pending: "警告"
};

export function StatusPill({ status }: { status: SiteStatus }) {
  const colorClass = status === "healthy" ? "healthy" : status === "down" ? "error" : "warning";
  return <span className={`status-pill ${colorClass}`}>{labels[status]}</span>;
}
