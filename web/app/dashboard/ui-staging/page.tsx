"use client";

import { useState } from "react";
import { Activity, RefreshCw, AlertTriangle, Cpu, Copy, Check, Move } from "lucide-react";

export default function UIStagingPage() {
  const [heroPaddingTop, setHeroPaddingTop] = useState(1.5);
  const [heroPaddingBottom, setHeroPaddingBottom] = useState(5.0);
  const [heroPaddingHorizontal, setHeroPaddingHorizontal] = useState(2.5);
  const [labelOpacity, setLabelOpacity] = useState(0.6);
  const [labelBottom, setLabelBottom] = useState(0.5);
  const [buttonPaddingTop, setButtonPaddingTop] = useState(4);
  const [copied, setCopied] = useState(false);

  const heroSummary = { text: "直近24時間、すべてのサイトは正常です。", color: "var(--ok)" };
  const tickerLoopItems = ["監視サイト 40 件", "正常 40 件", "要確認 0 件", "プラン PRO"];

  const kpis = [
    { label: "監視サイト", value: 40, unit: "sites", trend: "正常 40", icon: <Activity size={18} /> },
    { label: "本日の変更検知", value: 0, unit: "changes", trend: "直近24時間", icon: <RefreshCw size={18} /> },
    { label: "要確認リスク", value: 0, unit: "issues", trend: "重大エラー 0", icon: <AlertTriangle size={18} /> },
    { label: "AI解析レポート", value: 40, unit: "reports", trend: "AI自動解析", icon: <Cpu size={18} /> },
  ];

  const generatedCSS = `.monitor-content {
  padding: ${heroPaddingTop}rem ${heroPaddingHorizontal}rem ${heroPaddingBottom}rem !important;
}

.monitor-status-label {
  opacity: ${labelOpacity} !important;
  margin-bottom: ${labelBottom}rem !important;
}

.monitor-btn {
  padding-top: ${buttonPaddingTop}px !important;
}

.kpi-grid-monitor, 
.monitor-view-switcher-wrap, 
.monitor-grid-sub-area {
  padding-left: ${heroPaddingHorizontal}rem !important;
  padding-right: ${heroPaddingHorizontal}rem !important;
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCSS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <>
        <div className="dashboard-main-padding">
        <div style={{
          position: "fixed",
          right: "2rem",
          top: "6rem",
          width: "320px",
          background: "rgba(10, 20, 10, 0.95)",
          border: "2px solid #59ff84",
          borderRadius: "12px",
          padding: "1.5rem",
          zIndex: 1000,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          color: "#59ff84",
          fontFamily: "monospace"
        }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Move size={16} /> UI_STAGING_CONTROLS
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", fontSize: "0.8rem" }}>
            <label>
              HERO_TOP: {heroPaddingTop}rem
              <input type="range" min="0" max="6" step="0.1" value={heroPaddingTop} onChange={(e) => setHeroPaddingTop(Number(e.target.value))} style={{ width: "100%", accentColor: "#59ff84" }} />
            </label>
            <label>
              HERO_BOTTOM: {heroPaddingBottom}rem
              <input type="range" min="0" max="10" step="0.1" value={heroPaddingBottom} onChange={(e) => setHeroPaddingBottom(Number(e.target.value))} style={{ width: "100%", accentColor: "#59ff84" }} />
            </label>
            <label>
              LR_PADDING: {heroPaddingHorizontal}rem
              <input type="range" min="0" max="8" step="0.1" value={heroPaddingHorizontal} onChange={(e) => setHeroPaddingHorizontal(Number(e.target.value))} style={{ width: "100%", accentColor: "#59ff84" }} />
            </label>
            <label>
              OPACITY: {labelOpacity}
              <input type="range" min="0.1" max="1" step="0.05" value={labelOpacity} onChange={(e) => setLabelOpacity(Number(e.target.value))} style={{ width: "100%", accentColor: "#59ff84" }} />
            </label>
            <label>
              LABEL_MARGIN: {labelBottom}rem
              <input type="range" min="0" max="2" step="0.05" value={labelBottom} onChange={(e) => setLabelBottom(Number(e.target.value))} style={{ width: "100%", accentColor: "#59ff84" }} />
            </label>
            <label>
              BTN_NUDGE: {buttonPaddingTop}px
              <input type="range" min="0" max="10" step="1" value={buttonPaddingTop} onChange={(e) => setButtonPaddingTop(Number(e.target.value))} style={{ width: "100%", accentColor: "#59ff84" }} />
            </label>
          </div>
          <button 
            onClick={copyToClipboard}
            style={{
              marginTop: "1.5rem",
              width: "100%",
              padding: "0.8rem",
              background: "#59ff84",
              color: "#051005",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} 
            {copied ? "COPIED" : "COPY CSS"}
          </button>
        </div>

        <div style={{ marginBottom: "2rem", opacity: 0.6, fontSize: "0.8rem" }}>
          [ MODE: UI_STAGING ] // スライダーで位置と明るさを調整してください。
        </div>

        <div className="monitor-wall-system">
          <section className="hero-monitor-outer">
            <div className="hero-monitor-inner stable pipboy-monitor">
              <div className="monitor-vignette" />
              <div className="monitor-content" style={{ 
                padding: `${heroPaddingTop}rem ${heroPaddingHorizontal}rem ${heroPaddingBottom}rem` 
              }}>
                <div className="monitor-status-header">
                  <span className="monitor-status-label" style={{ 
                    opacity: labelOpacity,
                    marginBottom: `${labelBottom}rem`,
                    color: heroSummary.color
                  }}>
                    SYSTEM_STATUS_MONITOR - NORMAL
                  </span>
                  <h2 className="welcome-title monitor-text">
                    {">"} {heroSummary.text}
                  </h2>
                </div>
                <div className="welcome-actions">
                  <button className="btn monitor-btn monitor-btn-primary" style={{ paddingTop: `${buttonPaddingTop}px` }}>
                    監視一覧へ
                  </button>
                  <button className="btn monitor-btn monitor-btn-ghost" style={{ paddingTop: `${buttonPaddingTop}px` }}>
                    アラートを検証
                  </button>
                </div>
              </div>
              <div className="monitor-ticker-dock">
                <div className="ops-ticker-wrap">
                  <div className="ops-ticker-track">
                    <div className="ops-ticker-group">
                      {tickerLoopItems.map((item, idx) => <span key={idx} className="ops-ticker-item">{item}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="kpi-grid-monitor" style={{ padding: `0 ${heroPaddingHorizontal}rem` }}>
            {kpis.map(kpi => (
              <article key={kpi.label} className="kpi-card-monitor">
                <div className="kpi-monitor-icon">{kpi.icon}</div>
                <div className="kpi-monitor-body">
                  <p className="kpi-monitor-label">{kpi.label}</p>
                  <div className="kpi-monitor-val-wrap">
                    <span className="kpi-monitor-value">{kpi.value}</span>
                    <span className="kpi-monitor-unit">{kpi.unit}</span>
                  </div>
                  <div className="kpi-monitor-trend">{kpi.trend}</div>
                </div>
              </article>
            ))}
          </div>

          <section className="monitor-grid-sub-area" style={{ padding: `0.5rem ${heroPaddingHorizontal}rem 2rem` }}>
            <div className="monitor-view-switcher-wrap" style={{ padding: `0.8rem 0 0.5rem` }}>
              <div className="monitor-view-label">STATUS_SUMMARY - LIVE_FEED</div>
            </div>
            <div className="plan-capacity-grid">
               <div className="plan-slot-grid plan-slot-grid-40">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="plan-slot-thumb healthy">
                      <div style={{ width: "100%", height: "100%", background: "rgba(89,255,132,0.05)" }} />
                    </div>
                  ))}
               </div>
            </div>
          </section>
        </div>
      </div>
      </>
    </>
  );
}

