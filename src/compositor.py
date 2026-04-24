"""
Composites final campaign images using Pillow.
The lifestyle image from fal.ai Kontext already contains the product,
so compositor only adds text overlays and brand identity elements:
  - 1080x1080 feed post  (brand bar, campaign label, product name, URL)
  - 1080x1920 story x2   (progress bars, headline, body, accent bar)
"""

import logging
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

POST_SIZE  = (1080, 1080)
STORY_SIZE = (1080, 1920)

# Brand identity
_MBC_ACCENT = (180, 130, 70)    # cognac gold
_MC_ACCENT  = (80, 80, 80)      # neutral slate
_WHITE      = (255, 255, 255, 255)
_WHITE_50   = (255, 255, 255, 128)
_WHITE_70   = (255, 255, 255, 178)


# ── Font loading ──────────────────────────────────────────────────────────────

def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "assets/fonts/brand_font.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/Arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
            else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            font = ImageFont.truetype(path, size)
            logger.info("Font loaded: %s size=%d", path, size)
            return font
        except (IOError, OSError):
            continue
    logger.warning("No TTF font found for size=%d, using default", size)
    return ImageFont.load_default()


# ── Shared helpers ────────────────────────────────────────────────────────────

def _cover_crop(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = int(src_w * scale), int(src_h * scale)
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - target_w) // 2
    top  = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def _flat_overlay(canvas: Image.Image, rgba: tuple) -> None:
    """Apply a uniform RGBA colour over the entire canvas."""
    overlay = Image.new("RGBA", canvas.size, rgba)
    base = canvas.convert("RGBA")
    base.paste(overlay, mask=overlay.split()[3])
    canvas.paste(base.convert(canvas.mode))


def _draw_text(
    draw: ImageDraw.Draw,
    text: str,
    position: tuple,
    font: ImageFont.FreeTypeFont,
    fill: tuple = _WHITE,
) -> None:
    logger.info("Drawing: '%s' at %s", str(text)[:40], position)
    draw.text(position, text, font=font, fill=fill)


def _brand_accent(brand_key: str) -> tuple:
    return _MC_ACCENT if brand_key.lower() == "mc" else _MBC_ACCENT


# ── Feed post ─────────────────────────────────────────────────────────────────

def composite_post(
    lifestyle_image_path: str,
    brand_key: str,
    brand_name: str,
    campaign: str,
    product_name: str,
    website_url: str,
    output_path: str,
) -> str:
    """Create a 1080x1080 feed post from the Kontext lifestyle image.

    Overlays: brand colour bar (top-left), brand name + campaign label,
    dark bottom strip with product name and website URL.
    No product image pasting — Kontext already placed the product.
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    accent = _brand_accent(brand_key)

    canvas = _cover_crop(Image.open(lifestyle_image_path).convert("RGB"), POST_SIZE)

    # Light dark overlay so text is legible without killing the scene
    _flat_overlay(canvas, (0, 0, 0, 100))

    draw = ImageDraw.Draw(canvas, "RGBA")

    # Top-left brand bar (4px × 80px colour accent)
    draw.rectangle([(48, 48), (52, 128)], fill=accent + (255,))

    # Brand name (white bold 18px) and campaign label (accent 13px)
    font_brand    = load_font(18, bold=True)
    font_campaign = load_font(13, bold=False)
    _draw_text(draw, brand_name.upper(), (64, 52), font_brand, fill=_WHITE)
    _draw_text(draw, campaign.upper(),   (64, 78), font_campaign, fill=accent + (255,))

    # Bottom dark strip
    draw.rectangle([(0, POST_SIZE[1] - 100), POST_SIZE], fill=(0, 0, 0, 180))

    font_product = load_font(22, bold=True)
    font_url     = load_font(12, bold=False)
    _draw_text(draw, product_name,  (48, POST_SIZE[1] - 88), font_product, fill=_WHITE)
    _draw_text(draw, website_url,   (48, POST_SIZE[1] - 56), font_url,     fill=_WHITE_50)

    canvas.save(output_path, "JPEG", quality=92, optimize=True)
    logger.info("Feed post saved: %s", output_path)
    return output_path


# ── Story frame ───────────────────────────────────────────────────────────────

def composite_story(
    lifestyle_image_path: str,
    brand_key: str,
    brand_name: str,
    campaign: str,
    headline: str,
    body_text: str,
    website_url: str,
    output_path: str,
    variant: int = 1,
    total_stories: int = 2,
) -> str:
    """Create a 1080x1920 story from the Kontext lifestyle image.

    Overlays: progress bars (top), brand name centred, headline,
    body text, accent bar + Shop Now CTA (bottom).
    No product image pasting — Kontext already placed the product.
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    accent = _brand_accent(brand_key)

    canvas = _cover_crop(Image.open(lifestyle_image_path).convert("RGB"), STORY_SIZE)
    _flat_overlay(canvas, (0, 0, 0, 130))

    draw = ImageDraw.Draw(canvas, "RGBA")

    # Progress bars
    bar_w      = (STORY_SIZE[0] - 48 - (total_stories - 1) * 8) // total_stories
    bar_y      = 48
    bar_h      = 3
    for i in range(total_stories):
        x = 24 + i * (bar_w + 8)
        colour = (255, 255, 255, 255) if i < variant else (255, 255, 255, 80)
        draw.rectangle([(x, bar_y), (x + bar_w, bar_y + bar_h)], fill=colour)

    # Brand name centred at y=80
    font_brand = load_font(18, bold=True)
    bbox = draw.textbbox((0, 0), brand_name.upper(), font=font_brand)
    bw = bbox[2] - bbox[0]
    _draw_text(draw, brand_name.upper(), ((STORY_SIZE[0] - bw) // 2, 80), font_brand, fill=_WHITE)

    # Headline (white bold 52px) at y=280
    font_headline = load_font(52, bold=True)
    _draw_text(draw, headline, (48, 280), font_headline, fill=_WHITE)

    # Body text (white 70% opacity 28px) below headline
    font_body = load_font(28, bold=False)
    _draw_text(draw, body_text, (48, 360), font_body, fill=_WHITE_70)

    # Accent bar at bottom
    bar_bottom_y = STORY_SIZE[1] - 160
    draw.rectangle([(48, bar_bottom_y), (52, bar_bottom_y + 80)], fill=accent + (255,))

    # Shop Now CTA
    font_cta = load_font(22, bold=True)
    font_url = load_font(14, bold=False)
    _draw_text(draw, "Shop Now",   (64, bar_bottom_y + 4),  font_cta, fill=_WHITE)
    _draw_text(draw, website_url,  (64, bar_bottom_y + 36), font_url, fill=_WHITE_50)

    canvas.save(output_path, "JPEG", quality=92, optimize=True)
    logger.info("Story variant %d saved: %s", variant, output_path)
    return output_path


def compose_all(
    lifestyle_image_path: str,
    brand_key: str,
    brand_name: str,
    campaign: str,
    product_name: str,
    website_url: str,
    output_dir: str,
    price: str = "",
) -> dict:
    """Composite feed post and 2 story frames from a single lifestyle image.

    Returns {"feed_post_path": str, "story_1_path": str, "story_2_path": str}.
    Raises on missing lifestyle image so the pipeline can catch and record it.
    """
    import re
    from pathlib import Path as _Path

    handle = re.sub(
        r"-+", "-",
        re.sub(r"[^a-z0-9\s-]", "", product_name.lower().replace("'", "").replace("\u2019", ""))
        .strip().replace(" ", "-"),
    )
    out = _Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    feed_path = str(out / f"{handle}_feed.jpg")
    story_1_path = str(out / f"{handle}_story_1.jpg")
    story_2_path = str(out / f"{handle}_story_2.jpg")

    # Story 1: campaign headline + product intro
    words = campaign.split()
    headline_1 = " ".join(words[:4]) + ("." if not campaign.endswith(".") else "")
    body_1 = f"The {product_name.split()[0]}. Worn in, not just worn."

    # Story 2: product name + price/URL
    headline_2 = product_name.split()[0] + "."
    body_2 = (f"${price} · Free shipping · {website_url}" if price else f"Free shipping · {website_url}")

    composite_post(
        lifestyle_image_path, brand_key, brand_name, campaign,
        product_name, website_url, feed_path,
    )
    composite_story(
        lifestyle_image_path, brand_key, brand_name, campaign,
        headline_1, body_1, website_url, story_1_path,
        variant=1, total_stories=2,
    )
    composite_story(
        lifestyle_image_path, brand_key, brand_name, campaign,
        headline_2, body_2, website_url, story_2_path,
        variant=2, total_stories=2,
    )

    return {
        "feed_post_path": feed_path,
        "story_1_path": story_1_path,
        "story_2_path": story_2_path,
    }


if __name__ == "__main__":
    import sys
    import re
    from datetime import date
    from src.shopify import get_product_metadata
    from src.image_gen import get_output_path as gen_output_path

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    BRAND        = "mbc"
    PRODUCT_NAME = "Bernie Men's Slip On Sneaker"
    CAMPAIGN     = "Why It Feels Different"
    BRAND_NAME   = "Milwaukee Boot Company"
    WEBSITE_URL  = "milwaukeebootcompany.com"

    meta = get_product_metadata(BRAND, PRODUCT_NAME)
    if not meta.get("image_url"):
        logger.error("Could not fetch product metadata — aborting")
        sys.exit(1)

    today  = date.today().isoformat()
    handle = re.sub(r"-+", "-", re.sub(r"[^a-z0-9\s-]", "",
        PRODUCT_NAME.lower().replace("'", "").replace("\u2019", "")).replace(" ", "-"))
    out_dir = Path("outputs") / BRAND / today
    out_dir.mkdir(parents=True, exist_ok=True)

    lifestyle_img_path = gen_output_path(BRAND, PRODUCT_NAME, suffix="lifestyle")
    if not os.path.exists(lifestyle_img_path):
        logger.error(
            "Lifestyle image not found at %s — run python -m src.image_gen first",
            lifestyle_img_path,
        )
        sys.exit(1)

    feed_path   = str(out_dir / f"{handle}_feed.jpg")
    story1_path = str(out_dir / f"{handle}_story_1.jpg")
    story2_path = str(out_dir / f"{handle}_story_2.jpg")

    logger.info("Compositing feed post...")
    composite_post(
        lifestyle_img_path,
        brand_key=BRAND,
        brand_name=BRAND_NAME,
        campaign=CAMPAIGN,
        product_name=PRODUCT_NAME,
        website_url=WEBSITE_URL,
        output_path=feed_path,
    )

    logger.info("Compositing story 1...")
    composite_story(
        lifestyle_img_path,
        brand_key=BRAND,
        brand_name=BRAND_NAME,
        campaign=CAMPAIGN,
        headline="Why It Feels\nDifferent.",
        body_text="Premium leather. Everyday ease.",
        website_url=WEBSITE_URL,
        output_path=story1_path,
        variant=1,
        total_stories=2,
    )

    logger.info("Compositing story 2...")
    composite_story(
        lifestyle_img_path,
        brand_key=BRAND,
        brand_name=BRAND_NAME,
        campaign=CAMPAIGN,
        headline="The Bernie\nSlip-On.",
        body_text="$175 · Free shipping · milwaukeebootcompany.com",
        website_url=WEBSITE_URL,
        output_path=story2_path,
        variant=2,
        total_stories=2,
    )

    print()
    for path in [feed_path, story1_path, story2_path]:
        size_kb = os.path.getsize(path) // 1024
        print(f"{Path(path).name}: {size_kb} KB")
