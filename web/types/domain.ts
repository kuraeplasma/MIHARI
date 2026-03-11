export type PlanName = "starter" | "pro" | "business" | "enterprise";

export type SiteStatus = "healthy" | "degraded" | "down" | "pending";

export interface UserDoc {
  userId: string;
  email: string;
  plan: PlanName;
  displayName?: string;
  workspaceName?: string;
  settings?: {
    monitoring: {
      interval: "5m" | "15m" | "1h" | "6h" | "24h";
      algorithm: "dom" | "text" | "html";
    };
    notifications: {
      emailEnabled: boolean;
      slackEnabled: boolean;
      slackWebhookUrl?: string;
      notifyOn: "all" | "errors" | "critical";
    };
    ai: {
      autoAnalyze: boolean;
      scope: "full" | "summary";
    };
  };
  createdAt: string;
}

export interface SiteDoc {
  siteId: string;
  userId: string;
  clientId: string | null;
  url: string;
  status: SiteStatus;
  healthScore: number;
  lastCheckedAt: string | null;
  nextCheckAt: string;
  formMonitorEnabled: boolean;
  createdAt: string;
}

export interface ClientDoc {
  clientId: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckJobDoc {
  jobId: string;
  userId: string;
  siteId: string;
  checkTypes: string[];
  status: "queued" | "running" | "success" | "failed";
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CheckResultDoc {
  resultId: string;
  userId: string;
  siteId: string;
  uptime: {
    ok: boolean;
    statusCode: number | null;
    latencyMs: number | null;
  };
  links: {
    ok: boolean;
    brokenCount: number;
    checkedCount: number;
    broken: Array<{ url: string; statusCode: number | null }>;
  };
  form: {
    ok: boolean;
    status: "pass" | "fail" | "not_checked" | "captcha_detected" | "not_found";
    reason?: string;
  };
  rendering: {
    ok: boolean;
    consoleErrors: string[];
  };
  aiAnalysis: {
    cause: string;
    suggestedFix: string;
  } | null;
  overallStatus: SiteStatus;
  createdAt: string;
}

export interface AlertDoc {
  alertId: string;
  userId: string;
  siteId: string;
  severity: "low" | "medium" | "high";
  type: "uptime" | "rendering" | "links" | "form";
  title: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}
