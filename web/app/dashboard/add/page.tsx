"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { 
  FileText, 
  Upload, 
  PlusCircle, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Link as LinkIcon,
  Database
} from "lucide-react";

interface BulkResult {
  created: Array<{ siteId: string; url: string }>;
  rejected: Array<{ input: string; reason: string }>;
}

export default function AddWebsitePage() {
  const { apiFetch } = useAuth();
  const [multiUrlText, setMultiUrlText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      
      if (urls.length === 0) {
        throw new Error("URLを入力してください。");
      }

      const res = await apiFetch("/api/sites/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls })
      });
      const payload = (await res.json()) as BulkResult & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to import URLs");

      const added = payload.created.length;
      const skipped = payload.rejected.length;
      setMessage(
        skipped > 0
          ? `登録完了：${added}件追加、${skipped}件を除外しました。`
          : `登録完了：${added}件追加しました。`
      );
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
      const res = await apiFetch("/api/sites/import", {
        method: "POST",
        body: formData
      });
      const payload = (await res.json()) as BulkResult & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "CSV import failed");

      const added = payload.created.length;
      const skipped = payload.rejected.length;
      setMessage(
        skipped > 0
          ? `CSV取込完了：${added}件追加、${skipped}件を除外しました。`
          : `CSV取込完了：${added}件追加しました。`
      );
      setCsvFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dashboard-main-padding">
        {/* Header Section */}
        <div className="page-header" style={{ marginBottom: "2rem" }}>
          <div>
            <span className="page-eyebrow">Inventory Management</span>
            <h1 className="page-title">サイト一括登録</h1>
            <p className="page-subtitle">監視対象のURLを手動入力、またはCSV形式で一括追加できます。</p>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.5rem", 
            padding: "0.5rem 1rem", 
            background: "var(--card-surface)", 
            borderRadius: "var(--r-md)", 
            border: "1px solid var(--border)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--text-3)"
          }}>
            <Database size={16} />
            CSV UTF-8 推奨
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.75rem", 
            padding: "1rem 1.25rem", 
            background: "var(--emerald-glass)", 
            border: "1px solid var(--emerald)", 
            borderRadius: "var(--r-md)", 
            color: "var(--emerald-dark)", 
            fontSize: "0.9375rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            animation: "slideIn 0.3s var(--ease)"
          }}>
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}

        {error && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.75rem", 
            padding: "1rem 1.25rem", 
            background: "var(--danger-bg)", 
            border: "1px solid var(--danger)", 
            borderRadius: "var(--r-md)", 
            color: "var(--danger)", 
            fontSize: "0.9375rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            animation: "slideIn 0.3s var(--ease)"
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
          
          {/* Method 1: Manual Bulk Paste */}
          <div className="data-panel" style={{ padding: "0", overflow: "hidden" }}>
            <div className="panel-header" style={{ padding: "1.25rem 1.5rem", background: "linear-gradient(to right, var(--card-surface), var(--surface-2))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ padding: "8px", borderRadius: "10px", background: "var(--emerald-glass)", color: "var(--emerald)" }}>
                  <LinkIcon size={20} />
                </div>
                <div>
                  <h3 className="panel-title" style={{ fontSize: "1rem" }}>URLを直接入力</h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 500 }}>1行に1つのURLを入力してください</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleBulkSubmit} style={{ padding: "1.5rem" }}>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "0.5rem", display: "block" }}>
                  URLリスト
                </label>
                <textarea
                  required
                  className="input"
                  style={{ 
                    width: "100%", 
                    height: "300px", 
                    resize: "none", 
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.8125rem",
                    padding: "1rem",
                    background: "var(--navy)",
                    color: "var(--emerald-light)",
                    border: "1px solid var(--navy-3)",
                    borderRadius: "var(--r-md)",
                    lineHeight: "1.6"
                  }}
                  placeholder={"https://example.com\nhttps://client-site.jp\n..."}
                  value={multiUrlText}
                  onChange={(e) => setMultiUrlText(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                disabled={busy || !multiUrlText.trim()} 
                className="btn btn-primary" 
                style={{ width: "100%", height: "3.25rem", gap: "0.75rem", fontSize: "0.9375rem" }}
              >
                {busy ? (
                  <div style={{ width: "20px", height: "20px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                ) : (
                  <PlusCircle size={20} />
                )}
                一括登録を開始
              </button>
            </form>
          </div>

          {/* Method 2: CSV Import */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="data-panel" style={{ padding: "0", overflow: "hidden" }}>
              <div className="panel-header" style={{ padding: "1.25rem 1.5rem", background: "linear-gradient(to right, var(--card-surface), var(--surface-2))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ padding: "8px", borderRadius: "10px", background: "var(--emerald-glass)", color: "var(--emerald)" }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="panel-title" style={{ fontSize: "1rem" }}>CSVインポート</h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 500 }}>大量のサイトを管理シートから読み込みます</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCsvImport} style={{ padding: "1.5rem" }}>
                <div 
                  style={{ 
                    width: "100%", 
                    height: "180px", 
                    border: "2px dashed var(--border)", 
                    borderRadius: "var(--r-lg)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    background: csvFile ? "var(--emerald-glass)" : "var(--surface-2)",
                    transition: "all 0.2s var(--ease)",
                    position: "relative",
                    marginBottom: "1.5rem",
                    cursor: "pointer"
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCsvFile(e.dataTransfer.files[0] || null);
                  }}
                >
                  <input
                    type="file"
                    accept=".csv"
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  />
                  {csvFile ? (
                    <>
                      <div style={{ padding: "12px", borderRadius: "50%", background: "var(--emerald)", color: "white" }}>
                        <CheckCircle2 size={24} />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{csvFile.name}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>ファイルを読み込み準備完了</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ padding: "12px", borderRadius: "50%", background: "white", color: "var(--text-4)", border: "1px solid var(--border)" }}>
                        <Upload size={24} />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-2)" }}>クリックまたはドラッグ＆ドロップ</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-4)" }}>最大 5,000 件まで一括処理可能</p>
                      </div>
                    </>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={busy || !csvFile} 
                  className="btn btn-primary" 
                  style={{ width: "100%", height: "3.25rem", gap: "0.75rem", fontSize: "0.9375rem" }}
                >
                  {busy ? (
                    <div style={{ width: "20px", height: "20px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Upload size={20} />
                  )}
                  CSVを取込んで解析開始
                </button>
              </form>
            </div>

            {/* Instruction Panel */}
            <div className="data-panel" style={{ padding: "1.25rem", borderStyle: "dashed", borderColor: "var(--emerald-light)", background: "var(--emerald-glass)" }}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Info size={18} style={{ color: "var(--emerald)", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--emerald-dark)", marginBottom: "0.5rem" }}>
                    ファイル準備のヒント
                  </h4>
                  <ul style={{ fontSize: "0.75rem", color: "var(--text-3)", paddingLeft: "1.25rem", marginBottom: "1rem", lineHeight: "1.8" }}>
                    <li>1列目にURL（http://...）を配置してください</li>
                    <li>ヘッダー行は自動でスキップされます</li>
                    <li>文字コードは <strong>UTF-8</strong> (BOMなし) を推奨します</li>
                  </ul>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Example Format
                  </div>
                  <div style={{ 
                    marginTop: "0.5rem", 
                    padding: "0.75rem", 
                    background: "var(--card-surface)", 
                    borderRadius: "8px", 
                    fontFamily: "monospace", 
                    fontSize: "0.7rem", 
                    color: "var(--text-2)",
                    border: "1px solid rgba(16, 185, 129, 0.1)"
                  }}>
                    url,client_name<br/>
                    https://mihari.app,Internal<br/>
                    https://example.jp,Client-A
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}





