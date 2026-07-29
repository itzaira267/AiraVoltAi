import { AIRA_MAIN, AIRA_THINKING } from "@/lib/aira";

export const AiraAvatar = ({ size = 320, thinking = false, rings = true, float = true, className = "", testId = "aira-avatar" }) => (
  <div
    className={`aira-holo ${float ? "aira-float" : ""} ${className}`}
    style={{ width: size, height: size }}
    data-testid={testId}
  >
    {rings && (
      <>
        <span className="holo-ring" style={{ width: size, height: size }} />
        <span className="holo-ring r2" style={{ width: size * 0.86, height: size * 0.86 }} />
        <span className="holo-core" />
      </>
    )}
    <img
      src={thinking ? AIRA_THINKING : AIRA_MAIN}
      alt="Aira, the AiraVolt AI energy optimization agent"
      className="avatar-circle aira-blink"
      style={{ width: size * 0.84, height: size * 0.84 }}
      loading="lazy"
    />
    <span className="aira-eye-glow" style={{ width: size * 0.84, height: size * 0.84, borderRadius: "50%" }} />
  </div>
);

export const AiraLoader = ({ label = "Aira is thinking", step = "" }) => (
  <div className="aira-loader" data-testid="aira-loader">
    <AiraAvatar size={180} thinking rings />
    <h3>{label}</h3>
    {step ? <p className="loader-step">{step}</p> : null}
    <div className="loader-bar">
      <span />
    </div>
  </div>
);
