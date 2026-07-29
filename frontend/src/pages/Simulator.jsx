import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { api, fmtMoney, fmtNum } from "@/lib/api";
import { useData } from "@/context/DataContext";

const TIERS = ["Baseline", "Tier 1 (ENERGY STAR)", "Tier 2 (Premium inverter)"];

export default function Simulator() {
  const { latest, currency } = useData();
  const [led, setLed] = useState(0);
  const [solar, setSolar] = useState(0);
  const [hvac, setHvac] = useState(0);
  const [tier, setTier] = useState(0);
  const [schedule, setSchedule] = useState(0);
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  const base = useMemo(
    () => ({
      monthlyUnits: latest?.input?.monthlyUnits || 650,
      monthlyBill: latest?.input?.monthlyBill || 180,
    }),
    [latest]
  );

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.post("/simulate", {
          ...base,
          ledPercent: led,
          solarKwp: solar,
          hvacOffset: hvac,
          applianceTier: tier,
          occupancySchedule: schedule,
        });
        setResult(data);
      } catch {
        /* ignore */
      }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [led, solar, hvac, tier, schedule, base]);

  const offset = result?.offsetPercent || 0;
  const dashOffset = 691 - (691 * Math.min(offset, 100)) / 100;

  const sliders = [
    { label: "LED Lighting Transition", value: led, set: setLed, min: 0, max: 100, step: 1, read: `${led}%`, help: "Percentage of high-energy bulbs upgraded to efficient LEDs.", testId: "slider-led" },
    { label: "Solar System Installation", value: solar, set: setSolar, min: 0, max: 25, step: 0.5, read: `${solar.toFixed(1)} kWp`, help: "Rated size of rooftop solar PV deployed on your facility.", testId: "slider-solar" },
    { label: "HVAC Thermostat Offset", value: hvac, set: setHvac, min: 0, max: 4, step: 0.5, read: `${hvac.toFixed(1)}°C`, help: "Setpoint buffer — warmer in cooling mode, cooler in heating mode.", testId: "slider-hvac" },
    { label: "Appliance Efficiency Upgrade", value: tier, set: setTier, min: 0, max: 2, step: 1, read: TIERS[tier], help: "Replacement of legacy appliances with certified efficient alternatives.", testId: "slider-tier" },
    { label: "Occupancy-based Scheduling", value: schedule, set: setSchedule, min: 0, max: 100, step: 5, read: `${schedule}%`, help: "Share of loads placed under occupancy sensors and timers.", testId: "slider-schedule" },
  ];

  return (
    <section className="view-section" data-testid="simulator-page">
      <div className="form-header-desc">
        <span className="hero-tagline">Sandbox Modeling</span>
        <h2>Smart "What If?" Energy Simulator</h2>
        <p>
          {latest
            ? `Modelling against your live baseline of ${fmtNum(base.monthlyUnits)} kWh / ${fmtMoney(base.monthlyBill, currency)} per month.`
            : "Using a demo baseline — run an audit to simulate against your real facility."}
        </p>
      </div>

      <div className="glass-card simulator-container" data-testid="simulator-card">
        <div className="simulator-controls">
          <h3>Simulation Parameters</h3>
          {sliders.map((s) => (
            <div className="sim-slider-group" key={s.label}>
              <div className="slider-header">
                <span>{s.label}</span>
                <span className="slider-val-readout" data-testid={`${s.testId}-value`}>
                  {s.read}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.value}
                onChange={(e) => s.set(Number(e.target.value))}
                data-testid={s.testId}
              />
              <p>{s.help}</p>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLed(0);
              setSolar(0);
              setHvac(0);
              setTier(0);
              setSchedule(0);
            }}
            data-testid="simulator-reset-btn"
          >
            <i className="fa-solid fa-rotate-left" /> Reset scenario
          </button>
        </div>

        <div className="simulator-results">
          <div className="gauge-visual">
            <svg className="gauge-svg" width="250" height="250" viewBox="0 0 260 260">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" />
                  <stop offset="100%" stopColor="#00e676" />
                </linearGradient>
              </defs>
              <circle className="gauge-bg" cx="130" cy="130" r="110" />
              <circle className="gauge-fill" cx="130" cy="130" r="110" style={{ strokeDashoffset: dashOffset }} />
            </svg>
            <div className="gauge-text">
              <div className="gauge-percent" data-testid="sim-offset">
                {offset}%
              </div>
              <div className="gauge-label">Energy Offset Ratio</div>
            </div>
          </div>

          <div className="sim-results-grid">
            {[
              ["Monthly Bill Savings", fmtMoney(result?.billSaving, currency), "var(--color-emerald)", "sim-bill-saving"],
              ["New Monthly Bill", fmtMoney(result?.newMonthlyBill ?? base.monthlyBill, currency), "var(--color-electric-blue)", "sim-new-bill"],
              ["Energy Offset", `${fmtNum(result?.unitsSaved, 1)} kWh`, "var(--color-electric-blue)", "sim-units-saved"],
              ["Annual Savings", fmtMoney(result?.annualSaving, currency), "var(--color-emerald)", "sim-annual-saving"],
              ["Carbon Reduction", `${result?.carbonReductionAnnual ?? 0} t/yr`, "var(--color-emerald)", "sim-carbon"],
              ["Investment ROI", result?.roiYears ? `${result.roiYears} yrs` : "—", "var(--color-warning)", "sim-roi"],
              ["Solar Payback", result?.solarPaybackYears ? `${result.solarPaybackYears} yrs` : "—", "var(--color-warning)", "sim-solar-payback"],
              ["Est. Capex", fmtMoney(result?.capex, currency), "var(--color-gray-300)", "sim-capex"],
            ].map(([label, value, color, testId]) => (
              <div className="sim-result-box" key={label} data-testid={testId}>
                <div className="sim-result-label">{label}</div>
                <div className="sim-result-val" style={{ color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {!latest && (
            <Link to="/analysis" className="btn btn-primary" style={{ marginTop: "1.5rem" }} data-testid="simulator-analysis-cta">
              <i className="fa-solid fa-atom" /> Simulate with my real data
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
