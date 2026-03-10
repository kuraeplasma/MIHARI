"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";

interface BulkResult {
  created: Array<{ siteId: string; url: string }>;
  rejected: Array<{ input: string; reason: string }>;
}

interface ClientOption {
  clientId: string;
  name: string;
}

interface ClientsResponse {
  clients: ClientOption[];
}

export default function AddWebsitePage() {
  const { apiFetch, token } = useAuth();
  const [multiUrlText, setMultiUrlText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadClients = async () => {
      try {
        const res = await apiFetch("/api/clients");
        if (!res.ok) {
          return;
        }
        const payload = (await res.json()) as ClientsResponse;
        setClients(payload.clients);
      } catch {
        setClients([]);
      }
    };

    void loadClients();
  }, [apiFetch, token]);

  const handleBulkSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const urls = multiUrlText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await apiFetch("/api/sites/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ urls, clientId: selectedClientId || null })
      });
      const payload = (await res.json()) as BulkResult & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to import URLs");
      }
      setMessage(`登録完了: ${payload.created.length}件追加、${payload.rejected.length}件を除外しました。`);
      setMultiUrlText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleCsvImport = async (event: FormEvent) => {
    event.preventDefault();
    if (!csvFile) {
      setError("CSVファイルを選択してください。");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      if (selectedClientId) {
        formData.append("clientId", selectedClientId);
      }
      const res = await apiFetch("/api/sites/import", {
        method: "POST",
        body: formData
      });
      const payload = (await res.json()) as BulkResult & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "CSV import failed");
      }
      setMessage(`CSV取込完了: ${payload.created.length}件追加、${payload.rejected.length}件を除外しました。`);
      setCsvFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell>
      <section className="panel hero-panel">
        <div className="section-head-copy">
          <p className="eyebrow">Bulk Registration</p>
          <h3>サイト追加</h3>
          <p className="tiny-copy">テキスト貼り付けとCSVインポートの両方で、複数サイトを一括登録できます。</p>
        </div>
      </section>

      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="two-column-grid">
        <form className="form-block" onSubmit={handleBulkSubmit}>
          <div className="section-head-copy">
            <h3>URLを1行ずつ入力</h3>
            <p className="tiny-copy">1行 = 1サイト。顧客を指定すると CRM に紐づきます。</p>
          </div>

          <label className="tiny-copy" htmlFor="client-selector">
            顧客
          </label>
          <select
            id="client-selector"
            className="input"
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
          >
            <option value="">未指定</option>
            {clients.map((client) => (
              <option key={client.clientId} value={client.clientId}>
                {client.name}
              </option>
            ))}
          </select>

          <textarea
            required
            className="input textarea"
            placeholder={"https://example.com\nhttps://client-a.jp\nhttps://client-b.jp"}
            value={multiUrlText}
            onChange={(event) => setMultiUrlText(event.target.value)}
          />
          <button disabled={busy} className="btn btn-primary" type="submit">
            一括登録して監視開始
          </button>
        </form>

        <form className="form-block" onSubmit={handleCsvImport}>
          <div className="section-head-copy">
            <h3>CSVインポート</h3>
            <p className="tiny-copy">CSV をアップロードして大量のサイトを登録できます。</p>
          </div>

          <input
            required
            type="file"
            accept=".csv,text/csv"
            className="input file"
            onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
          />
          <button disabled={busy} className="btn btn-primary" type="submit">
            CSVを取込んで監視開始
          </button>

          <div className="empty-state">
            <p>推奨フォーマット</p>
            <p className="mono-link">https://example.com</p>
            <p className="mono-link">https://client-a.jp</p>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
