import { SiteStatus } from "@/types/domain";

const config: Record<SiteStatus, { label: string; cls: string }> = {
  healthy: { label: "正常", cls: "healthy" },
  degraded: { label: "警告", cls: "degraded" },
  down: { label: "エラー", cls: "down" },
  pending: { label: "確認中", cls: "pending" },
};

export function StatusPill({ status }: { status: SiteStatus | string }) {
  const c = config[status as SiteStatus] ?? { label: status, cls: "pending" };
  return <span className={`status-pill ${c.cls}`}>{c.label}</span>;
}
