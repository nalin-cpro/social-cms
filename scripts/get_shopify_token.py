"""
One-time OAuth token exchange for Shopify Admin API.

Run this once to convert a client_id + client_secret into a permanent
access token, then paste the token into .env as SHOPIFY_ADMIN_TOKEN.

Usage:
    python scripts/get_shopify_token.py
"""

import os
import sys
from urllib.parse import urlparse, parse_qs
import requests
from dotenv import load_dotenv

load_dotenv()

REQUIRED = ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_STORE"]
SCOPES = "read_products,read_product_listings"
REDIRECT_URI = "https://localhost"


def main() -> None:
    missing = [k for k in REQUIRED if not os.getenv(k)]
    if missing:
        print(f"ERROR: Missing required env vars: {', '.join(missing)}")
        print("Fill them in .env and re-run.")
        sys.exit(1)

    client_id = os.environ["SHOPIFY_CLIENT_ID"]
    client_secret = os.environ["SHOPIFY_CLIENT_SECRET"]
    store = os.environ["SHOPIFY_STORE"].rstrip("/")

    # Step 1 — print the authorisation URL
    auth_url = (
        f"https://{store}/admin/oauth/authorize"
        f"?client_id={client_id}"
        f"&scope={SCOPES}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
    )

    print("\n=== Shopify OAuth Token Exchange ===\n")
    print("1. Open this URL in your browser and click 'Install':\n")
    print(f"   {auth_url}\n")
    print("2. You will be redirected to a localhost URL that won't load.")
    print("   Copy the full URL from the browser address bar and paste it below.\n")

    redirect_url = input("Paste the full redirect URL here: ").strip()

    # Step 2 — extract the code from the redirect URL
    try:
        parsed = urlparse(redirect_url)
        params = parse_qs(parsed.query)
        code = params["code"][0]
    except (KeyError, IndexError):
        print("\nERROR: Could not find '?code=...' in the URL you pasted.")
        print("Make sure you copied the full URL from the browser address bar.")
        sys.exit(1)

    print(f"\nAuthorisation code extracted: {code[:8]}...")

    # Step 3 — exchange code for permanent access token
    print("Exchanging code for access token...")
    response = requests.post(
        f"https://{store}/admin/oauth/access_token",
        json={"client_id": client_id, "client_secret": client_secret, "code": code},
        headers={"Content-Type": "application/json"},
        timeout=15,
    )

    if response.status_code != 200:
        print(f"\nERROR: Token exchange failed ({response.status_code}):")
        print(response.text)
        sys.exit(1)

    data = response.json()
    token = data.get("access_token", "")
    granted_scopes = data.get("scope", "unknown")

    if not token:
        print("\nERROR: Response did not contain an access_token:")
        print(data)
        sys.exit(1)

    # Step 4 — print results
    print("\n" + "=" * 50)
    print("SUCCESS — copy the token below into your .env file")
    print("=" * 50)
    print(f"\nSHOPIFY_ADMIN_TOKEN={token}\n")
    print(f"Granted scopes : {granted_scopes}")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
