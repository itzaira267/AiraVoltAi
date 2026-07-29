from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import json
import uuid
import base64
import logging
import secrets
import tempfile
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import httpx
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import (
    LlmChat,
    UserMessage,
    TextDelta,
    StreamDone,
    FileContentWithMimeType,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("airavolt")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
AI_PROVIDER = os.environ.get("AI_PROVIDER", "gemini")
AI_MODEL = os.environ.get("AI_MODEL", "gemini-3-flash-preview")

app = FastAPI(title="AiraVolt AI API")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------- helpers


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 3600,
        path="/",
    )


async def create_session(user_id: str) -> str:
    token = f"av_{secrets.token_urlsafe(40)}"
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "created_at": iso(now_utc()),
            "expires_at": iso(now_utc() + timedelta(days=7)),
        }
    )
    return token


def public_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "user_id": doc["user_id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "picture": doc.get("picture"),
        "role": doc.get("role", "user"),
        "provider": doc.get("provider", "password"),
        "email_verified": bool(doc.get("email_verified", False)),
        "settings": doc.get("settings", {"currency": "$", "notifications": True, "theme": "dark"}),
        "created_at": doc.get("created_at"),
    }


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("session_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def notify(user_id: str, title: str, message: str, kind: str = "info") -> None:
    await db.notifications.insert_one(
        {
            "notification_id": f"ntf_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": title,
            "message": message,
            "kind": kind,
            "read": False,
            "created_at": iso(now_utc()),
        }
    )


# ---------------------------------------------------------------- models


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)


class VerifyIn(BaseModel):
    token: str


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    currency: Optional[str] = None
    notifications: Optional[bool] = None


class AnalysisIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    country: str = "India"
    state: str = ""
    city: str = ""
    buildingType: str = "Home"
    floorArea: float = 1200
    occupants: int = 4
    monthlyBill: float = 180
    monthlyUnits: float = 650
    tariff: float = 0.0
    currency: str = "$"
    solarAvailable: bool = False
    batteryBackup: bool = False
    appliances: List[str] = []
    hvac: str = "Split AC"
    lighting: str = "Mixed"
    operatingHours: float = 10


class ChatIn(BaseModel):
    session_id: Optional[str] = None
    message: str
    title: Optional[str] = None


class ContactIn(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    subject: str = "General Inquiry"
    message: str = Field(min_length=5)


class SimulateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    monthlyUnits: float = 650
    monthlyBill: float = 180
    ledPercent: float = 0
    solarKwp: float = 0
    hvacOffset: float = 0
    applianceTier: int = 0
    occupancySchedule: float = 0


# ---------------------------------------------------------------- energy engine

CO2_PER_KWH = 0.000709  # metric tons per kWh
SOLAR_YIELD_PER_KWP = 120  # kWh / month

APPLIANCE_WEIGHTS = {
    "ac": 0.32,
    "heating": 0.22,
    "incandescent": 0.10,
    "led": 0.04,
    "water_heater": 0.14,
    "refrigerator": 0.11,
    "servers": 0.18,
    "machinery": 0.25,
    "standby": 0.07,
    "washing": 0.05,
    "ev": 0.20,
    "kitchen": 0.09,
}

APPLIANCE_LABELS = {
    "ac": "Air Conditioning (HVAC)",
    "heating": "Space Heating",
    "incandescent": "Incandescent Lighting",
    "led": "LED Lighting",
    "water_heater": "Electric Water Heater",
    "refrigerator": "Refrigeration",
    "servers": "Servers / IT Load",
    "machinery": "Heavy Machinery",
    "standby": "Standby / Phantom Loads",
    "washing": "Washer & Dryer",
    "ev": "EV Charging",
    "kitchen": "Kitchen Appliances",
}

BENCHMARK_KWH_PER_SQFT = {"Home": 0.55, "School": 0.62, "Office": 0.9, "Industry": 1.6, "Retail": 1.1, "Hospital": 1.9}


def compute_energy(data: AnalysisIn) -> Dict[str, Any]:
    units = max(float(data.monthlyUnits), 1.0)
    bill = max(float(data.monthlyBill), 1.0)
    tariff = float(data.tariff) if data.tariff and data.tariff > 0 else round(bill / units, 4)
    area = max(float(data.floorArea), 100.0)
    occupants = max(int(data.occupants), 1)

    benchmark_intensity = BENCHMARK_KWH_PER_SQFT.get(data.buildingType, 0.7)
    expected = benchmark_intensity * area
    intensity = units / area
    ratio = units / max(expected, 1.0)

    # --- waste model
    waste = 0.06
    apps = set(data.appliances or [])
    if "incandescent" in apps:
        waste += 0.08
    if data.lighting == "Incandescent":
        waste += 0.05
    elif data.lighting == "Mixed":
        waste += 0.025
    if "standby" in apps:
        waste += 0.055
    if "ac" in apps or "heating" in apps:
        waste += 0.06
    if data.hvac in ("Window AC", "Central AC (Old)"):
        waste += 0.05
    if "water_heater" in apps:
        waste += 0.03
    if "machinery" in apps:
        waste += 0.04
    if "servers" in apps:
        waste += 0.03
    if data.operatingHours > 12:
        waste += 0.03
    if ratio > 1.25:
        waste += min((ratio - 1.25) * 0.2, 0.09)
    if "led" in apps:
        waste -= 0.03
    if data.solarAvailable:
        waste -= 0.02
    waste = round(min(max(waste, 0.04), 0.42), 4)

    score = int(round(max(12, min(97, 100 - waste * 180 - max(0, ratio - 1) * 18 + (8 if "led" in apps else 0) + (6 if data.solarAvailable else 0)))))

    monthly_savings = round(bill * waste * 0.78, 2)
    annual_savings = round(monthly_savings * 12, 2)
    waste_units = round(units * waste, 1)
    co2 = round(units * CO2_PER_KWH, 3)
    co2_saved = round(waste_units * CO2_PER_KWH * 12, 3)
    trees = int(round(co2 * 1000 / 21.8))

    # --- consumers breakdown
    active = [a for a in apps if a in APPLIANCE_WEIGHTS]
    if not active:
        active = ["refrigerator", "led"]
    total_w = sum(APPLIANCE_WEIGHTS[a] for a in active)
    consumers = sorted(
        [
            {
                "key": a,
                "name": APPLIANCE_LABELS[a],
                "units": round(units * APPLIANCE_WEIGHTS[a] / total_w, 1),
                "cost": round(bill * APPLIANCE_WEIGHTS[a] / total_w, 2),
                "share": round(100 * APPLIANCE_WEIGHTS[a] / total_w, 1),
            }
            for a in active
        ],
        key=lambda x: -x["units"],
    )

    # --- hourly load curve
    base = units / 30 / 24
    shape = [0.55, 0.5, 0.48, 0.47, 0.5, 0.65, 0.9, 1.1, 1.15, 1.1, 1.05, 1.1, 1.2, 1.25, 1.3, 1.35, 1.4, 1.55, 1.75, 1.7, 1.45, 1.15, 0.85, 0.65]
    if data.buildingType in ("Office", "School"):
        shape = [0.35, 0.3, 0.3, 0.3, 0.35, 0.5, 0.8, 1.25, 1.6, 1.75, 1.8, 1.7, 1.5, 1.75, 1.8, 1.7, 1.4, 1.0, 0.7, 0.55, 0.45, 0.4, 0.38, 0.36]
    elif data.buildingType == "Industry":
        shape = [1.0] * 24
    hourly = [{"hour": f"{h:02d}:00", "load": round(base * shape[h], 2), "optimized": round(base * shape[h] * (1 - waste), 2)} for h in range(24)]

    # --- weekly / monthly series
    weekday_factor = [1.0, 0.98, 1.01, 1.03, 1.06, 1.12, 1.08]
    if data.buildingType in ("Office", "School"):
        weekday_factor = [1.12, 1.1, 1.08, 1.09, 1.05, 0.55, 0.45]
    daily = units / 30
    weekly = [
        {"day": d, "units": round(daily * f, 1), "cost": round(daily * f * tariff, 2)}
        for d, f in zip(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], weekday_factor)
    ]
    season = [0.92, 0.9, 1.0, 1.12, 1.28, 1.22, 1.1, 1.08, 1.02, 0.95, 0.9, 0.94]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_series = [
        {"month": m, "units": round(units * f, 0), "optimized": round(units * f * (1 - waste * 0.78), 0), "cost": round(units * f * tariff, 2)}
        for m, f in zip(months, season)
    ]

    solar_kwp = round(min(area / 120, 25), 1)
    solar_gen = round(solar_kwp * SOLAR_YIELD_PER_KWP, 0)
    solar_cost = round(solar_kwp * 850, 0)
    solar_monthly_value = round(min(solar_gen, units) * tariff, 2)
    payback = round(solar_cost / max(solar_monthly_value * 12, 1), 1)

    sources = [
        {"name": "Grid", "value": round(100 - (30 if data.solarAvailable else 0), 1)},
        {"name": "Solar", "value": 30.0 if data.solarAvailable else 0.0},
    ]
    if not data.solarAvailable:
        sources = [{"name": "Grid", "value": 100.0}, {"name": "Solar (potential)", "value": 0.0}]

    return {
        "tariff": tariff,
        "efficiencyScore": score,
        "wastePercent": round(waste * 100, 1),
        "wasteUnits": waste_units,
        "monthlySavings": monthly_savings,
        "annualSavings": annual_savings,
        "carbonFootprint": co2,
        "carbonSavedAnnual": co2_saved,
        "treesEquivalent": trees,
        "energyIntensity": round(intensity, 3),
        "benchmarkIntensity": round(benchmark_intensity, 3),
        "benchmarkRatio": round(ratio, 2),
        "perCapita": round(units / occupants, 1),
        "topConsumers": consumers,
        "hourly": hourly,
        "weekly": weekly,
        "monthlySeries": monthly_series,
        "sources": sources,
        "solar": {
            "recommendedKwp": solar_kwp,
            "monthlyGeneration": solar_gen,
            "capex": solar_cost,
            "monthlyValue": solar_monthly_value,
            "paybackYears": payback,
        },
    }


def fallback_insights(data: AnalysisIn, m: Dict[str, Any]) -> Dict[str, Any]:
    cur = data.currency
    recs = []
    apps = set(data.appliances or [])
    if "incandescent" in apps or data.lighting in ("Incandescent", "Mixed"):
        recs.append({"title": "Transition to full LED lighting", "category": "quick", "priority": "high", "detail": "Replace remaining incandescent/CFL fixtures with ENERGY STAR LEDs to cut lighting load by up to 80%.", "monthlySaving": round(m["monthlySavings"] * 0.22, 2), "payback": "2-4 months", "effort": "Low"})
    if "standby" in apps:
        recs.append({"title": "Eliminate phantom standby loads", "category": "quick", "priority": "medium", "detail": "Group electronics on smart power strips with occupancy cut-off to remove idle draw.", "monthlySaving": round(m["monthlySavings"] * 0.13, 2), "payback": "1-2 months", "effort": "Low"})
    if "ac" in apps or "heating" in apps:
        recs.append({"title": "Install smart HVAC thermostat scheduling", "category": "infrastructure", "priority": "high", "detail": "Apply a 2°C setpoint buffer plus vacancy schedules to reduce compressor cycles.", "monthlySaving": round(m["monthlySavings"] * 0.3, 2), "payback": "6-9 months", "effort": "Medium"})
    recs.append({"title": f"Deploy {m['solar']['recommendedKwp']} kWp rooftop solar", "category": "renewables", "priority": "high", "detail": f"Offsets roughly {m['solar']['monthlyGeneration']} kWh/month of daytime grid draw. Estimated payback {m['solar']['paybackYears']} years.", "monthlySaving": m["solar"]["monthlyValue"], "payback": f"{m['solar']['paybackYears']} years", "effort": "High"})
    recs.append({"title": "Shift flexible loads to off-peak tariff windows", "category": "quick", "priority": "medium", "detail": "Run water heating, laundry and EV charging outside peak hours to reduce blended tariff.", "monthlySaving": round(m["monthlySavings"] * 0.1, 2), "payback": "Immediate", "effort": "Low"})
    anomalies = [
        {"title": "Above-benchmark intensity", "detail": f"Your consumption is {m['benchmarkRatio']}x the typical {data.buildingType.lower()} baseline for {int(data.floorArea)} sq ft."},
        {"title": "Detected wastage band", "detail": f"Approximately {m['wastePercent']}% ({m['wasteUnits']} kWh) of monthly consumption is recoverable."},
    ]
    return {
        "summary": f"Aira analysed {int(data.monthlyUnits)} kWh across a {data.buildingType.lower()} facility of {int(data.floorArea)} sq ft. Efficiency scores {m['efficiencyScore']}/100 with {m['wastePercent']}% recoverable waste, worth about {cur}{m['annualSavings']} per year.",
        "recommendations": recs,
        "anomalies": anomalies,
        "aiGenerated": False,
    }


async def ai_insights(data: AnalysisIn, m: Dict[str, Any]) -> Dict[str, Any]:
    if not EMERGENT_LLM_KEY:
        return fallback_insights(data, m)
    prompt = f"""You are Aira, an expert energy auditor. Analyse this facility and return STRICT JSON only.

FACILITY: {data.buildingType}, {data.city}, {data.state}, {data.country}
Floor area: {data.floorArea} sq ft | Occupants: {data.occupants} | Operating hours/day: {data.operatingHours}
Monthly units: {data.monthlyUnits} kWh | Monthly bill: {data.currency}{data.monthlyBill} | Tariff: {m['tariff']}
HVAC: {data.hvac} | Lighting: {data.lighting} | Solar: {data.solarAvailable} | Battery: {data.batteryBackup}
Appliances: {', '.join(data.appliances) or 'none listed'}

COMPUTED METRICS: efficiency score {m['efficiencyScore']}/100, waste {m['wastePercent']}%, recoverable {m['wasteUnits']} kWh/mo,
monthly savings potential {data.currency}{m['monthlySavings']}, annual {data.currency}{m['annualSavings']},
carbon {m['carbonFootprint']} tons/mo, benchmark ratio {m['benchmarkRatio']}x,
top consumers: {json.dumps(m['topConsumers'][:5])}

Return JSON with this exact shape:
{{
 "summary": "3-4 sentence executive summary referencing the real numbers above",
 "recommendations": [{{"title":"","category":"quick|infrastructure|renewables|behaviour","priority":"high|medium|low","detail":"2 sentences, specific and actionable","monthlySaving":0,"payback":"","effort":"Low|Medium|High"}}],
 "anomalies": [{{"title":"","detail":""}}]
}}
Provide 6 recommendations and 3-4 anomalies. monthlySaving values must sum to roughly {m['monthlySavings']}. No markdown fences."""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"analysis-{uuid.uuid4().hex[:8]}", system_message="You are Aira, a precise energy analytics engine that outputs only valid JSON.").with_model(AI_PROVIDER, AI_MODEL)
        buf = ""
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                buf += ev.content
            elif isinstance(ev, StreamDone):
                break
        parsed = parse_json_block(buf)
        if parsed and parsed.get("recommendations"):
            parsed["aiGenerated"] = True
            return parsed
    except Exception as exc:  # noqa: BLE001
        logger.warning("AI insight generation failed: %s", exc)
    return fallback_insights(data, m)


def parse_json_block(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------- auth routes


@api.get("/")
async def root():
    return {"service": "AiraVolt AI", "status": "operational", "model": AI_MODEL}


@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    verify_token = secrets.token_urlsafe(24)
    await db.users.insert_one(
        {
            "user_id": user_id,
            "email": email,
            "name": payload.name.strip(),
            "password_hash": hash_password(payload.password),
            "role": "user",
            "provider": "password",
            "email_verified": False,
            "verify_token": verify_token,
            "settings": {"currency": "$", "notifications": True, "theme": "dark"},
            "created_at": iso(now_utc()),
        }
    )
    token = await create_session(user_id)
    set_session_cookie(response, token)
    await notify(user_id, "Welcome to AiraVolt AI", "Your account is ready. Run your first energy audit to unlock Aira's insights.", "success")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": public_user(user), "session_token": token, "verification_token": verify_token}


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower().strip()
    ident = f"{request.client.host if request.client else 'unknown'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked = datetime.fromisoformat(attempt["last_at"]) + timedelta(minutes=15)
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        if locked > now_utc():
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": ident})

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"last_at": iso(now_utc())}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": ident})
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {"user": public_user(user), "session_token": token}


@api.post("/auth/session")
async def google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google session validation failed")
    profile = r.json()
    email = (profile.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": profile.get("name") or existing.get("name", ""), "picture": profile.get("picture"), "email_verified": True}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": profile.get("name", ""),
                "picture": profile.get("picture"),
                "role": "user",
                "provider": "google",
                "email_verified": True,
                "settings": {"currency": "$", "notifications": True, "theme": "dark"},
                "created_at": iso(now_utc()),
            }
        )
        await notify(user_id, "Welcome to AiraVolt AI", "Signed in with Google. Run your first energy audit to unlock Aira's insights.", "success")

    token = profile.get("session_token") or f"av_{secrets.token_urlsafe(40)}"
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "created_at": iso(now_utc()),
            "expires_at": iso(now_utc() + timedelta(days=7)),
        }
    )
    set_session_cookie(response, token)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": public_user(user), "session_token": token}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"success": True}


@api.post("/auth/verify-email")
async def verify_email(payload: VerifyIn, user: dict = Depends(get_current_user)):
    if user.get("verify_token") != payload.token:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"email_verified": True}, "$unset": {"verify_token": ""}})
    await notify(user["user_id"], "Email verified", "Your email address has been confirmed.", "success")
    return {"success": True}


@api.post("/auth/resend-verification")
async def resend_verification(user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        return {"success": True, "already_verified": True}
    token = secrets.token_urlsafe(24)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"verify_token": token}})
    await notify(user["user_id"], "Verification code issued", "A new email verification code was generated for your account.", "info")
    return {"success": True, "verification_token": token}


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"success": True, "message": "If that account exists, a reset link has been issued."}
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one(
        {
            "token": token,
            "user_id": user["user_id"],
            "used": False,
            "expires_at": now_utc() + timedelta(hours=1),
        }
    )
    logger.info("Password reset token for %s: %s", email, token)
    return {"success": True, "message": "Reset token issued.", "reset_token": token}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": payload.token}, {"_id": 0})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or already used reset token")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=400, detail="Reset token expired")
    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    await db.user_sessions.delete_many({"user_id": rec["user_id"]})
    return {"success": True}


@api.put("/auth/profile")
async def update_profile(payload: SettingsIn, user: dict = Depends(get_current_user)):
    updates: Dict[str, Any] = {}
    if payload.name:
        updates["name"] = payload.name.strip()
    settings = dict(user.get("settings") or {})
    if payload.currency:
        settings["currency"] = payload.currency
    if payload.notifications is not None:
        settings["notifications"] = payload.notifications
    updates["settings"] = settings
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return public_user(fresh)


# ---------------------------------------------------------------- analysis


@api.post("/analysis")
async def run_analysis(payload: AnalysisIn, user: dict = Depends(get_current_user)):
    metrics = compute_energy(payload)
    insights = await ai_insights(payload, metrics)
    analysis_id = f"an_{uuid.uuid4().hex[:12]}"
    doc = {
        "analysis_id": analysis_id,
        "user_id": user["user_id"],
        "input": payload.model_dump(),
        "metrics": metrics,
        "insights": insights,
        "created_at": iso(now_utc()),
    }
    await db.analyses.insert_one(dict(doc))
    await notify(user["user_id"], "AI Analysis Complete", f"Efficiency score {metrics['efficiencyScore']}/100 with {metrics['wastePercent']}% recoverable waste.", "success")
    doc.pop("_id", None)
    return doc


@api.get("/analysis")
async def list_analyses(user: dict = Depends(get_current_user)):
    docs = await db.analyses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return docs


@api.get("/analysis/latest")
async def latest_analysis(user: dict = Depends(get_current_user)):
    doc = await db.analyses.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No analysis found")
    return doc


@api.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, user: dict = Depends(get_current_user)):
    doc = await db.analyses.find_one({"analysis_id": analysis_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return doc


@api.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str, user: dict = Depends(get_current_user)):
    res = await db.analyses.delete_one({"analysis_id": analysis_id, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"success": True}


@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    latest = await db.analyses.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    history = await db.analyses.find({"user_id": user["user_id"]}, {"_id": 0, "metrics.efficiencyScore": 1, "metrics.monthlySavings": 1, "metrics.wastePercent": 1, "input.monthlyUnits": 1, "created_at": 1, "analysis_id": 1}).sort("created_at", -1).to_list(12)
    reports = await db.reports.count_documents({"user_id": user["user_id"]})
    return {
        "hasData": latest is not None,
        "latest": latest,
        "history": list(reversed(history)),
        "counts": {
            "analyses": await db.analyses.count_documents({"user_id": user["user_id"]}),
            "reports": reports,
            "chats": await db.chat_sessions.count_documents({"user_id": user["user_id"]}),
        },
    }


@api.post("/simulate")
async def simulate(payload: SimulateIn, user: dict = Depends(get_current_user)):
    units = max(payload.monthlyUnits, 1.0)
    bill = max(payload.monthlyBill, 1.0)
    tariff = bill / units

    led_saving = units * 0.12 * (payload.ledPercent / 100)
    hvac_saving = units * 0.07 * payload.hvacOffset
    tier_saving = units * [0, 0.08, 0.15][max(0, min(2, int(payload.applianceTier)))]
    schedule_saving = units * 0.05 * (payload.occupancySchedule / 100)
    solar_gen = min(payload.solarKwp * SOLAR_YIELD_PER_KWP, units * 0.9)

    efficiency_saving = min(led_saving + hvac_saving + tier_saving + schedule_saving, units * 0.45)
    total_units_saved = min(efficiency_saving + solar_gen, units * 0.95)
    bill_saving = round(total_units_saved * tariff, 2)
    new_bill = round(max(bill - bill_saving, 0), 2)
    co2_reduction = round(total_units_saved * CO2_PER_KWH, 4)
    capex = round(payload.solarKwp * 850 + (payload.ledPercent / 100) * 350 + payload.hvacOffset * 120 + [0, 900, 2200][max(0, min(2, int(payload.applianceTier)))], 0)
    payback_years = round(capex / max(bill_saving * 12, 1), 1) if capex else 0.0
    solar_payback = round((payload.solarKwp * 850) / max(min(solar_gen, units) * tariff * 12, 1), 1) if payload.solarKwp else 0.0

    return {
        "unitsSaved": round(total_units_saved, 1),
        "billSaving": bill_saving,
        "newMonthlyBill": new_bill,
        "annualSaving": round(bill_saving * 12, 2),
        "carbonReduction": co2_reduction,
        "carbonReductionAnnual": round(co2_reduction * 12, 3),
        "offsetPercent": round(100 * total_units_saved / units, 1),
        "capex": capex,
        "roiYears": payback_years,
        "solarPaybackYears": solar_payback,
        "solarGeneration": round(solar_gen, 0),
    }


# ---------------------------------------------------------------- chat


AIRA_SYSTEM = """You are Aira, the AI Energy Optimization Agent of AiraVolt AI.
You are warm, precise and consultative. You explain energy concepts clearly, reference the user's
actual audit numbers whenever they are provided, and always end complex answers with a concrete next step.
Keep answers under 180 words unless the user asks for depth. Use short paragraphs and bullet points.
Never invent numbers that contradict the provided facility context."""


async def build_context(user_id: str) -> str:
    doc = await db.analyses.find_one({"user_id": user_id}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        return "The user has not completed an energy audit yet. Encourage them to run the Energy Analysis form."
    i, m = doc["input"], doc["metrics"]
    return (
        f"FACILITY CONTEXT: {i['buildingType']} in {i.get('city','')} {i.get('state','')} {i.get('country','')}, "
        f"{i['floorArea']} sq ft, {i['occupants']} occupants, {i['monthlyUnits']} kWh/mo, bill {i['currency']}{i['monthlyBill']}, "
        f"tariff {m['tariff']}, HVAC {i['hvac']}, lighting {i['lighting']}, solar {i['solarAvailable']}. "
        f"METRICS: efficiency {m['efficiencyScore']}/100, waste {m['wastePercent']}%, recoverable {m['wasteUnits']} kWh/mo, "
        f"monthly saving potential {i['currency']}{m['monthlySavings']}, annual {i['currency']}{m['annualSavings']}, "
        f"carbon {m['carbonFootprint']} tons/mo, top consumers "
        f"{', '.join(c['name'] + ' ' + str(c['share']) + '%' for c in m['topConsumers'][:4])}."
    )


@api.get("/chat/sessions")
async def chat_sessions(user: dict = Depends(get_current_user)):
    return await db.chat_sessions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(50)


@api.get("/chat/sessions/{session_id}")
async def chat_history(session_id: str, user: dict = Depends(get_current_user)):
    sess = await db.chat_sessions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Chat session not found")
    msgs = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"session": sess, "messages": msgs}


@api.delete("/chat/sessions/{session_id}")
async def delete_chat(session_id: str, user: dict = Depends(get_current_user)):
    await db.chat_sessions.delete_one({"session_id": session_id, "user_id": user["user_id"]})
    await db.chat_messages.delete_many({"session_id": session_id})
    return {"success": True}


@api.post("/chat")
async def chat(payload: ChatIn, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    session_id = payload.session_id or f"chat_{uuid.uuid4().hex[:12]}"
    sess = await db.chat_sessions.find_one({"session_id": session_id, "user_id": user_id}, {"_id": 0})
    if not sess:
        await db.chat_sessions.insert_one(
            {
                "session_id": session_id,
                "user_id": user_id,
                "title": (payload.title or payload.message)[:48],
                "created_at": iso(now_utc()),
                "updated_at": iso(now_utc()),
            }
        )

    await db.chat_messages.insert_one(
        {"message_id": f"msg_{uuid.uuid4().hex[:10]}", "session_id": session_id, "user_id": user_id, "role": "user", "content": payload.message, "created_at": iso(now_utc())}
    )

    history = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(30)
    context = await build_context(user_id)
    transcript = "\n".join(f"{'User' if m['role'] == 'user' else 'Aira'}: {m['content']}" for m in history[-12:])
    prompt = f"{context}\n\nCONVERSATION SO FAR:\n{transcript}\n\nRespond as Aira to the latest user message."

    async def gen():
        full = ""
        try:
            chat_client = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=AIRA_SYSTEM,
            ).with_model(AI_PROVIDER, AI_MODEL)
            async for ev in chat_client.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:  # noqa: BLE001
            logger.error("Chat stream failed: %s", exc)
            if not full:
                full = "I hit a temporary connection issue reaching my reasoning engine. Please try again in a moment."
                yield f"data: {json.dumps({'delta': full})}\n\n"
        await db.chat_messages.insert_one(
            {"message_id": f"msg_{uuid.uuid4().hex[:10]}", "session_id": session_id, "user_id": user_id, "role": "assistant", "content": full, "created_at": iso(now_utc())}
        )
        await db.chat_sessions.update_one({"session_id": session_id}, {"$set": {"updated_at": iso(now_utc())}})
        yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------- bill scanner


@api.post("/bill/scan")
async def scan_bill(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    allowed = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf"}
    mime = file.content_type or ""
    if mime not in allowed:
        raise HTTPException(status_code=400, detail="Upload a PNG, JPEG, WEBP image or a PDF electricity bill")
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=allowed[mime])
    tmp.write(raw)
    tmp.close()

    prompt = """Extract electricity bill data. Return STRICT JSON only, no markdown:
{"units": number|null, "tariff": number|null, "billAmount": number|null, "billingDate": "YYYY-MM-DD"|null,
 "meterReading": number|null, "consumerName": string|null, "provider": string|null, "currency": string|null,
 "billingPeriod": string|null, "confidence": 0-1}
units = kWh consumed this billing cycle. tariff = cost per kWh (derive from amount/units if absent)."""

    extracted: Dict[str, Any] = {}
    try:
        chat_client = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"bill-{uuid.uuid4().hex[:8]}", system_message="You extract structured data from utility bills and output only valid JSON.").with_model(AI_PROVIDER, AI_MODEL)
        buf = ""
        async for ev in chat_client.stream_message(UserMessage(text=prompt, file_contents=[FileContentWithMimeType(file_path=tmp.name, mime_type=mime)])):
            if isinstance(ev, TextDelta):
                buf += ev.content
            elif isinstance(ev, StreamDone):
                break
        extracted = parse_json_block(buf) or {}
    except Exception as exc:  # noqa: BLE001
        logger.error("Bill scan failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not read the bill. Try a clearer image or PDF.")
    finally:
        os.unlink(tmp.name)

    if extracted.get("units") and extracted.get("billAmount") and not extracted.get("tariff"):
        extracted["tariff"] = round(float(extracted["billAmount"]) / float(extracted["units"]), 4)

    record = {
        "bill_id": f"bill_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "filename": file.filename,
        "mime": mime,
        "extracted": extracted,
        "created_at": iso(now_utc()),
    }
    await db.bills.insert_one(dict(record))
    await notify(user["user_id"], "Bill Uploaded", f"Extracted {extracted.get('units') or '—'} kWh from {file.filename}.", "info")
    record.pop("_id", None)
    return record


@api.get("/bill")
async def list_bills(user: dict = Depends(get_current_user)):
    return await db.bills.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(30)


# ---------------------------------------------------------------- reports


@api.post("/reports")
async def create_report(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    analysis_id = body.get("analysis_id")
    doc = await db.analyses.find_one({"analysis_id": analysis_id, "user_id": user["user_id"]}, {"_id": 0}) if analysis_id else await db.analyses.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="Run an energy analysis before generating a report")
    seq = await db.reports.count_documents({}) + 93041
    report = {
        "report_id": f"rep_{uuid.uuid4().hex[:12]}",
        "reference": f"AV-{seq}-A",
        "user_id": user["user_id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "analysis_id": doc["analysis_id"],
        "input": doc["input"],
        "metrics": doc["metrics"],
        "insights": doc["insights"],
        "created_at": iso(now_utc()),
    }
    await db.reports.insert_one(dict(report))
    await notify(user["user_id"], "Report Generated", f"Energy health report {report['reference']} is ready to download.", "success")
    report.pop("_id", None)
    return report


@api.get("/reports")
async def list_reports(user: dict = Depends(get_current_user)):
    return await db.reports.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api.get("/reports/{report_id}")
async def get_report(report_id: str, user: dict = Depends(get_current_user)):
    doc = await db.reports.find_one({"report_id": report_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return doc


@api.delete("/reports/{report_id}")
async def delete_report(report_id: str, user: dict = Depends(get_current_user)):
    res = await db.reports.delete_one({"report_id": report_id, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"success": True}


@api.post("/reports/{report_id}/email")
async def email_report(report_id: str, user: dict = Depends(get_current_user)):
    doc = await db.reports.find_one({"report_id": report_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.email_queue.insert_one(
        {
            "queue_id": f"eq_{uuid.uuid4().hex[:12]}",
            "to": user["email"],
            "subject": f"Your AiraVolt AI Energy Report {doc['reference']}",
            "report_id": report_id,
            "status": "queued",
            "created_at": iso(now_utc()),
        }
    )
    await notify(user["user_id"], "Report queued for email", f"{doc['reference']} will be delivered to {user['email']}.", "info")
    return {"success": True, "queued_to": user["email"], "delivery": "queued"}


# ---------------------------------------------------------------- favourites


@api.post("/favourites")
async def toggle_favourite(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    title = body.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    existing = await db.favourites.find_one({"user_id": user["user_id"], "title": title})
    if existing:
        await db.favourites.delete_one({"_id": existing["_id"]})
        return {"favourited": False}
    await db.favourites.insert_one(
        {
            "favourite_id": f"fav_{uuid.uuid4().hex[:10]}",
            "user_id": user["user_id"],
            "title": title,
            "detail": body.get("detail", ""),
            "category": body.get("category", "quick"),
            "monthlySaving": body.get("monthlySaving", 0),
            "created_at": iso(now_utc()),
        }
    )
    return {"favourited": True}


@api.get("/favourites")
async def list_favourites(user: dict = Depends(get_current_user)):
    return await db.favourites.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


# ---------------------------------------------------------------- notifications


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"items": items, "unread": sum(1 for i in items if not i["read"])}


@api.post("/notifications/read")
async def mark_read(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    nid = body.get("notification_id")
    q = {"user_id": user["user_id"]}
    if nid:
        q["notification_id"] = nid
    await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"success": True}


@api.delete("/notifications")
async def clear_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.delete_many({"user_id": user["user_id"]})
    return {"success": True}


# ---------------------------------------------------------------- contact


@api.post("/contact")
async def contact(payload: ContactIn, request: Request):
    doc = {
        "message_id": f"cnt_{uuid.uuid4().hex[:12]}",
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "subject": payload.subject,
        "message": payload.message.strip(),
        "status": "new",
        "created_at": iso(now_utc()),
    }
    await db.contact_messages.insert_one(dict(doc))
    await db.email_queue.insert_many(
        [
            {"queue_id": f"eq_{uuid.uuid4().hex[:12]}", "to": doc["email"], "subject": "We received your AiraVolt AI enquiry", "status": "queued", "created_at": iso(now_utc())},
            {"queue_id": f"eq_{uuid.uuid4().hex[:12]}", "to": os.environ.get("ADMIN_EMAIL", "admin@airavolt.ai"), "subject": f"New enquiry from {doc['name']}", "status": "queued", "created_at": iso(now_utc())},
        ]
    )
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "user_id": 1})
    if admin:
        await notify(admin["user_id"], "New contact enquiry", f"{doc['name']} ({doc['email']}): {doc['subject']}", "info")
    doc.pop("_id", None)
    return {"success": True, "message": doc}


@api.get("/contact")
async def list_contact(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------------------------------------------------------------- startup

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.analyses.create_index([("user_id", 1), ("created_at", -1)])
    await db.chat_messages.create_index([("session_id", 1), ("created_at", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@airavolt.ai").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "AiraVolt@2026")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one(
            {
                "user_id": f"user_{uuid.uuid4().hex[:12]}",
                "email": admin_email,
                "name": "AiraVolt Admin",
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "provider": "password",
                "email_verified": True,
                "settings": {"currency": "$", "notifications": True, "theme": "dark"},
                "created_at": iso(now_utc()),
            }
        )
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
    logger.info("AiraVolt AI backend ready (model=%s)", AI_MODEL)


@app.on_event("shutdown")
async def shutdown():
    client.close()
