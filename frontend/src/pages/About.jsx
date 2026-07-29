export default function About() {
  return (
    <section className="view-section" data-testid="about-page">
      <div className="about-grid">
        <div className="about-content">
          <span className="hero-tagline">Startup Ecosystem</span>
          <h2>Pioneering the Next Era of Smart Energy Consultation</h2>
          <p>
            AiraVolt AI was built on a simple premise: professional energy audits are expensive, slow, and inaccessible to
            millions. By embedding localized tariff regulations, weather indices, and grid load-curve profiles into an
            autonomous agent framework, we enable homes, schools, corporate offices, and heavy industrial yards to audit
            themselves dynamically.
          </p>
          <p style={{ marginTop: "1rem" }}>
            Our core engine models thermal insulation, standby power leakages, and appliance degradation coefficients to
            pinpoint anomalies and suggest direct remediation plans — then hands the numbers to Aira, our Gemini-powered
            agent, for human-readable reasoning.
          </p>
          <div className="about-metrics">
            <div className="metric-box">
              <div className="metric-number">30%</div>
              <div className="metric-label">Average Waste Reduction</div>
            </div>
            <div className="metric-box">
              <div className="metric-number">12k+</div>
              <div className="metric-label">Metric Tons CO₂ Prevented</div>
            </div>
          </div>
        </div>

        <div className="glass-card about-tech-stack">
          <h3>Under the Hood</h3>
          <p style={{ fontSize: "0.88rem" }}>
            AiraVolt operates a scalable system combining thermodynamic intelligence with cloud inference.
          </p>
          {[
            { icon: "fa-brain", title: "Thermodynamic Modeling", body: "Calculates heating/cooling efficiencies and heat transfer rates from region, envelope and structure size." },
            { icon: "fa-network-wired", title: "Non-Intrusive Load Monitoring", body: "Algorithmic signature detection that disaggregates a single-point meter bill into appliance-level profiles." },
            { icon: "fa-leaf", title: "Dynamic Grid Offsetting", body: "Evaluates renewable integration (solar, thermal storage) against real-time solar irradiation models." },
            { icon: "fa-shield-halved", title: "Secure Agent Layer", body: "Session-token authentication, per-user data isolation and validated inputs on every API surface." },
          ].map((t) => (
            <div className="tech-card" key={t.title}>
              <i className={`fa-solid ${t.icon} tech-icon`} />
              <div>
                <h4>{t.title}</h4>
                <p style={{ fontSize: "0.84rem" }}>{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
