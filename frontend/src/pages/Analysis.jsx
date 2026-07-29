import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmtNum } from "@/lib/api";
import { AiraLoader } from "@/components/AiraAvatar";
import { useData } from "@/context/DataContext";

const APPLIANCES = [
  ["ac", "Air Conditioning (HVAC)"],
  ["heating", "Space Heating"],
  ["incandescent", "Incandescent Lighting"],
  ["led", "LED Lighting"],
  ["water_heater", "Electric Water Heater"],
  ["refrigerator", "Refrigeration"],
  ["servers", "Servers / IT Load"],
  ["machinery", "Heavy Machinery"],
  ["standby", "Standby / Phantom Devices"],
  ["washing", "Washer & Dryer"],
  ["ev", "EV Charging"],
  ["kitchen", "Kitchen Appliances"],
];

const STEPS = ["Parsing facility envelope", "Disaggregating appliance signatures", "Benchmarking against grid profiles", "Aira composing recommendations"];

const initial = {
  country: "India",
  state: "",
  city: "",
  buildingType: "Home",
  floorArea: 1200,
  occupants: 4,
  monthlyBill: 180,
  monthlyUnits: 650,
  tariff: "",
  currency: "$",
  solarAvailable: false,
  batteryBackup: false,
  hvac: "Split AC",
  lighting: "Mixed",
  operatingHours: 10,
  appliances: ["ac", "incandescent", "led", "water_heater", "refrigerator", "standby"],
};

export default function Analysis() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { loadDashboard, loadNotifications } = useData();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleApp = (key) =>
    setForm((f) => ({ ...f, appliances: f.appliances.includes(key) ? f.appliances.filter((a) => a !== key) : [...f.appliances, key] }));

  const validate = () => {
    if (Number(form.floorArea) < 50) return "Floor area must be at least 50 sq ft";
    if (Number(form.occupants) < 1) return "There must be at least one occupant";
    if (Number(form.monthlyBill) <= 0) return "Monthly bill must be greater than zero";
    if (Number(form.monthlyUnits) <= 0) return "Monthly units must be greater than zero";
    if (!form.city.trim()) return "Please enter your city";
    return null;
  };

  const submit = async (e, override = {}) => {
    e?.preventDefault?.();
    const payload = { ...form, ...override };
    const err = validate();
    if (err) return toast.error(err);

    setBusy(true);
    setStep(0);
    const ticker = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    try {
      const body = {
        ...payload,
        floorArea: Number(payload.floorArea),
        occupants: Number(payload.occupants),
        monthlyBill: Number(payload.monthlyBill),
        monthlyUnits: Number(payload.monthlyUnits),
        operatingHours: Number(payload.operatingHours),
        tariff: payload.tariff === "" ? 0 : Number(payload.tariff),
      };
      const { data } = await api.post("/analysis", body);
      await loadDashboard();
      loadNotifications();
      toast.success(`Audit complete — efficiency ${data.metrics.efficiencyScore}/100`);
      navigate("/dashboard");
    } catch (e2) {
      toast.error(errMsg(e2, "Analysis failed. Please try again."));
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setScanning(true);
    setScan(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/bill/scan", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const ex = data.extracted || {};
      setScan(ex);
      const next = { ...form };
      if (ex.units) next.monthlyUnits = Math.round(Number(ex.units));
      if (ex.billAmount) next.monthlyBill = Number(ex.billAmount);
      if (ex.tariff) next.tariff = Number(ex.tariff);
      if (ex.currency) next.currency = ex.currency.length <= 3 ? ex.currency : next.currency;
      setForm(next);
      loadNotifications();
      toast.success("Bill scanned — running analysis with extracted values");
      await submit(null, next);
    } catch (e) {
      toast.error(errMsg(e, "Could not read that bill. Try a clearer image or PDF."));
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="view-section" data-testid="analysis-page">
      {busy && <AiraLoader label="Aira is auditing your facility" step={STEPS[step]} />}

      <div className="form-header-desc">
        <span className="hero-tagline">Step 1: Diagnostics</span>
        <h2>Start Your Digital Energy Audit</h2>
        <p>Provide your building parameters, or upload an electricity bill and let Aira read it for you.</p>
      </div>

      <div className="glass-card analysis-form-wrapper" style={{ marginBottom: "1.75rem" }} data-testid="bill-scanner-card">
        <h3 className="card-title">
          <i className="fa-solid fa-file-invoice" /> AI Bill Scanner
        </h3>
        <div
          className={`dropzone ${drag ? "drag" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files?.[0]);
          }}
          data-testid="bill-dropzone"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files?.[0])}
            data-testid="bill-file-input"
          />
          {scanning ? (
            <>
              <i className="fa-solid fa-spinner spin" />
              <strong>Aira is reading your bill…</strong>
              <p style={{ fontSize: "0.82rem" }}>Extracting units, tariff, amount, meter reading and billing dates.</p>
            </>
          ) : (
            <>
              <i className="fa-solid fa-cloud-arrow-up" />
              <strong>Drop your electricity bill here or click to browse</strong>
              <p style={{ fontSize: "0.82rem" }}>PDF, PNG, JPEG or WEBP · max 10MB · analysis runs automatically</p>
            </>
          )}
        </div>

        {scan && (
          <div className="scan-result" data-testid="bill-scan-result">
            {[
              ["Units", scan.units ? `${fmtNum(scan.units)} kWh` : "—"],
              ["Bill Amount", scan.billAmount ? `${form.currency}${fmtNum(scan.billAmount, 2)}` : "—"],
              ["Tariff", scan.tariff ? `${form.currency}${scan.tariff}/kWh` : "—"],
              ["Billing Date", scan.billingDate || "—"],
              ["Meter Reading", scan.meterReading ? fmtNum(scan.meterReading) : "—"],
              ["Provider", scan.provider || "—"],
            ].map(([k, v]) => (
              <div className="scan-chip" key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card analysis-form-wrapper">
        <form onSubmit={submit} data-testid="energy-audit-form">
          <div className="form-section-label">Location</div>
          <div className="form-grid three">
            <div className="form-group">
              <label htmlFor="country">
                <i className="fa-solid fa-earth-asia" /> Country
              </label>
              <input id="country" type="text" value={form.country} onChange={(e) => set("country", e.target.value)} required data-testid="input-country" />
            </div>
            <div className="form-group">
              <label htmlFor="state">
                <i className="fa-solid fa-map" /> State / Region
              </label>
              <input id="state" type="text" value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="e.g. Maharashtra" data-testid="input-state" />
            </div>
            <div className="form-group">
              <label htmlFor="city">
                <i className="fa-solid fa-city" /> City
              </label>
              <input id="city" type="text" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Pune" required data-testid="input-city" />
            </div>
          </div>

          <div className="form-section-label">Facility profile</div>
          <div className="form-grid three">
            <div className="form-group">
              <label htmlFor="buildingType">
                <i className="fa-solid fa-building-user" /> Building Type
              </label>
              <select id="buildingType" value={form.buildingType} onChange={(e) => set("buildingType", e.target.value)} data-testid="input-building-type">
                {["Home", "School", "Office", "Industry", "Retail", "Hospital"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="floorArea">
                <i className="fa-solid fa-ruler-combined" /> Floor Area (sq ft)
              </label>
              <input id="floorArea" type="number" min="50" value={form.floorArea} onChange={(e) => set("floorArea", e.target.value)} required data-testid="input-floor-area" />
            </div>
            <div className="form-group">
              <label htmlFor="occupants">
                <i className="fa-solid fa-users" /> Occupants / Staff
              </label>
              <input id="occupants" type="number" min="1" value={form.occupants} onChange={(e) => set("occupants", e.target.value)} required data-testid="input-occupants" />
            </div>
            <div className="form-group">
              <label htmlFor="operatingHours">
                <i className="fa-regular fa-clock" /> Operating Hours / Day
              </label>
              <input id="operatingHours" type="number" min="1" max="24" value={form.operatingHours} onChange={(e) => set("operatingHours", e.target.value)} data-testid="input-operating-hours" />
            </div>
            <div className="form-group">
              <label htmlFor="hvac">
                <i className="fa-solid fa-fan" /> HVAC System
              </label>
              <select id="hvac" value={form.hvac} onChange={(e) => set("hvac", e.target.value)} data-testid="input-hvac">
                {["None", "Fans only", "Window AC", "Split AC", "Inverter AC", "Central AC (Old)", "Central AC (VRF)", "Heat Pump"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="lighting">
                <i className="fa-regular fa-lightbulb" /> Lighting
              </label>
              <select id="lighting" value={form.lighting} onChange={(e) => set("lighting", e.target.value)} data-testid="input-lighting">
                {["Full LED", "Mixed", "CFL", "Incandescent"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section-label">Electrical baseline</div>
          <div className="form-grid three">
            <div className="form-group">
              <label htmlFor="monthlyBill">
                <i className="fa-solid fa-wallet" /> Monthly Bill
              </label>
              <input id="monthlyBill" type="number" min="1" step="0.01" value={form.monthlyBill} onChange={(e) => set("monthlyBill", e.target.value)} required data-testid="input-monthly-bill" />
            </div>
            <div className="form-group">
              <label htmlFor="monthlyUnits">
                <i className="fa-solid fa-gauge-high" /> Monthly Units (kWh)
              </label>
              <input id="monthlyUnits" type="number" min="1" value={form.monthlyUnits} onChange={(e) => set("monthlyUnits", e.target.value)} required data-testid="input-monthly-units" />
            </div>
            <div className="form-group">
              <label htmlFor="tariff">
                <i className="fa-solid fa-tags" /> Tariff / kWh (optional)
              </label>
              <input id="tariff" type="number" min="0" step="0.0001" value={form.tariff} onChange={(e) => set("tariff", e.target.value)} placeholder="auto-derived" data-testid="input-tariff" />
            </div>
            <div className="form-group">
              <label htmlFor="currency">
                <i className="fa-solid fa-coins" /> Currency Symbol
              </label>
              <select id="currency" value={form.currency} onChange={(e) => set("currency", e.target.value)} data-testid="input-currency">
                {["$", "₹", "€", "£", "AED", "A$"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>
                <i className="fa-solid fa-solar-panel" /> Solar Availability
              </label>
              <div className="toggle-row">
                <span style={{ fontSize: "0.85rem", color: "var(--color-gray-400)" }}>{form.solarAvailable ? "Installed" : "Not installed"}</span>
                <div className={`switch ${form.solarAvailable ? "on" : ""}`} onClick={() => set("solarAvailable", !form.solarAvailable)} data-testid="toggle-solar" />
              </div>
            </div>
            <div className="form-group">
              <label>
                <i className="fa-solid fa-car-battery" /> Battery Backup
              </label>
              <div className="toggle-row">
                <span style={{ fontSize: "0.85rem", color: "var(--color-gray-400)" }}>{form.batteryBackup ? "Available" : "None"}</span>
                <div className={`switch ${form.batteryBackup ? "on" : ""}`} onClick={() => set("batteryBackup", !form.batteryBackup)} data-testid="toggle-battery" />
              </div>
            </div>
          </div>

          <div className="form-section-label">Major appliances in use</div>
          <div className="appliances-grid" data-testid="appliances-grid">
            {APPLIANCES.map(([key, label]) => (
              <label className="checkbox-label" key={key} data-testid={`appliance-${key}`}>
                <input type="checkbox" checked={form.appliances.includes(key)} onChange={() => toggleApp(key)} />
                <span className="custom-checkbox" /> {label}
              </label>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button type="submit" className="btn btn-primary" style={{ padding: "1rem 2.5rem" }} disabled={busy} data-testid="run-analysis-btn">
              <i className="fa-solid fa-atom" /> {busy ? "Running diagnostics…" : "Run Diagnostics & Generate Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
