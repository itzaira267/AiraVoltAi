import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "Enterprise Enquiry", message: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/contact", form);
      setSent(true);
      setForm({ name: "", email: "", subject: "Enterprise Enquiry", message: "" });
      toast.success("Enquiry stored — confirmation queued to your inbox");
    } catch (e2) {
      toast.error(errMsg(e2, "Could not send your enquiry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view-section" data-testid="contact-page">
      <div className="form-header-desc">
        <span className="hero-tagline">Get In Touch</span>
        <h2>Connect with the AiraVolt Team</h2>
        <p>Questions about agent integration layers or custom enterprise scaling plans? Send us a query below.</p>
      </div>

      <div className="glass-card contact-container" data-testid="contact-card">
        <div className="contact-info">
          <div>
            <h3>Enterprise Channels</h3>
            <p style={{ fontSize: "0.89rem", marginTop: "0.5rem" }}>
              For large-scale industrial grids or university campuses running batch agent instances.
            </p>
          </div>
          {[
            { icon: "fa-regular fa-envelope", title: "Email Support", body: "partner@airavolt.ai" },
            { icon: "fa-solid fa-map-location-dot", title: "Corporate HQ", body: "404 Cyber Corridor, Tech Park 2, San Francisco, CA" },
            { icon: "fa-solid fa-satellite-dish", title: "Agent API Status", body: "All nodes operational", ok: true },
          ].map((c) => (
            <div className="contact-item" key={c.title}>
              <div className="contact-icon">
                <i className={c.icon} />
              </div>
              <div className="contact-text">
                <h3>{c.title}</h3>
                <p style={c.ok ? { color: "var(--color-emerald)", fontWeight: 600 } : undefined}>
                  {c.ok && <i className="fa-solid fa-circle-check" />} {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div>
          <form className="contact-form" onSubmit={submit} data-testid="contact-form">
            <div className="form-group">
              <label htmlFor="cname">Full Name</label>
              <input id="cname" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} minLength={2} required data-testid="contact-name" />
            </div>
            <div className="form-group">
              <label htmlFor="cemail">Email Address</label>
              <input id="cemail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required data-testid="contact-email" />
            </div>
            <div className="form-group">
              <label htmlFor="csubject">Subject</label>
              <select id="csubject" value={form.subject} onChange={(e) => set("subject", e.target.value)} data-testid="contact-subject">
                {["Enterprise Enquiry", "Technical Support", "Partnership", "Billing", "Other"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="cmsg">Message / Inquiry Details</label>
              <textarea id="cmsg" rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} minLength={5} required data-testid="contact-message" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy} data-testid="contact-submit-btn">
              <i className={`fa-regular ${busy ? "fa-hourglass" : "fa-paper-plane"}`} /> {busy ? "Transmitting…" : "Send Inquiry"}
            </button>
          </form>

          {sent && (
            <div className="glass-card" style={{ textAlign: "center", padding: "2rem", borderColor: "var(--color-emerald)", marginTop: "1.5rem" }} data-testid="contact-success">
              <i className="fa-solid fa-circle-check" style={{ fontSize: "2.5rem", color: "var(--color-emerald)", marginBottom: "0.75rem" }} />
              <h3>Message Transmitted</h3>
              <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                Your enquiry is stored in our system. A confirmation has been queued to your inbox and our team has been notified.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
