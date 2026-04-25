import requests
import json

BASE = "https://social.progilityconsulting.in/api"

results = []

def test(name, fn):
    try:
        result = fn()
        status = "PASS" if result else "FAIL"
    except Exception as e:
        status = f"ERROR: {e}"
    results.append(f"{status:8} {name}")
    return result if 'result' in dir() else None

# Auth
def get_token(email, password):
    r = requests.post(f"{BASE}/auth/login",
        data={"username": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token")
    return None

admin_token = get_token("nalin@progilityconsulting.in", "admin123")
designer_token = get_token("gautam@progilityconsulting.in", "design123")
client_token = get_token("justine@milwaukeebootcompany.com", "client123")

test("Admin login", lambda: admin_token is not None)
test("Designer login", lambda: designer_token is not None)
test("Client login", lambda: client_token is not None)

admin_h = {"Authorization": f"Bearer {admin_token}"}
designer_h = {"Authorization": f"Bearer {designer_token}"}
client_h = {"Authorization": f"Bearer {client_token}"}

# Brands
r = requests.get(f"{BASE}/brands", headers=admin_h)
test("GET /brands", lambda: r.status_code == 200)
brands = r.json() if r.status_code == 200 else []
test("MBC brand exists", lambda: any(b.get("key") == "mbc" for b in brands))

# Campaigns
r = requests.get(f"{BASE}/campaigns?brand=mbc", headers=admin_h)
test("GET /campaigns", lambda: r.status_code == 200)
campaigns = r.json() if r.status_code == 200 else []
test("At least one campaign exists", lambda: len(campaigns) > 0)
campaign_id = campaigns[0]["id"] if campaigns else None

# Content
r = requests.get(f"{BASE}/content?brand=mbc", headers=admin_h)
test("GET /content", lambda: r.status_code == 200)
items = r.json() if r.status_code == 200 else []
test("Content items exist", lambda: len(items) > 0)
item_id = items[0]["id"] if items else None
test("feed_post_url populated", lambda: any(i.get("feed_post_url") for i in items))
VALID_STATUSES = {
    "pending","generating","ready_for_internal_review",
    "internal_approved","ready_for_approval",
    "changes_requested","approved","published","cancelled","error"
}
test("Status values valid", lambda: all(i.get("status") in VALID_STATUSES for i in items))

# Content comments
if item_id:
    r = requests.get(f"{BASE}/content/{item_id}/comments", headers=admin_h)
    test("GET /content/{id}/comments", lambda: r.status_code == 200)

    r = requests.post(f"{BASE}/content/{item_id}/comments",
        headers=admin_h,
        json={"message": "Test internal comment", "is_internal": True})
    test("POST /content/{id}/comments (admin)", lambda: r.status_code in [200,201])

    r = requests.post(f"{BASE}/content/{item_id}/internal-approve",
        headers=admin_h)
    test("POST /content/{id}/internal-approve", lambda: r.status_code in [200,201])

    r = requests.post(f"{BASE}/content/{item_id}/send-to-client",
        headers=admin_h)
    test("POST /content/{id}/send-to-client", lambda: r.status_code in [200,201])

# Client sees content
r = requests.get(f"{BASE}/content?brand=mbc", headers=client_h)
test("Client GET /content", lambda: r.status_code == 200)
client_items = r.json() if r.status_code == 200 else []
test("Client sees only ready_for_approval items",
    lambda: all(i["status"] == "ready_for_approval" for i in client_items))

# Client approve
if client_items:
    cid = client_items[0]["id"]
    r = requests.post(f"{BASE}/content/{cid}/approve", headers=client_h)
    test("Client POST /content/{id}/approve", lambda: r.status_code in [200,201])

# Suggestions
if item_id:
    r = requests.post(f"{BASE}/suggestions",
        headers=designer_h,
        json={
            "content_item_id": item_id,
            "suggestion_type": "cancel",
            "message": "Test suggestion"
        })
    test("POST /suggestions (designer)", lambda: r.status_code in [200,201])

r = requests.get(f"{BASE}/suggestions", headers=admin_h)
test("GET /suggestions (admin)", lambda: r.status_code == 200)

# Holidays
r = requests.get(f"{BASE}/holidays?brand=mbc&year=2026", headers=admin_h)
test("GET /holidays", lambda: r.status_code == 200)

# Notifications
r = requests.get(f"{BASE}/notifications", headers=admin_h)
test("GET /notifications", lambda: r.status_code == 200)

# Campaign creation
r = requests.post(f"{BASE}/campaigns",
    headers=admin_h,
    json={
        "brand_key": "mbc",
        "name": "Test Campaign",
        "theme": "Test theme",
        "visual_direction": "Test visual direction",
        "month_label": "May 2026",
        "year": 2026,
        "start_date": "2026-05-01",
        "end_date": "2026-05-31",
        "notes": ""
    })
test("POST /campaigns (create)", lambda: r.status_code in [200,201])

# Static files — mounted at /outputs (not /api/outputs)
r = requests.get("https://social.progilityconsulting.in/outputs/")
test("Static /outputs/ mount", lambda: r.status_code != 404)

# Print report
print("\n" + "="*50)
print("API TEST REPORT")
print("="*50)
for r in results:
    print(r)
print("="*50)
fails = [r for r in results if not r.startswith("PASS")]
print(f"\n{len(results)-len(fails)}/{len(results)} tests passed")
if fails:
    print("\nFailed:")
    for f in fails:
        print(f"  {f}")
