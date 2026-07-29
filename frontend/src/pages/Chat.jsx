import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { API, api } from "@/lib/api";
import { AIRA_MAIN, AIRA_THINKING, QUICK_PROMPTS } from "@/lib/aira";
import { useAuth } from "@/context/AuthContext";

const GREETING = {
  role: "assistant",
  content:
    "Hello, I'm **Aira**, your Energy Optimization Agent. I can analyse your audit data, explain any chart, and recommend the highest-impact actions for your facility. Ask me anything — or tap a suggestion below.",
  message_id: "greeting",
};

export default function Chat() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const windowRef = useRef(null);
  const recognitionRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/sessions");
      setSessions(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (windowRef.current) windowRef.current.scrollTop = windowRef.current.scrollHeight;
  }, [messages, thinking]);

  const openSession = async (id) => {
    setSessionId(id);
    try {
      const { data } = await api.get(`/chat/sessions/${id}`);
      setMessages(data.messages.length ? data.messages : [GREETING]);
    } catch {
      toast.error("Could not load that conversation");
    }
  };

  const newSession = () => {
    setSessionId(null);
    setMessages([GREETING]);
    setInput("");
  };

  const speak = (text) => {
    if (!speakOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[*#`_]/g, ""));
    utter.rate = 1.02;
    utter.pitch = 1.12;
    const voice = window.speechSynthesis.getVoices().find((v) => /female|zira|samantha|google uk english female/i.test(v.name));
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content, message_id: `local-${Date.now()}` }]);
    setStreaming(true);
    setThinking(true);

    let assistant = "";
    try {
      const token = localStorage.getItem("av_token");
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ session_id: sessionId, message: content }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          let evt;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.delta) {
            assistant += evt.delta;
            if (!started) {
              started = true;
              setThinking(false);
              setMessages((m) => [...m, { role: "assistant", content: assistant, message_id: "streaming" }]);
            } else {
              setMessages((m) => m.map((msg) => (msg.message_id === "streaming" ? { ...msg, content: assistant } : msg)));
            }
          }
          if (evt.done) {
            if (evt.session_id && !sessionId) setSessionId(evt.session_id);
            setMessages((m) => m.map((msg) => (msg.message_id === "streaming" ? { ...msg, message_id: `srv-${Date.now()}` } : msg)));
            loadSessions();
            speak(assistant);
          }
        }
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I couldn't reach my reasoning engine just now. Please try again in a moment.", message_id: `err-${Date.now()}` },
      ]);
    } finally {
      setThinking(false);
      setStreaming(false);
    }
  };

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast.error("Voice input is not supported in this browser");
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setListening(false);
      send(text);
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("Could not capture audio");
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const render = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((chunk, idx) =>
      chunk.startsWith("**") && chunk.endsWith("**") ? <strong key={idx}>{chunk.slice(2, -2)}</strong> : <span key={idx}>{chunk}</span>
    );

  const initials = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();

  return (
    <section className="view-section" data-testid="chat-page">
      <div className="form-header-desc">
        <span className="hero-tagline">Real-Time Assistant</span>
        <h2>Consult with Aira</h2>
        <p>Discuss bottlenecks, query conservation tactics, or ask Aira to explain your dashboard diagnostics.</p>
      </div>

      <div className="glass-card chat-container" data-testid="chat-container">
        <div className="chat-sidebar">
          <h3>Consultation Logs</h3>
          <button className="btn btn-primary btn-sm" onClick={newSession} data-testid="chat-new-session-btn">
            <i className="fa-solid fa-plus" /> New consultation
          </button>
          <div className="chat-rooms-list" data-testid="chat-sessions-list">
            {sessions.length === 0 && <p style={{ fontSize: "0.78rem", color: "var(--color-gray-500)" }}>No saved conversations yet.</p>}
            {sessions.map((s) => (
              <div
                key={s.session_id}
                className={`chat-room-item ${sessionId === s.session_id ? "active" : ""}`}
                onClick={() => openSession(s.session_id)}
                data-testid="chat-session-item"
              >
                <i className="fa-regular fa-comments" />
                <div>
                  <h4>{s.title}</h4>
                  <span style={{ fontSize: "0.68rem", color: "var(--color-gray-400)" }}>
                    {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "0.85rem" }}>
            <label className="checkbox-label" style={{ fontSize: "0.78rem" }} data-testid="chat-voice-toggle">
              <input type="checkbox" checked={speakOn} onChange={(e) => setSpeakOn(e.target.checked)} />
              <span className="custom-checkbox" /> Aira voice replies
            </label>
            <p style={{ fontSize: "0.68rem", color: "var(--color-gray-500)", marginTop: "0.5rem" }}>
              <i className="fa-solid fa-lock" /> Encrypted session
            </p>
          </div>
        </div>

        <div className="chat-main">
          <div className="chat-window" ref={windowRef} data-testid="chat-window">
            {messages.map((msg) => (
              <div key={msg.message_id} className={`chat-message ${msg.role === "user" ? "user" : "system"}`} data-testid={`chat-message-${msg.role}`}>
                {msg.role === "user" ? (
                  <div className="chat-avatar">{initials}</div>
                ) : (
                  <img src={AIRA_MAIN} alt="Aira" className="chat-avatar" />
                )}
                <div className="chat-bubble">{render(msg.content)}</div>
              </div>
            ))}
            {thinking && (
              <div className="chat-message system" data-testid="chat-thinking">
                <img src={AIRA_THINKING} alt="Aira thinking" className="chat-avatar aira-blink" />
                <div className="chat-bubble">
                  <span className="typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>{" "}
                  <span style={{ fontSize: "0.8rem", color: "var(--color-gray-400)" }}>Aira is reasoning over your data…</span>
                </div>
              </div>
            )}
          </div>

          <div className="chat-quick-replies" data-testid="chat-quick-replies">
            {QUICK_PROMPTS.map((q) => (
              <span key={q.label} className="quick-reply-chip" onClick={() => send(q.text)} data-testid="chat-quick-chip">
                {q.label}
              </span>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="chat-input-wrapper">
              <input
                type="text"
                className="chat-input"
                placeholder="Ask Aira about your energy usage…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                data-testid="chat-input"
              />
              <button
                type="button"
                className={`btn btn-secondary btn-icon mic-btn ${listening ? "recording" : ""}`}
                onClick={toggleMic}
                aria-label="Voice input"
                data-testid="chat-mic-btn"
              >
                <i className="fa-solid fa-microphone" />
              </button>
              <button type="submit" className="btn btn-primary btn-icon" disabled={streaming} aria-label="Send" data-testid="chat-send-btn">
                <i className={`fa-solid ${streaming ? "fa-spinner spin" : "fa-paper-plane"}`} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
