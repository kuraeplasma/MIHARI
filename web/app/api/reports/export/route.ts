import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/time";
import { SiteDoc, SiteStatus } from "@/types/domain";

export const runtime = "nodejs";

const exportSchema = z.object({
  format: z.enum(["pdf", "csv"]),
  periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  siteIds: z.array(z.string().min(1)).min(1).max(100),
  includeAi: z.boolean().default(true),
  includeHistory: z.boolean().default(true)
});

interface ReportCheckResult {
  siteId?: string;
  createdAt?: string;
  overallStatus?: SiteStatus;
  uptime?: { ok?: boolean; statusCode?: number | null; latencyMs?: number | null };
  links?: { brokenCount?: number; checkedCount?: number };
  form?: { status?: string };
  aiAnalysis?: unknown;
}

interface ReportAlert {
  siteId?: string;
  createdAt?: string;
  resolved?: boolean;
  type?: string;
  title?: string;
  severity?: string;
}

interface SummaryRow {
  siteId: string;
  domain: string;
  url: string;
  latestStatus: string;
  latestHealthScore: number;
  checks: number;
  aiAnalyses: number;
  alerts: number;
  unresolvedAlerts: number;
  lastCheckedAt: string;
}

function toDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toIsoDaysAgo(days: number): string {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

function sanitizeCsvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function buildSimplePdf(lines: string[]): Buffer {
  const header = "%PDF-1.4\n";
  const objects: Record<number, string> = {
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    2: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    4: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  };

  const printableLines = lines.slice(0, 70);
  let content = "BT\n/F1 10 Tf\n48 792 Td\n13 TL\n";
  printableLines.forEach((line, index) => {
    if (index > 0) {
      content += "T*\n";
    }
    content += `(${escapePdfText(line)}) Tj\n`;
  });
  content += "ET";

  objects[5] = `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`;

  let body = "";
  const offsets: number[] = [0];
  for (let i = 1; i <= 5; i += 1) {
    offsets[i] = Buffer.byteLength(header + body, "utf8");
    body += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(header + body, "utf8");
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(header + body + xref + trailer, "utf8");
}

async function listByUser<T>(collectionName: string, userId: string, maxDocs = 5000): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (rows.length < maxDocs) {
    let query = adminDb.collection(collectionName).where("userId", "==", userId).limit(pageSize);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    rows.push(...snapshot.docs.map((doc) => doc.data() as T));

    if (snapshot.size < pageSize) {
      break;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return rows;
}

function buildSummaryRows(params: {
  sites: SiteDoc[];
  selectedSiteIds: Set<string>;
  results: ReportCheckResult[];
  alerts: ReportAlert[];
}): SummaryRow[] {
  const resultsBySite = new Map<string, ReportCheckResult[]>();
  for (const result of params.results) {
    const siteId = result.siteId;
    if (!siteId || !params.selectedSiteIds.has(siteId)) {
      continue;
    }
    const list = resultsBySite.get(siteId) ?? [];
    list.push(result);
    resultsBySite.set(siteId, list);
  }

  for (const [siteId, list] of resultsBySite.entries()) {
    list.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    resultsBySite.set(siteId, list);
  }

  const alertsBySite = new Map<string, ReportAlert[]>();
  for (const alert of params.alerts) {
    const siteId = alert.siteId;
    if (!siteId || !params.selectedSiteIds.has(siteId)) {
      continue;
    }
    const list = alertsBySite.get(siteId) ?? [];
    list.push(alert);
    alertsBySite.set(siteId, list);
  }

  const rows: SummaryRow[] = [];
  for (const site of params.sites) {
    if (!params.selectedSiteIds.has(site.siteId)) {
      continue;
    }

    const siteResults = resultsBySite.get(site.siteId) ?? [];
    const siteAlerts = alertsBySite.get(site.siteId) ?? [];
    const latestResult = siteResults[0];

    rows.push({
      siteId: site.siteId,
      domain: toDomain(site.url),
      url: site.url,
      latestStatus: latestResult?.overallStatus ?? site.status,
      latestHealthScore: site.healthScore ?? 0,
      checks: siteResults.length,
      aiAnalyses: siteResults.filter((r) => r.aiAnalysis !== null && r.aiAnalysis !== undefined).length,
      alerts: siteAlerts.length,
      unresolvedAlerts: siteAlerts.filter((a) => a.resolved !== true).length,
      lastCheckedAt: site.lastCheckedAt ?? ""
    });
  }

  return rows.sort((a, b) => a.domain.localeCompare(b.domain));
}

function buildCsv(params: {
  generatedAt: string;
  periodDays: number;
  includeAi: boolean;
  includeHistory: boolean;
  rows: SummaryRow[];
  results: ReportCheckResult[];
  alerts: ReportAlert[];
  selectedSiteIds: Set<string>;
  siteDomainById: Map<string, string>;
}): string {
  const lines: string[] = [];
  lines.push(["Generated At", params.generatedAt].map(sanitizeCsvCell).join(","));
  lines.push(["Period (days)", params.periodDays].map(sanitizeCsvCell).join(","));
  lines.push(["Include AI", params.includeAi ? "yes" : "no"].map(sanitizeCsvCell).join(","));
  lines.push(["Include History", params.includeHistory ? "yes" : "no"].map(sanitizeCsvCell).join(","));
  lines.push("");

  lines.push(
    [
      "Domain",
      "URL",
      "Latest Status",
      "Health Score",
      "Checks",
      "AI Analyses",
      "Alerts",
      "Unresolved Alerts",
      "Last Checked At"
    ].join(",")
  );

  for (const row of params.rows) {
    lines.push(
      [
        row.domain,
        row.url,
        row.latestStatus,
        row.latestHealthScore,
        row.checks,
        row.aiAnalyses,
        row.alerts,
        row.unresolvedAlerts,
        row.lastCheckedAt
      ]
        .map(sanitizeCsvCell)
        .join(",")
    );
  }

  if (params.includeHistory) {
    lines.push("");
    lines.push("Recent Check History");
    lines.push(["Checked At", "Domain", "Status", "HTTP", "Latency(ms)", "Broken Links", "Form", "Has AI"].join(","));

    const checkRows = params.results
      .filter((r) => r.siteId && params.selectedSiteIds.has(r.siteId))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 300);

    for (const result of checkRows) {
      const domain = params.siteDomainById.get(String(result.siteId)) ?? String(result.siteId ?? "");
      lines.push(
        [
          result.createdAt ?? "",
          domain,
          result.overallStatus ?? "",
          result.uptime?.statusCode ?? "",
          result.uptime?.latencyMs ?? "",
          result.links?.brokenCount ?? "",
          result.form?.status ?? "",
          result.aiAnalysis !== null && result.aiAnalysis !== undefined ? "yes" : "no"
        ]
          .map(sanitizeCsvCell)
          .join(",")
      );
    }

    lines.push("");
    lines.push("Recent Alert History");
    lines.push(["Created At", "Domain", "Type", "Severity", "Resolved", "Title"].join(","));

    const alertRows = params.alerts
      .filter((a) => a.siteId && params.selectedSiteIds.has(a.siteId))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 300);

    for (const alert of alertRows) {
      const domain = params.siteDomainById.get(String(alert.siteId)) ?? String(alert.siteId ?? "");
      lines.push(
        [
          alert.createdAt ?? "",
          domain,
          alert.type ?? "",
          alert.severity ?? "",
          alert.resolved === true ? "yes" : "no",
          alert.title ?? ""
        ]
          .map(sanitizeCsvCell)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}

function buildPdfLines(params: {
  generatedAt: string;
  periodDays: number;
  includeAi: boolean;
  includeHistory: boolean;
  rows: SummaryRow[];
  results: ReportCheckResult[];
  alerts: ReportAlert[];
  selectedSiteIds: Set<string>;
  siteDomainById: Map<string, string>;
}): string[] {
  const lines: string[] = [];
  lines.push("MIHARI Monitoring Report");
  lines.push(`Generated: ${params.generatedAt}`);
  lines.push(`Period(days): ${params.periodDays}`);
  lines.push(`Include AI: ${params.includeAi ? "yes" : "no"}`);
  lines.push(`Include History: ${params.includeHistory ? "yes" : "no"}`);
  lines.push("----------------------------------------");

  for (const row of params.rows.slice(0, 40)) {
    lines.push(
      `${row.domain} | status=${row.latestStatus} | score=${row.latestHealthScore} | checks=${row.checks} | alerts=${row.unresolvedAlerts}`
    );
  }

  if (params.includeHistory) {
    lines.push("----------------------------------------");
    lines.push("Recent Check Events");

    const checkRows = params.results
      .filter((r) => r.siteId && params.selectedSiteIds.has(r.siteId))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 20);

    for (const result of checkRows) {
      const domain = params.siteDomainById.get(String(result.siteId)) ?? String(result.siteId ?? "");
      lines.push(`${result.createdAt ?? ""} | ${domain} | ${result.overallStatus ?? ""}`);
    }

    lines.push("Recent Alert Events");
    const alertRows = params.alerts
      .filter((a) => a.siteId && params.selectedSiteIds.has(a.siteId))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 20);

    for (const alert of alertRows) {
      const domain = params.siteDomainById.get(String(alert.siteId)) ?? String(alert.siteId ?? "");
      lines.push(`${alert.createdAt ?? ""} | ${domain} | ${alert.type ?? ""} | ${alert.title ?? ""}`);
    }
  }

  return lines;
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:reports-export:post");
  if (limited) {
    return limited;
  }

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const decoded = auth.user;
    const payload = exportSchema.parse(await req.json());

    const siteSnapshot = await adminDb.collection("sites").where("userId", "==", decoded.uid).get();
    const userSites = siteSnapshot.docs.map((doc) => doc.data() as SiteDoc);
    const siteById = new Map(userSites.map((site) => [site.siteId, site]));

    const selectedSiteIds = new Set(payload.siteIds.filter((siteId) => siteById.has(siteId)));
    if (selectedSiteIds.size === 0) {
      return NextResponse.json({ error: "No authorized sites selected" }, { status: 400 });
    }

    const sinceIso = toIsoDaysAgo(payload.periodDays);
    const [resultsRaw, alertsRaw] = await Promise.all([
      listByUser<ReportCheckResult>("checkResults", decoded.uid),
      listByUser<ReportAlert>("alerts", decoded.uid)
    ]);

    const results = resultsRaw.filter((row) => typeof row.createdAt === "string" && row.createdAt >= sinceIso);
    const alerts = alertsRaw.filter((row) => typeof row.createdAt === "string" && row.createdAt >= sinceIso);

    const rows = buildSummaryRows({
      sites: userSites,
      selectedSiteIds,
      results,
      alerts
    });

    const generatedAt = nowIso();
    const siteDomainById = new Map<string, string>();
    for (const site of userSites) {
      siteDomainById.set(site.siteId, toDomain(site.url));
    }

    const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");

    if (payload.format === "csv") {
      const csv = buildCsv({
        generatedAt,
        periodDays: payload.periodDays,
        includeAi: payload.includeAi,
        includeHistory: payload.includeHistory,
        rows,
        results,
        alerts,
        selectedSiteIds,
        siteDomainById
      });

      const body = `\uFEFF${csv}`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"mihari-report-${stamp}.csv\"`,
          "Cache-Control": "no-store"
        }
      });
    }

    const pdfLines = buildPdfLines({
      generatedAt,
      periodDays: payload.periodDays,
      includeAi: payload.includeAi,
      includeHistory: payload.includeHistory,
      rows,
      results,
      alerts,
      selectedSiteIds,
      siteDomainById
    });

    const pdf = buildSimplePdf(pdfLines);
    const pdfBytes = new Uint8Array(pdf);
    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"mihari-report-${stamp}.pdf\"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export report" },
      { status: 400 }
    );
  }
}



