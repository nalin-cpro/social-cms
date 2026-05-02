"""
Full platform API test suite.

Usage:
    python scripts/test_full_platform.py
    python scripts/test_full_platform.py --base https://social.progilityconsulting.in/api

Exit code 0 = all tests passed, 1 = failures/errors.
"""

import argparse
import json
import sys
import time
import requests

# ── Config ────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument("--base", default="https://social.progilityconsulting.in/api")
args = parser.parse_args()

BASE = args.base.rstrip("/")
RESULTS: list[tuple[str, str, str]] = []

# ── Helpers ───────────────────────────────────────────────────────────────────

def test(name: str, fn) -> bool | None:
    try:
        result = fn()
        status = "PASS" if result else "FAIL"
        RESULTS.append((status, name, ""))
        icon = "+" if result else "-"
        print(f"  [{icon}] {name}")
        return result
    except requests.exceptions.Timeout:
        RESULTS.append(("ERROR", name, "Request timed out"))
        print(f"  [!] {name} -- timed out")
        return None
    except Exception as e:
        RESULTS.append(("ERROR", name, str(e)))
        print(f"  [!] {name} -- {e}")
        return None


def skip(name: str, reason: str = "") -> None:
    RESULTS.append(("SKIP", name, reason))
    msg = f" ({reason})" if reason else ""
    print(f"  - SKIP {name}{msg}")


def get_token(email: str, password: str) -> str | None:
    try:
        r = requests.post(
            f"{BASE}/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        if r.status_code == 200:
            return r.json().get("access_token")
    except Exception as e:
        print(f"  [get_token error for {email}: {e}]")
    return None


# ── Test Group 1: AUTH ────────────────────────────────────────────────────────

print("\n=== AUTH ===")

admin_token    = get_token("nalin@progilityconsulting.in",       "admin123")
designer_token = get_token("gautam@progilityconsulting.in",      "design123")
client_token   = get_token("justine@milwaukeebootcompany.com",   "client123")

test("Admin login",    lambda: admin_token is not None)
test("Designer login", lambda: designer_token is not None)
test("Client login",   lambda: client_token is not None)

admin_h    = {"Authorization": f"Bearer {admin_token}"}    if admin_token    else {}
designer_h = {"Authorization": f"Bearer {designer_token}"} if designer_token else {}
client_h   = {"Authorization": f"Bearer {client_token}"}   if client_token   else {}

# Verify /auth/me returns the right role
if admin_token:
    r = requests.get(f"{BASE}/auth/me", headers=admin_h, timeout=10)
    test("GET /auth/me returns admin role",
         lambda: r.status_code == 200 and r.json().get("role") == "admin")

if client_token:
    r = requests.get(f"{BASE}/auth/me", headers=client_h, timeout=10)
    test("GET /auth/me returns client role",
         lambda: r.status_code == 200 and r.json().get("role") == "client")

# Reject bad credentials
r_bad = requests.post(
    f"{BASE}/auth/login",
    data={"username": "nobody@example.com", "password": "wrong"},
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    timeout=10,
)
test("Bad credentials return 401", lambda: r_bad.status_code == 401)

# Reject unauthenticated requests
r_unauth = requests.get(f"{BASE}/campaigns", timeout=10)
test("Unauthenticated request returns 401", lambda: r_unauth.status_code == 401)


# ── Test Group 2: CAMPAIGNS ───────────────────────────────────────────────────

print("\n=== CAMPAIGNS ===")

campaign_id: int | None = None

if not admin_token:
    skip("All campaign tests", "no admin token")
else:
    r = requests.get(f"{BASE}/campaigns?brand=mbc", headers=admin_h, timeout=10)
    test("GET /campaigns?brand=mbc returns 200", lambda: r.status_code == 200)
    campaigns = r.json() if r.status_code == 200 else []
    test("Campaigns list is not empty",            lambda: len(campaigns) > 0)
    test("Each campaign has a name",               lambda: all(c.get("name") for c in campaigns))
    test("Each campaign has brand_key=mbc",        lambda: all(c.get("brand_key") == "mbc" for c in campaigns))
    test("Each campaign has a status field",       lambda: all("status" in c for c in campaigns))

    # Create test campaign (manual)
    new_campaign = {
        "brand_key": "mbc",
        "name": "Test Campaign — Automated",
        "theme": "Test theme for automated testing",
        "visual_direction": "Clean studio, warm tones",
        "month_label": "May 2026",
        "year": 2026,
        "start_date": "2026-05-01",
        "end_date": "2026-05-15",
        "notes": "Created by automated test — safe to delete",
    }
    r_create = requests.post(f"{BASE}/campaigns", json=new_campaign, headers=admin_h, timeout=10)
    test("POST /campaigns creates campaign (201)",
         lambda: r_create.status_code in [200, 201])

    created = r_create.json() if r_create.status_code in [200, 201] else {}
    campaign_id = created.get("id")
    test("Created campaign has an ID",          lambda: campaign_id is not None)
    test("Created campaign name matches",        lambda: created.get("name") == "Test Campaign — Automated")
    test("Created campaign has a valid status",   lambda: created.get("status") in ["draft", "active"])
    test("Created campaign has brand_key=mbc",   lambda: created.get("brand_key") == "mbc")

    # Get single campaign
    if campaign_id:
        r_get = requests.get(f"{BASE}/campaigns/{campaign_id}", headers=admin_h, timeout=10)
        test("GET /campaigns/{id} returns 200",
             lambda: r_get.status_code == 200)
        test("GET /campaigns/{id} has posts field",
             lambda: "posts" in r_get.json())

    # PATCH campaign
    if campaign_id:
        r_patch = requests.patch(
            f"{BASE}/campaigns/{campaign_id}",
            json={"notes": "Updated by automated test"},
            headers=admin_h,
            timeout=10,
        )
        test("PATCH /campaigns/{id} updates notes",
             lambda: r_patch.status_code == 200 and r_patch.json().get("notes") == "Updated by automated test")

    # Send to client
    if campaign_id:
        r_stc = requests.post(f"{BASE}/campaigns/{campaign_id}/send-to-client", headers=admin_h, timeout=10)
        test("POST /campaigns/{id}/send-to-client returns 200",
             lambda: r_stc.status_code == 200)

    # Client cannot create campaigns (403)
    if client_token:
        r_client_create = requests.post(
            f"{BASE}/campaigns", json=new_campaign, headers=client_h, timeout=10
        )
        test("Client cannot create campaigns (403)",
             lambda: r_client_create.status_code in [401, 403])


# ── Test Group 3: CONTENT ITEMS ───────────────────────────────────────────────

print("\n=== CONTENT ITEMS ===")

items: list[dict] = []
item_id: int | None = None

if not admin_token:
    skip("All content tests", "no admin token")
else:
    r = requests.get(f"{BASE}/content?brand=mbc", headers=admin_h, timeout=10)
    test("GET /content?brand=mbc returns 200",     lambda: r.status_code == 200)
    items = r.json() if r.status_code == 200 else []
    test("Content items exist",                    lambda: len(items) > 0)
    test("Each item has id, brand_key, status",    lambda: all(
        i.get("id") and i.get("brand_key") and i.get("status") for i in items
    ))

    valid_statuses = {
        "pending", "generating", "needs_image_source",
        "ready_for_internal_review", "internal_approved",
        "ready_for_approval", "changes_requested",
        "approved", "published", "cancelled", "error",
    }
    test("All content items have valid status",    lambda: all(
        i.get("status") in valid_statuses for i in items
    ))

    # campaign_id filter
    if campaign_id:
        r_cf = requests.get(
            f"{BASE}/content?brand=mbc&campaign_id={campaign_id}",
            headers=admin_h, timeout=10,
        )
        test("GET /content?campaign_id filter returns 200", lambda: r_cf.status_code == 200)
        test("campaign_id filter returns a list",            lambda: isinstance(r_cf.json(), list))

    item = items[0] if items else None
    item_id = item.get("id") if item else None

    # GET single item
    if item_id:
        r_single = requests.get(f"{BASE}/content/{item_id}", headers=admin_h, timeout=10)
        test("GET /content/{id} returns 200",      lambda: r_single.status_code == 200)
        test("GET /content/{id} has all fields",   lambda: all(
            k in r_single.json()
            for k in ["id", "brand_key", "status", "channel", "product_name"]
        ))

    # PATCH content item (update image_source_type)
    if item_id:
        r_patch = requests.patch(
            f"{BASE}/content/{item_id}",
            json={"image_source_type": "not_set"},
            headers=admin_h,
            timeout=10,
        )
        test("PATCH /content/{id} works (200)",    lambda: r_patch.status_code == 200)
        test("PATCH /content/{id} returns updated item",
             lambda: r_patch.json().get("id") == item_id)

    # Client only sees ready_for_approval / approved items
    if client_token:
        r_client = requests.get(f"{BASE}/content?brand=mbc", headers=client_h, timeout=10)
        test("Client GET /content returns 200",    lambda: r_client.status_code == 200)
        if r_client.status_code == 200:
            client_items = r_client.json()
            visible_statuses = {"ready_for_approval", "approved"}
            test("Client only sees ready_for_approval or approved items",
                 lambda: all(i.get("status") in visible_statuses for i in client_items))


# ── Test Group 4: PIPELINE ────────────────────────────────────────────────────

print("\n=== PIPELINE ===")

pending_id: int | None = None

if not admin_token:
    skip("All pipeline tests", "no admin token")
else:
    pending_item = next((i for i in items if i.get("status") == "pending"), None)
    pending_id = pending_item.get("id") if pending_item else None

    # Pipeline status list
    r_status = requests.get(f"{BASE}/pipeline/status", headers=admin_h, timeout=10)
    test("GET /pipeline/status returns 200",       lambda: r_status.status_code == 200)
    test("Pipeline status returns a list",         lambda: isinstance(r_status.json(), list))

    # fetch-product
    if not pending_id:
        skip("fetch-product test", "no pending items")
    else:
        r_fp = requests.post(
            f"{BASE}/pipeline/step/fetch-product",
            json={"content_item_id": pending_id},
            headers=admin_h,
            timeout=30,
        )
        test("POST /pipeline/step/fetch-product returns 200",
             lambda: r_fp.status_code == 200)
        fp_result = r_fp.json() if r_fp.status_code == 200 else {}
        test("fetch-product returns 'found' field",
             lambda: "found" in fp_result)
        test("fetch-product returns valid body on not-found",
             lambda: fp_result.get("found") is True
             or (fp_result.get("found") is False and "product_name" in fp_result))

    # generate-copy — use an email item (fastest, no image needed)
    email_item = next(
        (i for i in items if i.get("channel") == "email" and i.get("status") == "pending"),
        None,
    )
    if not email_item:
        skip("generate-copy test", "no pending email items")
    else:
        print("  Running copy generation (may take 15-30s)…")
        r_gc = requests.post(
            f"{BASE}/pipeline/step/generate-copy",
            json={"content_item_id": email_item.get("id")},
            headers=admin_h,
            timeout=90,
        )
        test("POST /pipeline/step/generate-copy returns 200",
             lambda: r_gc.status_code == 200)
        gc_result = r_gc.json() if r_gc.status_code == 200 else {}
        test("generate-copy result has a status",
             lambda: "status" in gc_result)
        test("generate-copy item has copy_json or moved to review",
             lambda: gc_result.get("copy_json") is not None
             or gc_result.get("status") == "ready_for_internal_review")

    # Designer can call pipeline steps (should succeed)
    if pending_id and designer_token:
        r_designer = requests.post(
            f"{BASE}/pipeline/step/fetch-product",
            json={"content_item_id": pending_id},
            headers=designer_h,
            timeout=30,
        )
        test("Designer can call pipeline steps (200)",
             lambda: r_designer.status_code == 200)

    # Client cannot call pipeline steps (403)
    if pending_id and client_token:
        r_client_step = requests.post(
            f"{BASE}/pipeline/step/fetch-product",
            json={"content_item_id": pending_id},
            headers=client_h,
            timeout=10,
        )
        test("Client cannot call pipeline steps (403)",
             lambda: r_client_step.status_code in [401, 403])


# ── Test Group 5: COMMENTS ────────────────────────────────────────────────────

print("\n=== COMMENTS ===")

if not item_id:
    skip("All comment tests", "no content item available")
else:
    # GET comments
    r_comments = requests.get(f"{BASE}/content/{item_id}/comments", headers=admin_h, timeout=10)
    test("GET /content/{id}/comments returns 200",  lambda: r_comments.status_code == 200)
    test("Comments endpoint returns a list",         lambda: isinstance(r_comments.json(), list))

    # Admin posts internal comment
    r_post = requests.post(
        f"{BASE}/content/{item_id}/comments",
        json={"message": "Automated test comment — internal", "is_internal": True},
        headers=admin_h,
        timeout=10,
    )
    test("Admin POST internal comment (201)",        lambda: r_post.status_code in [200, 201])
    if r_post.status_code in [200, 201]:
        c = r_post.json()
        test("Comment body has message field",       lambda: c.get("message") == "Automated test comment — internal")
        test("Comment has sender_role",              lambda: "sender_role" in c)

    # Client comment on a ready_for_approval item
    client_visible = next(
        (i for i in items if i.get("status") == "ready_for_approval"), None
    )
    if not client_visible or not client_token:
        skip("Client comment test", "no ready_for_approval item or no client token")
    else:
        r_client_comment = requests.post(
            f"{BASE}/content/{client_visible.get('id')}/comments",
            json={"message": "Test client feedback — automated", "is_internal": False},
            headers=client_h,
            timeout=10,
        )
        test("Client POST comment (200/201)",        lambda: r_client_comment.status_code in [200, 201])

    # Designer posts a comment
    if designer_token:
        r_designer_comment = requests.post(
            f"{BASE}/content/{item_id}/comments",
            json={"message": "Designer test comment", "is_internal": False},
            headers=designer_h,
            timeout=10,
        )
        test("Designer POST comment (200/201)",      lambda: r_designer_comment.status_code in [200, 201])


# ── Test Group 6: INTERNAL REVIEW WORKFLOW ────────────────────────────────────

print("\n=== INTERNAL REVIEW WORKFLOW ===")

# Find a "ready_for_internal_review" item — don't push pending items that may
# be real content through the whole approval flow on a prod-like server.
review_item = next(
    (i for i in items if i.get("status") == "ready_for_internal_review"), None
)
review_id = review_item.get("id") if review_item else None

if not admin_token:
    skip("All review workflow tests", "no admin token")
elif not review_id:
    skip("Internal approve / send-to-client workflow",
         "no ready_for_internal_review item (all items may be in later states)")
else:
    # Internal approve
    r_ia = requests.post(
        f"{BASE}/content/{review_id}/internal-approve", headers=admin_h, timeout=10
    )
    test("POST /content/{id}/internal-approve returns 200",
         lambda: r_ia.status_code == 200)

    # Send to client
    r_stc2 = requests.post(
        f"{BASE}/content/{review_id}/send-to-client", headers=admin_h, timeout=10
    )
    test("POST /content/{id}/send-to-client returns 200",
         lambda: r_stc2.status_code == 200)

    # Verify status progression
    r_check = requests.get(f"{BASE}/content/{review_id}", headers=admin_h, timeout=10)
    test("Status is ready_for_approval after send-to-client",
         lambda: r_check.status_code == 200
         and r_check.json().get("status") == "ready_for_approval")

    # Client approves
    if client_token:
        r_approve = requests.post(
            f"{BASE}/content/{review_id}/approve", headers=client_h, timeout=10
        )
        test("Client POST /content/{id}/approve returns 200",
             lambda: r_approve.status_code == 200)

        r_final = requests.get(f"{BASE}/content/{review_id}", headers=admin_h, timeout=10)
        test("Status is approved after client approval",
             lambda: r_final.status_code == 200
             and r_final.json().get("status") == "approved")
    else:
        skip("Client approval step", "no client token")


# ── Test Group 7: BRAND MEMORY ────────────────────────────────────────────────

print("\n=== BRAND MEMORY ===")

memory_rule_id: int | None = None

if not admin_token:
    skip("All brand memory tests", "no admin token")
else:
    r_mem = requests.get(f"{BASE}/brands/mbc/memory", headers=admin_h, timeout=10)
    test("GET /brands/mbc/memory returns 200",     lambda: r_mem.status_code == 200)
    test("Memory endpoint returns a list",         lambda: isinstance(r_mem.json(), list))

    # POST a new rule
    r_add = requests.post(
        f"{BASE}/brands/mbc/memory",
        json={
            "rule_text": "Automated test rule — never use the term 'work boots'",
            "rule_type": "copy",
            "source": "manual",
        },
        headers=admin_h,
        timeout=10,
    )
    test("POST /brands/mbc/memory adds rule (201)", lambda: r_add.status_code in [200, 201])
    memory_rule_id = r_add.json().get("id") if r_add.status_code in [200, 201] else None
    test("New rule has id and rule_text",           lambda: memory_rule_id is not None
         and r_add.json().get("rule_text") is not None)

    # PATCH (confirm) the rule
    if memory_rule_id:
        r_patch_rule = requests.patch(
            f"{BASE}/brands/mbc/memory/{memory_rule_id}",
            json={"status": "confirmed"},
            headers=admin_h,
            timeout=10,
        )
        test("PATCH /brands/mbc/memory/{id} confirms rule (200)",
             lambda: r_patch_rule.status_code == 200)
        test("Rule status is confirmed after patch",
             lambda: r_patch_rule.json().get("status") == "confirmed")

    # DELETE the test rule (cleanup)
    if memory_rule_id:
        r_del_rule = requests.delete(
            f"{BASE}/brands/mbc/memory/{memory_rule_id}",
            headers=admin_h,
            timeout=10,
        )
        test("DELETE /brands/mbc/memory/{id} removes rule (200/204)",
             lambda: r_del_rule.status_code in [200, 204])


# ── Test Group 8: SUGGESTIONS ─────────────────────────────────────────────────

print("\n=== SUGGESTIONS ===")

if not item_id:
    skip("Suggestion POST test", "no content item available")
elif not designer_token:
    skip("Designer suggestion test", "no designer token")
else:
    r_sug = requests.post(
        f"{BASE}/suggestions",
        json={
            "content_item_id": item_id,
            "suggestion_type": "cancel",
            "message": "Automated test suggestion — safe to delete",
        },
        headers=designer_h,
        timeout=10,
    )
    test("POST /suggestions (designer, 200/201)",  lambda: r_sug.status_code in [200, 201])

if admin_token:
    r_sug_list = requests.get(f"{BASE}/suggestions", headers=admin_h, timeout=10)
    test("GET /suggestions (admin, 200)",          lambda: r_sug_list.status_code == 200)
    test("Suggestions response is a list",         lambda: isinstance(r_sug_list.json(), list))
else:
    skip("GET /suggestions", "no admin token")


# ── Test Group 9: HOLIDAYS & ASSETS ──────────────────────────────────────────

print("\n=== HOLIDAYS & ASSETS ===")

if admin_token:
    r_hol = requests.get(f"{BASE}/holidays?brand=mbc&year=2026", headers=admin_h, timeout=10)
    test("GET /holidays?brand=mbc&year=2026 returns 200", lambda: r_hol.status_code == 200)
    test("Holidays response is a list",                   lambda: isinstance(r_hol.json(), list))

    r_assets = requests.get(f"{BASE}/assets?brand=mbc&days=90", headers=admin_h, timeout=10)
    test("GET /assets?brand=mbc&days=90 returns 200",     lambda: r_assets.status_code == 200)
    test("Assets response is a list",                     lambda: isinstance(r_assets.json(), list))
else:
    skip("Holidays & assets tests", "no admin token")


# ── Test Group 10: AI ENDPOINTS ───────────────────────────────────────────────

print("\n=== AI ENDPOINTS ===")

if not admin_token:
    skip("All AI endpoint tests", "no admin token")
else:
    print("  Running AI plan-chat (may take 10-20s)…")
    r_chat = requests.post(
        f"{BASE}/ai/plan-chat",
        json={
            "brand_key": "mbc",
            "message": "What campaigns should I run in June?",
            "context": {"month": "June 2026", "campaigns": []},
            "history": [],
        },
        headers=admin_h,
        timeout=60,
    )
    test("POST /ai/plan-chat returns 200",    lambda: r_chat.status_code == 200)
    if r_chat.status_code == 200:
        reply = r_chat.json().get("reply", "")
        test("AI plan-chat returns non-empty reply", lambda: len(reply) > 10)
        test("AI plan-chat reply is plain text",     lambda: isinstance(reply, str))

    # Verify designer can also use plan-chat
    if designer_token:
        r_chat_d = requests.post(
            f"{BASE}/ai/plan-chat",
            json={"brand_key": "mbc", "message": "Hello", "context": {}, "history": []},
            headers=designer_h,
            timeout=30,
        )
        test("Designer can use /ai/plan-chat (200)",  lambda: r_chat_d.status_code == 200)

    # Client cannot use AI endpoints (403)
    if client_token:
        r_chat_c = requests.post(
            f"{BASE}/ai/plan-chat",
            json={"brand_key": "mbc", "message": "Hello", "context": {}, "history": []},
            headers=client_h,
            timeout=10,
        )
        test("Client cannot use /ai/plan-chat (403)", lambda: r_chat_c.status_code in [401, 403])


# ── Test Group 11: NOTIFICATIONS ─────────────────────────────────────────────

print("\n=== NOTIFICATIONS ===")

if admin_token:
    r_notif_a = requests.get(f"{BASE}/notifications", headers=admin_h, timeout=10)
    test("GET /notifications (admin, 200)",   lambda: r_notif_a.status_code == 200)
    test("Notifications is a list",           lambda: isinstance(r_notif_a.json(), list))
else:
    skip("Admin notifications test", "no admin token")

if client_token:
    r_notif_c = requests.get(f"{BASE}/notifications", headers=client_h, timeout=10)
    test("GET /notifications (client, 200)",  lambda: r_notif_c.status_code == 200)
else:
    skip("Client notifications test", "no client token")


# ── Test Group 12: BRANDS ─────────────────────────────────────────────────────

print("\n=== BRANDS ===")

if admin_token:
    r_brands = requests.get(f"{BASE}/brands", headers=admin_h, timeout=10)
    test("GET /brands returns 200",           lambda: r_brands.status_code == 200)
    test("Brands list is not empty",          lambda: len(r_brands.json()) > 0)
    test("Brand 'mbc' exists in list",        lambda: any(
        b.get("key") == "mbc" for b in r_brands.json()
    ))

    r_brand = requests.get(f"{BASE}/brands/mbc", headers=admin_h, timeout=10)
    test("GET /brands/mbc returns 200",       lambda: r_brand.status_code == 200)
    test("Brand has name and key fields",     lambda: all(
        k in r_brand.json() for k in ["key", "name"]
    ))

    # Client cannot list brands (403)
    if client_token:
        r_brands_c = requests.get(f"{BASE}/brands", headers=client_h, timeout=10)
        test("Client cannot list brands (403)", lambda: r_brands_c.status_code in [401, 403])
else:
    skip("Brand tests", "no admin token")


# ── CLEANUP ───────────────────────────────────────────────────────────────────

print("\n=== CLEANUP ===")

if campaign_id and admin_token:
    r_del = requests.delete(f"{BASE}/campaigns/{campaign_id}", headers=admin_h, timeout=10)
    test("DELETE test campaign (200/204)",    lambda: r_del.status_code in [200, 204])
else:
    skip("Delete test campaign", "no campaign_id or no admin token")


# ── SUMMARY REPORT ────────────────────────────────────────────────────────────

passed  = [r for r in RESULTS if r[0] == "PASS"]
failed  = [r for r in RESULTS if r[0] == "FAIL"]
errors  = [r for r in RESULTS if r[0] == "ERROR"]
skipped = [r for r in RESULTS if r[0] == "SKIP"]

print()
print("=" * 60)
print("FULL PLATFORM TEST REPORT")
print(f"Target: {BASE}")
print("=" * 60)

for status, name, msg in RESULTS:
    if status == "PASS":
        print(f"  [+] PASS   {name}")
    elif status == "SKIP":
        reason_str = f"  ({msg})" if msg else ""
        print(f"  [~] SKIP   {name}{reason_str}")
    else:
        print(f"  [-] {status:<6} {name}")
        if msg:
            print(f"             {msg}")

print("=" * 60)
total_run = len(passed) + len(failed) + len(errors)
print(f"  {len(passed)}/{total_run} passed   {len(skipped)} skipped")

if failed:
    print(f"\n  FAILED ({len(failed)}):")
    for _, name, _ in failed:
        print(f"    [-] {name}")

if errors:
    print(f"\n  ERRORS ({len(errors)}):")
    for _, name, msg in errors:
        print(f"    [!] {name}")
        if msg:
            print(f"        {msg}")

print()
sys.exit(0 if not failed and not errors else 1)
