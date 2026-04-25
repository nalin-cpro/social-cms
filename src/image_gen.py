"""
Generates lifestyle product images using fal.ai FLUX Pro Kontext.
Model: fal-ai/flux-pro/kontext

Scene rotation system: each run picks from a library of scenes defined
in config/brands.json, producing visual variety across the same product.

Requires FAL_API_KEY in environment. fal-client reads it as FAL_KEY.
"""

import json
import logging
import os
import random
import re
from datetime import date
from pathlib import Path

import requests
import fal_client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_BRANDS_PATH = Path(__file__).parent.parent / "config" / "brands.json"
_FAL_MODEL = "fal-ai/flux-pro/kontext"
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _load_brands() -> dict:
    with open(_BRANDS_PATH) as f:
        return json.load(f)


def load_brand_config(brand_key: str) -> dict:
    return _load_brands().get(brand_key.lower(), {})


def _to_handle(name: str) -> str:
    handle = name.lower().replace("'", "").replace("\u2019", "")
    handle = re.sub(r"[^a-z0-9\s-]", "", handle)
    handle = re.sub(r"\s+", "-", handle.strip())
    return re.sub(r"-+", "-", handle)


def build_image_prompt(
    brand_key: str,
    product_name: str,
    campaign: str,
    scene_name: str = None,
) -> tuple[str, str]:
    """Build a FLUX Kontext prompt with scene rotation + brand analysis injection.

    Returns (prompt, scene_name) so the caller knows which scene was used.
    If scene_name is None a scene is picked at random from brand config.
    Brand style rules from cached Claude Vision analysis are injected when available.
    """
    from src.onboarding import load_brand_analysis

    brand_config = load_brand_config(brand_key)
    scenes = brand_config.get("scenes", [])

    if not scenes:
        logger.warning("No scenes defined for brand '%s' — using generic prompt", brand_key)
        scene = {"name": "generic", "description": "Urban lifestyle setting, natural light."}
    elif scene_name:
        scene = next((s for s in scenes if s["name"] == scene_name), scenes[0])
    else:
        scene = random.choice(scenes)

    # Infer outfit from product name
    product_lower = product_name.lower()
    if any(w in product_lower for w in ["sneaker", "slip on", "slip-on", "driver", "loafer", "moc"]):
        shoe_style = "leather sneaker"
        outfit = "slim dark jeans cuffed at ankle, cream or white knit sweater, no-show socks"
    elif any(w in product_lower for w in ["boot", "chukka", "chelsea", "roper"]):
        shoe_style = "leather boot"
        outfit = "slim dark jeans, chambray shirt or casual blazer, minimal accessories"
    else:
        shoe_style = "leather shoe"
        outfit = "slim chinos or dark jeans, open collar shirt or light sweater"

    # Load cached brand analysis and inject style rules if available
    analysis = load_brand_analysis(brand_key)
    style_addition = analysis.get("flux_style_prompt_addition", "")
    always_do = analysis.get("what_to_always_do", [])
    never_do = analysis.get("what_to_never_do", [])

    brand_rules = ""
    if analysis:
        always_str = "; ".join(always_do[:3]) if always_do else ""
        never_str  = "; ".join(never_do[:3])  if never_do  else ""
        brand_rules = (
            f"\nVisual style rules learned from analysing {brand_key.upper()}'s Instagram:\n"
            + (f"Always: {always_str}\n" if always_str else "")
            + (f"Never: {never_str}\n"   if never_str  else "")
            + (f"Style: {style_addition}\n" if style_addition else "")
        )

    prompt = (
        f"Professional lifestyle photography for Milwaukee Boot Company.\n\n"
        f"Subject: A stylish man in his 30s wearing the {product_name} ({shoe_style}).\n"
        f"Outfit: {outfit}. The shoe is clearly visible and naturally worn.\n"
        f"Full body shot — head to toe visible, shoe prominent but part of the outfit.\n\n"
        f"Scene: {scene['description']}\n\n"
        f"Campaign mood: {campaign}.\n"
        f"Visual style: warm, cinematic, editorial.\n"
        f"Lighting: natural or warm ambient — no harsh flash.\n"
        f"Camera: shallow depth of field, background softly blurred.\n"
        f"Composition: rule of thirds, confident natural pose.\n"
        f"Quality: photorealistic, high-end fashion editorial, commercial photography standard.\n"
        + brand_rules
        + "Do NOT add text, logos, or watermarks."
    )

    logger.info(
        "Prompt built | brand='%s' product='%s' scene='%s' campaign='%s' analysis=%s",
        brand_key, product_name, scene["name"], campaign,
        "injected" if analysis else "not available",
    )
    return prompt, scene["name"]


def get_output_path(
    brand_key: str,
    product_name: str,
    suffix: str = "lifestyle",
    scene: str = "",
) -> str:
    """Return a dated output path and create the directory.

    Pattern: outputs/{brand_key}/{YYYY-MM-DD}/{handle}_lifestyle[_{scene}].jpg
    """
    handle = _to_handle(product_name)
    today = date.today().isoformat()
    scene_tag = f"_{scene}" if scene else ""
    directory = Path("outputs") / brand_key.lower() / today
    directory.mkdir(parents=True, exist_ok=True)
    return str(directory / f"{handle}_{suffix}{scene_tag}.jpg")


def generate_lifestyle_image(
    brand_key: str,
    product_name: str,
    campaign: str,
    product_image_url: str,
    output_path: str,
    scene_name: str = None,
) -> tuple[bool, str]:
    """Generate a lifestyle scene via FLUX Kontext with scene rotation.

    Returns (True, scene_name) on success, (False, "") on any failure.
    Never raises.
    """
    try:
        fal_api_key = os.getenv("FAL_API_KEY", "")
        if not fal_api_key:
            logger.error("FAL_API_KEY is not set — cannot generate image")
            return False, ""

        os.environ["FAL_KEY"] = fal_api_key

        prompt, used_scene = build_image_prompt(brand_key, product_name, campaign, scene_name)

        logger.info(
            "Generating lifestyle image | scene='%s' | model=%s",
            used_scene, _FAL_MODEL,
        )
        logger.info("Product image URL: %s", product_image_url)

        result = fal_client.run(
            _FAL_MODEL,
            arguments={
                "prompt": prompt,
                "image_url": product_image_url,
                "image_size": "square_hd",
                "num_images": 1,
                "output_format": "jpeg",
                "guidance_scale": 3.5,
                "strength": 0.85,
            },
        )

        images = result.get("images", [])
        if not images:
            logger.warning("fal.ai returned empty images list (scene='%s')", used_scene)
            return False, ""

        image_url = images[0].get("url", "")
        if not image_url:
            logger.warning("fal.ai image entry has no URL (scene='%s'): %s", used_scene, images[0])
            return False, ""

        logger.info("Image URL received: %s", image_url)

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        logger.info("Downloading to %s", output_path)
        resp = requests.get(
            image_url,
            headers={"User-Agent": _BROWSER_UA},
            timeout=60,
            stream=True,
        )
        resp.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        size_kb = os.path.getsize(output_path) // 1024
        logger.info("Saved: %s (%d KB)", output_path, size_kb)
        return True, used_scene

    except Exception as exc:
        logger.error("generate_lifestyle_image failed (scene='%s'): %s", scene_name, exc)
        return False, ""


# ── High-level generate_images (used by pipeline_db + content router) ─────────

def _to_relative_url(path) -> str | None:
    if not path:
        return None
    p = Path(path)
    try:
        rel = p.relative_to("outputs")
        return f"/outputs/{rel.as_posix()}"
    except ValueError:
        return f"/outputs/{p.name}"


def _generate_placeholder_images(brand_key: str, product_name: str) -> dict:
    """Test mode: copy assets/placeholder.jpg to outputs/ and return URLs."""
    placeholder = Path(__file__).parent.parent / "assets" / "placeholder.jpg"
    if not placeholder.exists():
        logger.warning("Placeholder not found at %s — returning empty", placeholder)
        return {}

    handle = _to_handle(product_name)
    from datetime import date as _date
    out_dir = Path("outputs") / brand_key.lower() / _date.today().isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)

    import shutil
    paths = {
        "feed":      out_dir / f"{handle}_feed_test.jpg",
        "story_1":   out_dir / f"{handle}_story1_test.jpg",
        "story_2":   out_dir / f"{handle}_story2_test.jpg",
        "lifestyle": out_dir / f"{handle}_lifestyle_test.jpg",
    }
    for p in paths.values():
        shutil.copy2(str(placeholder), str(p))

    logger.info("Test mode — placeholder images written to %s", out_dir)
    return {k: _to_relative_url(str(v)) for k, v in paths.items()}


def generate_images(
    brand_key: str,
    product_name: str,
    visual_direction: str,
    channel: str,
    scene: str = "",
    scheduled_date: str = "",
    test_mode: bool = False,
    metadata: dict | None = None,
) -> dict:
    """
    Generate all images for a content item.

    Returns dict with keys: feed, story_1, story_2, lifestyle
    (all /outputs/... relative URLs, or None if not generated).

    Channels that don't need images return {}.
    """
    _CHANNELS_NEEDING_IMAGES = {"instagram_post", "instagram_stories", "tiktok"}
    if channel not in _CHANNELS_NEEDING_IMAGES:
        return {}

    if test_mode or os.getenv("TEST_MODE", "").lower() == "true":
        return _generate_placeholder_images(brand_key, product_name)

    # Resolve product image URL
    meta = metadata or {}
    product_image_url = meta.get("image_url", "")
    if not product_image_url:
        try:
            from src.shopify import get_product_metadata
            meta = get_product_metadata(brand_key, product_name) or {}
            product_image_url = meta.get("image_url", "")
        except Exception as e:
            logger.error("Could not fetch product image for '%s': %s", product_name, e)

    if not product_image_url:
        logger.error("No product image URL for '%s' — cannot generate images", product_name)
        return {}

    lifestyle_path = get_output_path(brand_key, product_name, scene=scene or "")
    success, scene_used = generate_lifestyle_image(
        brand_key=brand_key,
        product_name=product_name,
        campaign=visual_direction or "lifestyle editorial",
        product_image_url=product_image_url,
        output_path=lifestyle_path,
        scene_name=scene or None,
    )
    if not success:
        logger.error("Lifestyle image generation failed for '%s'", product_name)
        return {}

    # Composite into feed/story sizes
    try:
        from src.compositor import compose_all
        from src.onboarding import load_brand
        from datetime import date as _date

        brand = load_brand(brand_key)
        brand_name = brand.get("name", brand_key.upper())
        website_url = brand.get("storefront_url", "").replace("https://", "")
        price = meta.get("price", "")

        out_dir = Path("outputs") / brand_key.lower() / _date.today().isoformat()
        composite = compose_all(
            lifestyle_path, brand_key, brand_name,
            visual_direction or "editorial",
            product_name, website_url, str(out_dir), price=price,
        )
        return {
            "feed":      _to_relative_url(composite.get("feed_post_path")),
            "story_1":   _to_relative_url(composite.get("story_1_path")),
            "story_2":   _to_relative_url(composite.get("story_2_path")),
            "lifestyle": _to_relative_url(lifestyle_path),
        }
    except Exception as exc:
        logger.error("Composition failed for '%s': %s", product_name, exc)
        return {"lifestyle": _to_relative_url(lifestyle_path)}


if __name__ == "__main__":
    import subprocess
    from src.shopify import get_product_primary_image_url

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    product_url = get_product_primary_image_url("mbc", "Bernie Men's Slip On Sneaker")

    if not product_url:
        print("ERROR: could not fetch product image URL from Shopify")
        raise SystemExit(1)

    scenes_to_test = ["urban_loft", "city_street", "coffee_shop"]

    for scene in scenes_to_test:
        output_path = get_output_path("mbc", "Bernie Men's Slip On Sneaker", scene=scene)
        success, used_scene = generate_lifestyle_image(
            "mbc",
            "Bernie Men's Slip On Sneaker",
            "Why It Feels Different",
            product_url,
            output_path,
            scene_name=scene,
        )
        print(f"Scene '{used_scene}': {'OK' if success else 'FAILED'} -> {output_path}")

    print("\nDone. Open outputs/mbc/ to review all 3 scenes.")
    subprocess.Popen(["explorer", "outputs\\mbc"])
