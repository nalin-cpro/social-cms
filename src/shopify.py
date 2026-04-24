"""
Fetches product data and images from the Shopify public storefront JSON endpoint.
No OAuth, tokens, or API keys required — uses the publicly accessible
/products/{handle}.json route on each brand's custom domain.

Brand storefronts are configured in config/brands.json.
"""

import json
import logging
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_BRANDS_PATH = Path(__file__).parent.parent / "config" / "brands.json"
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": _BROWSER_UA})


def _load_brands() -> dict:
    with open(_BRANDS_PATH) as f:
        return json.load(f)


def product_name_to_handle(name: str) -> str:
    """Convert a product name to a Shopify URL handle.

    "Bernie Men's Slip On Sneaker" -> "bernie-mens-slip-on-sneaker"
    """
    handle = name.lower()
    handle = handle.replace("'", "").replace("'", "")
    handle = re.sub(r"[^a-z0-9\s-]", "", handle)
    handle = re.sub(r"\s+", "-", handle.strip())
    handle = re.sub(r"-+", "-", handle)
    return handle


def _handle_variants(handle: str) -> list[str]:
    """Return handle variants to try in order:
    1. Full handle as-is
    2. Gender words stripped
    3. First hyphen-segment only (MBC uses single-word handles like "bernie")
    """
    stripped = re.sub(r"-?(mens|womens|men|women)-?", "-", handle)
    stripped = re.sub(r"-+", "-", stripped).strip("-")
    first_word = handle.split("-")[0]

    seen = []
    for v in [handle, stripped, first_word]:
        if v and v not in seen:
            seen.append(v)
    return seen


def fetch_product_json(brand_key: str, product_name: str) -> dict | None:
    """Fetch product data from the storefront JSON endpoint.

    Tries the direct handle first, then a gender-stripped fallback.
    Returns the value of the "product" key, or None if not found.
    """
    brands = _load_brands()
    brand = brands.get(brand_key.lower())
    if not brand:
        logger.error("Unknown brand key: %s", brand_key)
        return None

    base_url = brand["storefront_url"].rstrip("/")
    handle = product_name_to_handle(product_name)

    for attempt_handle in _handle_variants(handle):
        url = f"{base_url}/products/{attempt_handle}.json"
        logger.info("Fetching product JSON: %s", url)
        try:
            resp = _SESSION.get(url, timeout=10)
        except requests.RequestException as exc:
            logger.error("Request failed for %s: %s", url, exc)
            return None

        if resp.status_code == 200:
            logger.info("Found product at handle: %s", attempt_handle)
            return resp.json().get("product")

        logger.warning("HTTP %s for handle: %s", resp.status_code, attempt_handle)

    logger.error("Product not found for '%s' (brand: %s)", product_name, brand_key)
    return None


def get_product_images(product: dict) -> list[str]:
    """Extract all image src URLs from a product dict.

    Returns a list where the first item is the primary image.
    """
    return [img["src"] for img in product.get("images", []) if img.get("src")]


def get_product_primary_image_url(brand_key: str, product_name: str) -> str | None:
    """Return the primary image URL for a product, or None if not found."""
    product = fetch_product_json(brand_key, product_name)
    if not product:
        return None
    images = get_product_images(product)
    return images[0] if images else None


def download_image(url: str, output_path: str) -> bool:
    """Download an image to output_path.

    Returns True on success, False on failure.
    """
    try:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        logger.info("Downloading image: %s -> %s", url, output_path)
        resp = _SESSION.get(url, timeout=20, stream=True)
        resp.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info("Image saved: %s", output_path)
        return True
    except Exception as exc:
        logger.error("Failed to download %s: %s", url, exc)
        return False


def _strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html or "").strip()


def get_product_metadata(brand_key: str, product_name: str) -> dict:
    """Return a metadata dict for a product.

    Keys: title, handle, product_type, tags, price, image_url,
          all_image_urls, description.
    Returns an empty dict if the product is not found.
    """
    product = fetch_product_json(brand_key, product_name)
    if not product:
        return {}

    variants = product.get("variants", [])
    prices = [float(v["price"]) for v in variants if v.get("price")]
    price = min(prices) if prices else None

    images = get_product_images(product)

    return {
        "title": product.get("title", ""),
        "handle": product.get("handle", ""),
        "product_type": product.get("product_type", ""),
        "tags": product.get("tags", []),
        "price": price,
        "image_url": images[0] if images else None,
        "all_image_urls": images,
        "description": _strip_html(product.get("body_html", "")),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    result = get_product_metadata("mbc", "Bernie Men's Slip On Sneaker")
    print(result)
    if result.get("image_url"):
        downloaded = download_image(result["image_url"], "outputs/test_bernie.jpg")
        print("Image downloaded:", downloaded)
