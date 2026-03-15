export type PlanName = "starter" | "pro" | "business" | "enterprise";

export type SiteStatus = "healthy" | "degraded" | "down" | "pending";

export interface UserDoc {
  userId: string;
  email: string;
  plan: PlanName;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndAt?: string | null;
  trialReminder3dSentAt?: string | null;
  displayName?: string;
  workspaceName?: string;
  billingCompanyName?: string;
  avatarDataUrl?: string | null;
  settings?: {
    monitoring: {
      interval: "5m" | "15m" | "1h" | "6h" | "24h";
      algorithm: "dom" | "text" | "html";
      sslMonitoringEnabled?: boolean;
      domainMonitoringEnabled?: boolean;
      alertOn30Days?: boolean;
      alertOn7Days?: boolean;
      alertOnExpiry?: boolean;
      customHeaders?: string;
      userAgent?: string;
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
  billing?: {
    cycle: "monthly" | "annual";
    status: "active" | "trialing" | "past_due" | "canceled";
    nextBillingAt?: string | null;
    updatedAt?: string;
  };
  createdAt: string;
}

export interface BillingHistoryDoc {
  billingId: string;
  userId: string;
  kind: "plan_change" | "cycle_change" | "manual";
  fromPlan: PlanName;
  toPlan: PlanName;
  fromCycle: "monthly" | "annual";
  toCycle: "monthly" | "annual";
  amount: number | null;
  currency: "JPY";
  description: string;
  status: "scheduled" | "paid" | "failed";
  billedAt: string;
  receiptUrl?: string | null;
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
  ssl_expiry_days?: number | null;
  ssl_expiry_date?: string | null;
  ssl_checked_at?: string | null;
  domain_expiry_days?: number | null;
  domain_expiry_date?: string | null;
  domain_checked_at?: string | null;
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
  type: "uptime" | "rendering" | "links" | "form" | "ssl" | "domain";
  title: string;
  message: string;
  resolved: boolean;
  stage?: "warning_30" | "critical_7" | "expired" | null;
  daysLeft?: number | null;
  expiryDateIso?: string | null;
  createdAt: string;
  resolvedAt?: string;
}

