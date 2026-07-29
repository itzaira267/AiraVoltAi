# AiraVolt AI — Product Requirements Document

## Original Problem Statement
User owned an existing static HTML/CSS/JS site "AiraVolt AI" (an AI energy-optimization agent) and asked to transform it into a real-world, production-ready AI Energy Optimization platform for an AI Agent competition — while preserving the existing layout, navigation, futuristic glassmorphism UI, colour palette, animations, dashboard, simulator, recommendations, report and branding. Full requirements covered: animated AI mascot "Aira", complete authentication, database persistence, backend APIs, Gemini AI integration, expanded energy analysis form, live smart dashboard, AI chatbot with voice, PDF report generator, AI bill scanner, improved simulator, contact storage, profile page, notification centre, security, performance and SEO.

## User Choices (explicit)
- Backend/DB: **FastAPI + MongoDB** (platform constraint; replaces requested Node/Express + Firebase)
- Auth: **Both** JWT email/password and Emergent-managed Google login
- AI: **Gemini 3 Flash** (`gemini-3-flash-preview`) via Emergent Universal Key
- Avatar: **generated** by the agent
- Email: **skipped** — enquiries/reports stored in DB + in-app notifications instead

## Architecture
- **Frontend**: React 19 + react-router 7, custom CSS design system ported from the original `styles.css` (same palette: `#00e5ff`, `#00e676`, `#07080d`), recharts for charts, jsPDF + html2canvas for PDF, sonner for toasts, Web Speech API for voice, lazy-loaded route modules.
- **Backend**: FastAPI (`/app/backend/server.py`), all routes under `/api`, MongoDB via motor, bcrypt password hashing, opaque session tokens (7-day expiry) in `user_sessions`, Bearer-header auth (cookies unusable — platform ingress forces `Access-Control-Allow-Origin: *`).
- **AI**: `emergentintegrations.llm.chat.LlmChat` streaming; deterministic energy engine (`compute_energy`) supplies real numbers, Gemini generates narrative/recommendations (`ai_insights`) with a deterministic fallback; Gemini vision reads bills (`FileContentWithMimeType`).
- **Collections**: `users`, `user_sessions`, `login_attempts`, `password_reset_tokens`, `analyses`, `reports`, `chat_sessions`, `chat_messages`, `bills`, `favourites`, `notifications`, `contact_messages`, `email_queue`.

## Core Requirements (static)
1. Preserve original branding, navigation, glassmorphism aesthetic and all ten original views.
2. Every button, form, chart and feature must be functional — no placeholders.
3. Real calculations; no sample dashboard values.
4. Aira must appear consistently as the signature mascot.
5. All user data must persist per-authenticated-user with isolation.
6. Fully responsive across mobile/tablet/desktop.

## Implemented (2026-07-29)
- **Aira avatar**: generated semi-realistic 3D AI girl (cyan glow, white/silver outfit, holographic UI) + a "thinking" variant. Fluid-sized component with floating, blinking, rotating holo-rings and eye-glow pulse. Used in hero, Meet Aira, chat bubbles, thinking animation, all loading screens and auth pages.
- **Auth**: signup, login, logout, forgot-password + reset (token surfaced in UI since email is disabled), email verification, profile update, brute-force lockout (5 attempts / 15 min), Emergent Google OAuth (`/api/auth/session`), `ProtectedRoute` on all private pages.
- **Energy analysis**: 15-variable form (country/state/city, building type, floor area, occupants, operating hours, HVAC, lighting, bill, units, tariff, currency, solar, battery, 12 appliances) → deterministic engine + Gemini insights, saved to history.
- **Dashboard**: live efficiency score, waste %, monthly/annual savings, carbon footprint, hourly load (current vs optimized), source mix pie, weekly bars, seasonal trend, top consumers, historical comparison across audits.
- **Recommendations**: Gemini-generated actions with priority/category/payback/effort, working category filters, favourite starring.
- **Report**: branded audit document (logo, user details, facility tables, diagnostics, charts, AI summary, anomalies, remediation plan, carbon analysis) with PDF download, print stylesheet, email queue and DB versioning.
- **Bill scanner**: PDF/PNG/JPEG/WEBP upload → Gemini vision extracts units, tariff, amount, billing date, meter reading, provider → auto-fills the form and auto-runs the analysis.
- **Simulator**: 5 live sliders (LED, solar kWp, HVAC offset, appliance tier, occupancy scheduling) → offset gauge, bill savings, new bill, units saved, annual savings, carbon reduction, ROI, solar payback, capex.
- **Chat**: SSE token streaming from Gemini, thinking + typing animations, session memory persisted per conversation, session list, voice input (SpeechRecognition) and voice output (SpeechSynthesis), quick suggestion chips.
- **Contact / Profile / Notifications**: enquiries persisted with queued confirmation + admin notification; profile with 5 tabs (profile, saved reports, recent analyses, favourites, settings); notification centre with unread badge, mark-read and clear.
- **Perf/SEO**: lazy routes, Suspense loaders, OG/Twitter/description/keywords meta, reduced-motion support, `prefers-reduced-motion`, skeleton loaders.

## Verification status
- Backend: 32/32 automated tests pass (`/app/backend/tests/backend_test.py`).
- Frontend: all critical flows verified by the testing agent; mobile overflow on Landing fixed afterwards (now 0px at 390×844).

## Backlog
### P0
- None outstanding.
### P1
- Real email delivery (Resend/SendGrid) for contact confirmation, report delivery, verification and password reset.
- Report reference numbering via an atomic MongoDB counter (currently `count_documents + offset`, not race-safe).
- Split `server.py` into modules (auth / analysis / chat / reports / contact).
### P2
- Multi-facility portfolios per account and audit-over-audit savings verification.
- Real tariff/irradiance data feeds per country-state for sharper modelling.
- Admin console for contact enquiries and platform usage.
- Scheduled monthly re-audits with email digests.

## Next tasks
1. Wire a real email provider once the user supplies an API key.
2. Add atomic report numbering + modularise the backend.
3. Multi-facility support and audit-over-audit verification loop.
