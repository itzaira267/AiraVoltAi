import { AIRA_MAIN, AIRA_THINKING } from "@/lib/aira";

export const AiraAvatar = ({ size = 320, thinking = false, rings = true, float = true, className = "", testId = "aira-avatar" }) => (
  <div
    className={`aira-holo ${float ? "aira-float" : ""} ${className}`}
    style={{ "--aira-size": `${size}px` }}
    data-testid={testId}
  >
    {rings && (
      <>
        <span className="holo-ring" />
        <span className="holo-ring r2" />
        <span className="holo-core" />
      </>
    )}
    <img
      src={thinking ? AIRA_THINKING : AIRA_MAIN}
      alt="Aira, the AiraVolt AI energy optimization agent"
      className="avatar-circle aira-blink"
      loading="lazy"
    />
    <span className="aira-eye-glow" />
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
