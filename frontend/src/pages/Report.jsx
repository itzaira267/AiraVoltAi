import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, errMsg, fmtMoney, fmtNum, fmtDate } from "@/lib/api";
import { useData } from "@/context/DataContext";
import { AIRA_VERSION } from "@/lib/aira";

const PIE_COLORS = ["#00e5ff", "#00e676", "#0066ff", "#ffea00", "#ff1744", "#a855f7", "#f97316", "#14b8a6"];

export default function Report() {
  const { latest, currency, loadNotifications } = useData();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const docRef = useRef(null);

  const generate = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/reports", { analysis_id: latest?.analysis_id });
      setReport(data);
      loadNotifications();
      return data;
    } catch (e) {
      toast.error(errMsg(e, "Could not generate the report"));
      return null;
    } finally {
      setBusy(false);
    }
  }, [latest, loadNotifications]);

  useEffect(() => {
    if (!latest) return;
    (async () => {
      try {
        const { data } = await api.get("/reports");
        const match = data.find((r) => r.analysis_id === latest.analysis_id);
        if (match) setReport(match);
        else await generate();
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.analysis_id]);

  const downloadPdf = async () => {
    if (!docRef.current) return;
    setPdfBusy(true);
    try {
      const canvas = await html2canvas(docRef.current, { backgroundColor: "#0d0f17", scale: 2, useCORS: true });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const iw = pw - 40;
      const ih = (canvas.height * iw) / canvas.width;
      let left = ih;
      let y = 20;
      pdf.addImage(img, "JPEG", 20, y, iw, ih);
      left -= ph - 40;
      while (left > 0) {
        pdf.addPage();
        y = y - (ph - 40);
        pdf.addImage(img, "JPEG", 20, y, iw, ih);
        left -= ph - 40;
      }
      pdf.save(`AiraVolt-Report-${report?.reference || "audit"}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("PDF generation failed. Try the Print option instead.");
    } finally {
      setPdfBusy(false);
    }
  };

  const emailReport = async () => {
    if (!report) return;
    try {
      const { data } = await api.post(`/reports/${report.report_id}/email`);
      loadNotifications();
      toast.success(`Report queued for delivery to ${data.queued_to}`);
    } catch (e) {
      toast.error(errMsg(e, "Could not queue the report"));
    }
  };

  if (!latest)
    return (
      <section className="view-section">
        <div className="glass-card empty-state" data-testid="report-empty">
          <i className="fa-solid fa-file-contract" />
          <h3>No audit to report on</h3>
          <p style={{ margin: "0.75rem 0 1.75rem" }}>Complete an energy analysis first — Aira then compiles a full audit report.</p>
          <Link to="/analysis" className="btn btn-primary" data-testid="report-empty-cta">
            <i className="fa-solid fa-atom" /> Run Energy Analysis
          </Link>
        </div>
      </section>
    );

  const src = report || latest;
  const m = src.metrics;
  const i = src.input;
  const ins = src.insights || {};
  const consumerData = m.topConsumers.map((c) => ({ name: c.name.split(" ")[0], units: c.units, share: c.share }));

  return (
    <section className="view-section" data-testid="report-page">
      <div className="report-action-header">
        <div>
          <span className="hero-tagline">Summary Output</span>
          <h2 style={{ fontSize: "2rem" }}>Energy Health Audit Report</h2>
          <p style={{ color: "var(--color-gray-400)", fontSize: "0.9rem" }}>
            {report ? `Saved to your account · ${report.reference}` : "Generating…"}
          </p>
        </div>
        <div className="report-actions">
          <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfBusy} data-testid="report-download-btn">
            <i className={`fa-solid ${pdfBusy ? "fa-spinner spin" : "fa-file-arrow-down"}`} /> {pdfBusy ? "Building PDF…" : "Download PDF"}
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()} data-testid="report-print-btn">
            <i className="fa-solid fa-print" /> Print
          </button>
          <button className="btn btn-secondary" onClick={emailReport} disabled={!report} data-testid="report-email-btn">
            <i className="fa-regular fa-envelope" /> Email Report
          </button>
          <button className="btn btn-emerald" onClick={generate} disabled={busy} data-testid="report-regenerate-btn">
            <i className={`fa-solid ${busy ? "fa-spinner spin" : "fa-rotate"}`} /> {busy ? "Saving…" : "Save New Version"}
          </button>
        </div>
      </div>

      <div className="report-document" ref={docRef} data-testid="report-document">
        <div className="report-header-section">
          <div className="report-branding">
            <div className="report-brand-logo">
              <i className="fa-solid fa-bolt-lightning" /> AiraVolt AI
            </div>
            <h3 className="report-title-main">Facility Audit Assessment</h3>
          </div>
          <div className="report-meta-info">
            <p>
              <strong>Reference:</strong> {report?.reference || "—"}
            </p>
            <p>
              <strong>Generated:</strong> {fmtDate(src.created_at)}
            </p>
            <p>
              <strong>Prepared for:</strong> {report?.user_name || "—"}
            </p>
            <p>
              <strong>Email:</strong> {report?.user_email || "—"}
            </p>
            <p>
              <strong>Auditing Agent:</strong> Aira {AIRA_VERSION}
            </p>
          </div>
        </div>

        <h4 className="report-section-title" style={{ marginTop: 0 }}>1. Facility Profile</h4>
        <div className="about-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "2rem", padding: 0, alignItems: "start" }}>
          <table className="report-table">
            <tbody>
              {[
                ["Facility Type", i.buildingType],
                ["Location", `${i.city || "—"}${i.state ? ", " + i.state : ""}, ${i.country}`],
                ["Floor Area", `${fmtNum(i.floorArea)} sq ft`],
                ["Occupancy", `${i.occupants} persons`],
                ["Operating Hours", `${i.operatingHours} h/day`],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: "var(--color-gray-400)" }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="report-table">
            <tbody>
              {[
                ["Monthly Baseline", `${fmtNum(i.monthlyUnits)} kWh`],
                ["Monthly Bill", fmtMoney(i.monthlyBill, currency)],
                ["Effective Tariff", `${currency}${m.tariff} / kWh`],
                ["HVAC / Lighting", `${i.hvac} · ${i.lighting}`],
                ["Solar / Battery", `${i.solarAvailable ? "Yes" : "No"} · ${i.batteryBackup ? "Yes" : "No"}`],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: "var(--color-gray-400)" }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="report-section-title">2. Key Audit Diagnostics</h4>
        <div className="report-metrics-grid">
          {[
            ["Efficiency Index", `${m.efficiencyScore}%`, "var(--color-electric-blue)"],
            ["Wastage Ratio", `${m.wastePercent}%`, "var(--color-danger)"],
            ["Recoverable Energy", `${fmtNum(m.wasteUnits, 1)} kWh`, "var(--color-white)"],
            ["Monthly Savings", fmtMoney(m.monthlySavings, currency), "var(--color-emerald)"],
            ["Annual Savings", fmtMoney(m.annualSavings, currency), "var(--color-emerald)"],
            ["Benchmark Ratio", `${m.benchmarkRatio}x`, "var(--color-white)"],
          ].map(([k, v, c]) => (
            <div className="report-metric-card" key={k}>
              <p>{k}</p>
              <span className="report-metric-val" style={{ color: c }}>
                {v}
              </span>
            </div>
          ))}
        </div>

        <h4 className="report-section-title">3. Consumption Breakdown</h4>
        <div className="charts-grid even" style={{ marginBottom: 0 }}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumerData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ background: "#0a0c16", border: "1px solid rgba(0,229,255,0.25)", fontSize: 12 }} />
                <Bar dataKey="units" name="kWh" fill="#00e5ff" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={consumerData} dataKey="share" nameKey="name" outerRadius={95} label={(e) => `${e.name} ${e.value}%`} labelLine={false}>
                  {consumerData.map((c, idx) => (
                    <Cell key={c.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0a0c16", border: "1px solid rgba(0,229,255,0.25)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <h4 className="report-section-title">4. Aira's Executive Summary</h4>
        <p style={{ fontSize: "0.92rem", lineHeight: 1.7 }}>{ins.summary}</p>

        <h4 className="report-section-title">5. Identified Problems & Anomalies</h4>
        <ul className="report-anomalies-list">
          {(ins.anomalies || []).map((a, idx) => (
            <li className="report-anomaly-item" key={idx}>
              <i className="fa-solid fa-triangle-exclamation" />
              <div>
                <strong>{a.title}:</strong> {a.detail}
              </div>
            </li>
          ))}
        </ul>

        <h4 className="report-section-title">6. Recommended Remediation Plan</h4>
        <div style={{ fontSize: "0.9rem", lineHeight: 1.65 }}>
          {(ins.recommendations || []).map((r, idx) => (
            <p key={idx} style={{ marginBottom: "0.75rem" }}>
              <strong>
                {idx + 1}. {r.title}
              </strong>{" "}
              — {r.detail} <em style={{ color: "var(--color-emerald)" }}>(saves ~{fmtMoney(r.monthlySaving, currency)}/mo · payback {r.payback || "n/a"})</em>
            </p>
          ))}
        </div>

        <h4 className="report-section-title">7. Carbon Impact Analysis</h4>
        <div className="report-metrics-grid">
          {[
            ["Current Footprint", `${m.carbonFootprint} t CO₂e / mo`],
            ["Avoidable Annually", `${m.carbonSavedAnnual} t CO₂e`],
            ["Tree Equivalent", `${m.treesEquivalent} trees / mo`],
          ].map(([k, v]) => (
            <div className="report-metric-card" key={k}>
              <p>{k}</p>
              <span className="report-metric-val" style={{ color: "var(--color-emerald)", fontSize: "1.25rem" }}>
                {v}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.88rem", marginTop: "1rem" }}>
          Recommended solar capacity of {m.solar.recommendedKwp} kWp would generate approximately{" "}
          {fmtNum(m.solar.monthlyGeneration)} kWh per month, worth {fmtMoney(m.solar.monthlyValue, currency)} monthly with an
          estimated payback of {m.solar.paybackYears} years.
        </p>

        <div className="report-footer">
          <span>Authorized by AiraVolt AI Audit Protocol · Aira {AIRA_VERSION}</span>
          <span>{report?.reference || "draft"}</span>
        </div>
      </div>
    </section>
  );
}
