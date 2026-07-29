import { Link } from "react-router-dom";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useData } from "@/context/DataContext";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/api";

const AXIS = { stroke: "#6b7280", fontSize: 11 };
const TIP = {
  contentStyle: { background: "rgba(10,12,22,0.95)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#00e5ff" },
};
const PIE_COLORS = ["#00e5ff", "#00e676", "#0066ff", "#ffea00", "#ff1744", "#a855f7", "#f97316", "#14b8a6"];

const Empty = () => (
  <div className="glass-card empty-state" data-testid="dashboard-empty">
    <i className="fa-solid fa-chart-simple" />
    <h3>No telemetry yet</h3>
    <p style={{ margin: "0.75rem 0 1.75rem" }}>
      Run your first energy audit and Aira will populate this dashboard with live calculations from your own facility data.
    </p>
    <Link to="/analysis" className="btn btn-primary" data-testid="dashboard-empty-cta">
      <i className="fa-solid fa-atom" /> Start Energy Analysis
    </Link>
  </div>
);

export default function Dashboard() {
  const { dashboard, loadingDash, currency } = useData();

  if (loadingDash && !dashboard)
    return (
      <section className="view-section">
        <div className="dashboard-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 130 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 360 }} />
      </section>
    );

  if (!dashboard?.hasData) return <section className="view-section">{<Empty />}</section>;

  const { latest, history } = dashboard;
  const m = latest.metrics;
  const i = latest.input;

  const cards = [
    { label: "Energy Efficiency Score", icon: "fa-gauge-simple-high", color: "var(--color-electric-blue)", value: `${m.efficiencyScore}/100`, footer: m.efficiencyScore >= 75 ? "High efficiency" : m.efficiencyScore >= 50 ? "Moderate efficiency" : "Low efficiency", trend: m.efficiencyScore >= 60 ? "trend-down" : "trend-up", fIcon: m.efficiencyScore >= 60 ? "fa-circle-check" : "fa-triangle-exclamation", testId: "db-score" },
    { label: "Energy Waste Detected", icon: "fa-triangle-exclamation", color: "var(--color-danger)", value: `${m.wastePercent}%`, footer: `${fmtNum(m.wasteUnits, 1)} kWh recoverable / month`, trend: "trend-up", fIcon: "fa-circle-exclamation", testId: "db-waste" },
    { label: "Estimated Monthly Savings", icon: "fa-sack-dollar", color: "var(--color-emerald)", value: fmtMoney(m.monthlySavings, currency), footer: `${fmtMoney(m.annualSavings, currency)} annually`, trend: "trend-down", fIcon: "fa-arrow-trend-down", testId: "db-savings" },
    { label: "Monthly Carbon Footprint", icon: "fa-leaf", color: "var(--color-emerald)", value: `${m.carbonFootprint} t`, footer: `Equivalent to ${m.treesEquivalent} trees / month`, trend: "", fIcon: "fa-tree", testId: "db-co2" },
  ];

  const trend = history.map((h, idx) => ({
    name: `Audit ${idx + 1}`,
    score: h.metrics?.efficiencyScore ?? 0,
    waste: h.metrics?.wastePercent ?? 0,
    units: h.input?.monthlyUnits ?? 0,
  }));

  return (
    <section className="view-section" data-testid="dashboard-page">
      <div className="form-header-desc">
        <span className="hero-tagline">Real-Time Analytics</span>
        <h2>Energy Intelligence Dashboard</h2>
        <p>
          {i.buildingType} · {i.city || "—"}{i.state ? `, ${i.state}` : ""} · {fmtNum(i.floorArea)} sq ft · audited {fmtDate(latest.created_at)}
        </p>
      </div>

      <div className="dashboard-grid stagger">
        {cards.map((c) => (
          <div className="glass-card db-card interactive" key={c.label} data-testid={c.testId}>
            <div className="db-card-header">
              <span>{c.label}</span>
              <i className={`fa-solid ${c.icon}`} style={{ color: c.color }} />
            </div>
            <div className="db-card-value">{c.value}</div>
            <div className={`db-card-footer ${c.trend}`} style={c.trend ? undefined : { color: "var(--color-gray-400)" }}>
              <i className={`fa-solid ${c.fIcon}`} /> {c.footer}
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="glass-card" data-testid="chart-hourly">
          <h3 className="card-title">
            <i className="fa-solid fa-chart-line" /> Hourly Load Projection · current vs optimized
          </h3>
          <div className="chart-container-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.hourly}>
                <defs>
                  <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e676" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00e676" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={AXIS} interval={3} />
                <YAxis tick={AXIS} unit=" kW" />
                <Tooltip {...TIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="load" name="Current" stroke="#00e5ff" fill="url(#gLoad)" strokeWidth={2} />
                <Area type="monotone" dataKey="optimized" name="Optimized" stroke="#00e676" fill="url(#gOpt)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" data-testid="chart-sources">
          <h3 className="card-title">
            <i className="fa-solid fa-chart-pie" /> Energy Source Mix
          </h3>
          <div className="chart-container-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={m.sources} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3} label={(e) => `${e.value}%`}>
                  {m.sources.map((s, idx) => (
                    <Cell key={s.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="rgba(0,0,0,0.4)" />
                  ))}
                </Pie>
                <Tooltip {...TIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid even">
        <div className="glass-card" data-testid="chart-weekly">
          <h3 className="card-title">
            <i className="fa-solid fa-calendar-week" /> Weekly Consumption
          </h3>
          <div className="chart-container-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.weekly}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={AXIS} />
                <YAxis tick={AXIS} unit=" kWh" />
                <Tooltip {...TIP} />
                <Bar dataKey="units" name="Units" fill="#00e5ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" data-testid="chart-monthly">
          <h3 className="card-title">
            <i className="fa-solid fa-chart-column" /> Seasonal Trend · optimized projection
          </h3>
          <div className="chart-container-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.monthlySeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={AXIS} />
                <YAxis tick={AXIS} unit=" kWh" />
                <Tooltip {...TIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="units" name="Projected" stroke="#00e5ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="optimized" name="After actions" stroke="#00e676" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid even">
        <div className="glass-card" data-testid="top-consumers">
          <h3 className="card-title">
            <i className="fa-solid fa-plug-circle-bolt" /> Top Energy Consumers
          </h3>
          {m.topConsumers.map((c) => (
            <div className="consumer-row" key={c.key}>
              <span style={{ minWidth: 150 }}>{c.name}</span>
              <div className="consumer-bar">
                <span style={{ width: `${c.share}%` }} />
              </div>
              <strong style={{ minWidth: 88, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                {fmtNum(c.units, 1)} kWh
              </strong>
              <span style={{ minWidth: 78, textAlign: "right", color: "var(--color-emerald)" }}>{fmtMoney(c.cost, currency)}</span>
            </div>
          ))}
        </div>

        <div className="glass-card" data-testid="historical-comparison">
          <h3 className="card-title">
            <i className="fa-solid fa-clock-rotate-left" /> Historical Comparison
          </h3>
          {trend.length > 1 ? (
            <div className="chart-container-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={AXIS} />
                  <YAxis tick={AXIS} />
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="score" name="Efficiency" stroke="#00e5ff" strokeWidth={2} />
                  <Line type="monotone" dataKey="waste" name="Waste %" stroke="#ff1744" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: "1rem 0" }}>
              <p style={{ fontSize: "0.88rem" }}>
                Run another audit after applying Aira's recommendations to unlock trend comparison across audits.
              </p>
              <div className="report-metrics-grid" style={{ marginTop: "1.25rem" }}>
                <div className="report-metric-card">
                  <p>Energy Intensity</p>
                  <span className="report-metric-val">{m.energyIntensity}</span>
                  <p>kWh / sq ft</p>
                </div>
                <div className="report-metric-card">
                  <p>Benchmark Ratio</p>
                  <span className="report-metric-val">{m.benchmarkRatio}x</span>
                  <p>vs peer facilities</p>
                </div>
                <div className="report-metric-card">
                  <p>Per Occupant</p>
                  <span className="report-metric-val">{m.perCapita}</span>
                  <p>kWh / person</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <Link to="/recommendations" className="btn btn-emerald" data-testid="dashboard-to-recommendations">
          <i className="fa-solid fa-lightbulb" /> View Recommendations
        </Link>
        <Link to="/simulator" className="btn btn-secondary" data-testid="dashboard-to-simulator">
          <i className="fa-solid fa-sliders" /> Open "What If?" Simulator
        </Link>
        <Link to="/report" className="btn btn-secondary" data-testid="dashboard-to-report">
          <i className="fa-solid fa-file-contract" /> Generate Report
        </Link>
      </div>
    </section>
  );
}
