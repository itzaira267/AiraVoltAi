import { Link } from "react-router-dom";
import { AiraAvatar } from "@/components/AiraAvatar";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { icon: "fa-magnifying-glass-chart", title: "Intelligent Auditing", body: "Aira ingests 15 facility variables — geography, envelope, appliances, HVAC and tariff — to produce a pinpoint load and carbon breakdown." },
  { icon: "fa-file-invoice", title: "AI Bill Scanner", body: "Upload any electricity bill as PDF or photo. Gemini vision extracts units, tariff, amount, meter reading and billing dates instantly." },
  { icon: "fa-triangle-exclamation", title: "Waste Detection", body: "Phantom loads, degraded compressors, incandescent drag and thermal over-cycling are flagged against benchmark intensity." },
  { icon: "fa-sliders", title: "Simulation Engine", body: "Model LED retrofits, solar arrays, thermostat offsets and appliance tiers with live ROI, payback and carbon maths." },
  { icon: "fa-file-contract", title: "Investor-grade Reports", body: "Generate branded PDF energy health audits with charts, anomalies, remediation plans and Aira's executive summary." },
  { icon: "fa-comments", title: "Conversational Agent", body: "Aira remembers your audit context, explains every chart, and answers follow-ups by voice or text." },
];

export default function Landing() {
  const { user } = useAuth();
  const start = user && user.user_id ? "/analysis" : "/signup";

  return (
    <section className="view-section" data-testid="landing-page">
      <div className="hero-container">
        <div>
          <span className="hero-tagline">Analyze. Optimize. Sustain.</span>
          <h1 className="hero-title">
            Meet Aira – Your Intelligent <span>Energy Optimization</span> Agent
          </h1>
          <p className="hero-description">
            AiraVolt AI turns a single electricity bill into a full facility audit. Aira maps your power patterns, flags
            hidden wastage, quantifies cost reductions and builds a measurable path to net-zero — in seconds, not weeks.
          </p>
          <div className="hero-ctas">
            <Link to={start} className="btn btn-primary" data-testid="hero-start-analysis-btn">
              <i className="fa-solid fa-chart-simple" /> Start Energy Analysis
            </Link>
            <Link to="/chat" className="btn btn-secondary" data-testid="hero-chat-btn">
              <i className="fa-regular fa-comment-dots" /> Talk with Aira
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <strong>30%</strong>
              <span>Average waste recovered</span>
            </div>
            <div className="hero-stat">
              <strong>15</strong>
              <span>Facility variables modelled</span>
            </div>
            <div className="hero-stat">
              <strong>&lt;20s</strong>
              <span>Full AI audit turnaround</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <AiraAvatar size={380} testId="hero-aira-avatar" />
        </div>
      </div>

      <h2 className="features-section-title">Decentralized Power Audits, Accelerated by AI</h2>
      <div className="features-grid stagger">
        {FEATURES.map((f) => (
          <div className="glass-card feature-card interactive" key={f.title} data-testid={`feature-card-${f.icon}`}>
            <div className="feature-icon-wrapper">
              <i className={`fa-solid ${f.icon}`} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ textAlign: "center", padding: "3rem 2rem" }} data-testid="landing-cta">
        <span className="hero-tagline">Ready when you are</span>
        <h2 style={{ fontSize: "1.9rem", marginBottom: "0.75rem" }}>Run your first audit in under a minute</h2>
        <p style={{ maxWidth: 520, margin: "0 auto 1.75rem" }}>
          No consultants, no site visit. Upload a bill or fill the facility form and Aira does the rest.
        </p>
        <Link to={start} className="btn btn-emerald" data-testid="landing-cta-btn">
          <i className="fa-solid fa-atom" /> Launch Aira
        </Link>
      </div>
    </section>
  );
}
