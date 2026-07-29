import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="app-footer" data-testid="app-footer">
    <div className="footer-container">
      <div>
        <div className="logo" style={{ marginBottom: "0.5rem" }}>
          <i className="fa-solid fa-bolt-lightning logo-icon" />
          <span className="logo-text">AiraVolt AI</span>
        </div>
        <p className="footer-copy">© {new Date().getFullYear()} AiraVolt AI · Analyze. Optimize. Sustain.</p>
      </div>
      <nav className="footer-nav">
        <Link to="/about">About</Link>
        <Link to="/meet-aira">Meet Aira</Link>
        <Link to="/analysis">Energy Audit</Link>
        <Link to="/simulator">Simulator</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <div className="footer-socials">
        <a href="https://github.com" className="social-link" aria-label="GitHub" target="_blank" rel="noreferrer">
          <i className="fa-brands fa-github" />
        </a>
        <a href="https://linkedin.com" className="social-link" aria-label="LinkedIn" target="_blank" rel="noreferrer">
          <i className="fa-brands fa-linkedin" />
        </a>
        <a href="https://x.com" className="social-link" aria-label="X" target="_blank" rel="noreferrer">
          <i className="fa-brands fa-x-twitter" />
        </a>
      </div>
    </div>
  </footer>
);
