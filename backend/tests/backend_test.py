"""AiraVolt AI backend test suite."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://aira-energy-opt.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@airavolt.ai"
ADMIN_PASSWORD = "AiraVolt@2026"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def user_creds():
    email = f"test.user.{uuid.uuid4().hex[:8]}@airavolt.ai"
    return {"name": "Test User", "email": email, "password": "Test@1234"}


@pytest.fixture(scope="session")
def user_token(user_creds):
    r = requests.post(f"{API}/auth/register", json=user_creds, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    return data["session_token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- health ----------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "operational"


# ---------------- auth ----------------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert admin_token.startswith("av_") or len(admin_token) > 20

    def test_admin_login_wrong_pw(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-password-xyz"}, timeout=15)
        assert r.status_code in (401, 429)

    def test_signup_new_user(self, user_token, user_creds):
        r = requests.get(f"{API}/auth/me", headers=h(user_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == user_creds["email"].lower()

    def test_signup_duplicate(self, user_creds):
        r = requests.post(f"{API}/auth/register", json=user_creds, timeout=15)
        assert r.status_code == 400

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_google_session_invalid(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "invalid-xxx"}, timeout=20)
        assert r.status_code == 401

    def test_forgot_reset_flow(self):
        # create isolated user
        email = f"reset.{uuid.uuid4().hex[:8]}@airavolt.ai"
        pw1 = "Init@1234"
        r = requests.post(f"{API}/auth/register", json={"name": "Reset User", "email": email, "password": pw1})
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        token = r.json().get("reset_token")
        assert token
        pw2 = "New@98765"
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": pw2})
        assert r.status_code == 200
        # login with new pw
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw2})
        assert r.status_code == 200
        # old should fail
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw1})
        assert r.status_code == 401

    def test_forgot_unknown_email(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nobody-xyz@example.com"})
        # returns 200 to avoid enumeration
        assert r.status_code == 200

    def test_verify_email_flow(self, user_token):
        r = requests.post(f"{API}/auth/resend-verification", headers=h(user_token))
        assert r.status_code == 200
        vtok = r.json().get("verification_token")
        assert vtok
        r = requests.post(f"{API}/auth/verify-email", json={"token": vtok}, headers=h(user_token))
        assert r.status_code == 200

    def test_update_profile(self, user_token):
        r = requests.put(f"{API}/auth/profile", headers=h(user_token), json={"name": "Renamed", "currency": "€", "notifications": False})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "Renamed"
        assert d["settings"]["currency"] == "€"
        assert d["settings"]["notifications"] is False


# ---------------- security ----------------
class TestSecurity:
    protected_get = ["/dashboard", "/analysis", "/analysis/latest", "/reports", "/favourites", "/notifications", "/chat/sessions", "/bill"]

    @pytest.mark.parametrize("path", protected_get)
    def test_get_requires_auth(self, path):
        r = requests.get(f"{API}{path}", timeout=15)
        assert r.status_code == 401, f"{path} should require auth, got {r.status_code}"

    def test_post_analysis_requires_auth(self):
        r = requests.post(f"{API}/analysis", json={})
        assert r.status_code == 401

    def test_contact_admin_only(self, user_token):
        r = requests.get(f"{API}/contact", headers=h(user_token))
        assert r.status_code == 403

    def test_data_isolation_analysis(self, admin_token, user_token):
        # user creates analysis, admin cannot see by id
        payload = {"country": "India", "city": "Mumbai", "buildingType": "Home", "floorArea": 1200, "occupants": 4, "monthlyBill": 180, "monthlyUnits": 650, "currency": "$"}
        r = requests.post(f"{API}/analysis", headers=h(user_token), json=payload, timeout=90)
        assert r.status_code == 200
        aid = r.json()["analysis_id"]
        r = requests.get(f"{API}/analysis/{aid}", headers=h(admin_token))
        assert r.status_code == 404


# ---------------- analysis + dashboard ----------------
class TestAnalysis:
    def test_run_analysis(self, user_token):
        payload = {
            "country": "USA", "state": "CA", "city": "San Francisco",
            "buildingType": "Office", "floorArea": 3500, "occupants": 25,
            "monthlyBill": 850, "monthlyUnits": 4200, "tariff": 0.20, "currency": "$",
            "solarAvailable": False, "batteryBackup": False,
            "appliances": ["ac", "led", "servers", "standby"],
            "hvac": "Split AC", "lighting": "Mixed", "operatingHours": 10,
        }
        r = requests.post(f"{API}/analysis", headers=h(user_token), json=payload, timeout=120)
        assert r.status_code == 200
        d = r.json()
        assert d["analysis_id"].startswith("an_")
        m = d["metrics"]
        assert 0 < m["efficiencyScore"] <= 100
        assert m["monthlySavings"] > 0
        assert len(m["hourly"]) == 24
        assert len(m["weekly"]) == 7
        assert len(m["monthlySeries"]) == 12
        assert len(m["topConsumers"]) >= 2
        ins = d["insights"]
        assert ins.get("summary")
        assert len(ins.get("recommendations", [])) >= 3

    def test_dashboard(self, user_token):
        r = requests.get(f"{API}/dashboard", headers=h(user_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["hasData"] is True
        assert d["latest"] is not None
        assert d["counts"]["analyses"] >= 1

    def test_simulate(self, user_token):
        r = requests.post(f"{API}/simulate", headers=h(user_token), json={"monthlyUnits": 650, "monthlyBill": 180, "ledPercent": 60, "solarKwp": 5, "hvacOffset": 2, "applianceTier": 1, "occupancySchedule": 30})
        assert r.status_code == 200
        d = r.json()
        assert d["billSaving"] > 0
        assert d["unitsSaved"] > 0
        assert d["capex"] > 0


# ---------------- reports ----------------
class TestReports:
    def test_create_get_email_report(self, user_token):
        # Ensure an analysis exists (parallel workers may not share state)
        payload = {"country": "India", "city": "Delhi", "buildingType": "Home", "floorArea": 1200, "occupants": 4, "monthlyBill": 180, "monthlyUnits": 650, "currency": "$", "appliances": ["ac", "led"]}
        requests.post(f"{API}/analysis", headers=h(user_token), json=payload, timeout=120)
        r = requests.post(f"{API}/reports", headers=h(user_token), json={})
        assert r.status_code == 200
        rep = r.json()
        rid = rep["report_id"]
        assert rep["reference"].startswith("AV-")
        r = requests.get(f"{API}/reports/{rid}", headers=h(user_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/reports/{rid}/email", headers=h(user_token))
        assert r.status_code == 200
        assert r.json()["delivery"] == "queued"

    def test_reports_list(self, user_token):
        r = requests.get(f"{API}/reports", headers=h(user_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- favourites / notifications ----------------
class TestFavouritesAndNotifications:
    def test_toggle_favourite(self, user_token):
        payload = {"title": "TEST_LED swap", "detail": "swap all incandescents", "category": "quick", "monthlySaving": 15}
        r = requests.post(f"{API}/favourites", headers=h(user_token), json=payload)
        assert r.status_code == 200 and r.json()["favourited"] is True
        r = requests.get(f"{API}/favourites", headers=h(user_token))
        assert any(f["title"] == "TEST_LED swap" for f in r.json())
        # untoggle
        r = requests.post(f"{API}/favourites", headers=h(user_token), json=payload)
        assert r.json()["favourited"] is False

    def test_notifications(self, user_token):
        r = requests.get(f"{API}/notifications", headers=h(user_token))
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "unread" in d
        assert len(d["items"]) > 0  # welcome/analysis/report
        r = requests.post(f"{API}/notifications/read", headers=h(user_token), json={})
        assert r.status_code == 200


# ---------------- contact ----------------
class TestContact:
    def test_contact_public(self, admin_token):
        payload = {"name": "TEST_John", "email": "john@example.com", "subject": "Demo", "message": "Please contact me back."}
        r = requests.post(f"{API}/contact", json=payload)
        assert r.status_code == 200
        assert r.json()["success"] is True
        # admin can list
        r = requests.get(f"{API}/contact", headers=h(admin_token))
        assert r.status_code == 200
        assert any(m["name"] == "TEST_John" for m in r.json())


# ---------------- chat ----------------
class TestChat:
    def test_chat_stream(self, user_token):
        with requests.post(f"{API}/chat", headers=h(user_token), json={"message": "In one sentence: what is my top energy waste?"}, stream=True, timeout=90) as r:
            assert r.status_code == 200
            got_delta = False
            got_done = False
            sid = None
            for line in r.iter_lines():
                if not line:
                    continue
                s = line.decode()
                if s.startswith("data: "):
                    import json as _j
                    payload = _j.loads(s[6:])
                    if "delta" in payload:
                        got_delta = True
                    if payload.get("done"):
                        got_done = True
                        sid = payload.get("session_id")
                        break
            assert got_delta and got_done and sid
        # history persisted
        r = requests.get(f"{API}/chat/sessions/{sid}", headers=h(user_token))
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert any(m["role"] == "assistant" for m in msgs)


# ---------------- bill scan negative ----------------
class TestBillScan:
    def test_reject_bad_mime(self, user_token):
        files = {"file": ("bill.txt", io.BytesIO(b"not an image"), "text/plain")}
        r = requests.post(f"{API}/bill/scan", headers=h(user_token), files=files)
        assert r.status_code == 400
