import { Link } from "react-router-dom";
import { AiraAvatar } from "@/components/AiraAvatar";
import { AIRA_VERSION } from "@/lib/aira";

const ABILITIES = [
  { n: "01", t: "Dynamic Consumption Analysis", d: "Ingests grid billing patterns and decomposes units (kWh) into standby loads, heating cycles, and active operational windows." },
  { n: "02", t: "Anomaly & Leakage Detection", d: "Identifies appliance inefficiencies — failing compressor seals, scale build-up, phantom draw — by checking spikes against benchmark expectations." },
  { n: "03", t: "Cost Optimization & Forecasting", d: "Projects monthly budget margins under seasonal conditions and identifies shifts to off-peak tariff hours for instant billing cuts." },
  { n: "04", t: "Vision-based Bill Reading", d: "Reads scanned or photographed electricity bills, extracts units, tariff, amount and meter readings, then auto-runs the audit." },
  { n: "05", t: "Conversational Explanation", d: "Explains every dashboard chart and recommendation in plain language, remembering your facility context throughout the session." },
];

export default function MeetAira() {
  return (
    <section className="view-section" data-testid="meet-aira-page">
      <div className="aira-showcase-container">
        <div className="glass-card aira-model-view" data-testid="aira-model-card">
          <AiraAvatar size={300} testId="meet-aira-avatar" />
          <h3 style={{ marginTop: "1.5rem" }}>Aira Agent ({AIRA_VERSION})</h3>
          <p style={{ fontSize: "0.83rem", color: "var(--color-gray-400)" }}>Primary Energy Intelligence Model</p>

          <div className="system-status">
            <div className="status-row">
              <span>Status</span>
              <span className="status-online">Operational</span>
            </div>
            <div className="status-row">
              <span>Reasoning Engine</span>
              <span className="status-value">Gemini 3 Flash</span>
            </div>
            <div className="status-row">
              <span>Modalities</span>
              <span className="status-value">Text · Vision · Voice</span>
            </div>
            <div className="status-row">
              <span>Context Window</span>
              <span className="status-value">1M Tokens</span>
            </div>
          </div>
        </div>

        <div>
          <span className="hero-tagline">AI Capabilities</span>
          <h2 style={{ fontSize: "2.2rem", marginBottom: "1rem" }}>Meet Your Virtual Chief Energy Officer</h2>
          <p style={{ marginBottom: "2rem" }}>
            Aira is not just a chatbot. She is a stateful decision-making agent that reads your physical variables, models
            appliance usage signatures, and structures continuous optimization loops.
          </p>

          <div className="aira-abilities-list">
            {ABILITIES.map((a) => (
              <div className="ability-item" key={a.n}>
                <span className="ability-num">{a.n}</span>
                <div className="ability-text">
                  <h3>{a.t}</h3>
                  <p>{a.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "2.25rem", flexWrap: "wrap" }}>
            <Link to="/chat" className="btn btn-primary" data-testid="meet-aira-chat-btn">
              <i className="fa-regular fa-comment-dots" /> Start a consultation
            </Link>
            <Link to="/analysis" className="btn btn-secondary" data-testid="meet-aira-analysis-btn">
              <i className="fa-solid fa-atom" /> Run an audit
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
