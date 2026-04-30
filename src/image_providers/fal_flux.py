"""fal.ai FLUX Pro Kontext image provider."""

import logging
import os

import fal_client

from src.image_providers.base import ImageProvider

logger = logging.getLogger(__name__)

_FAL_MODEL = "fal-ai/flux-pro/kontext"

# Strength settings per mode
_STRENGTH = {
    "lifestyle":  0.85,   # strong creative generation from product photo
    "swap":       0.70,   # moderate — keep scene, replace product
    "style_ref":  0.90,   # high — use reference only for style cues
}

# guidance scale per mode
_GUIDANCE = {
    "lifestyle":  3.5,
    "swap":       4.0,
    "style_ref":  3.5,
}


class FalFluxProvider(ImageProvider):

    def generate(
        self,
        product_image_url: str,
        prompt: str,
        mode: str = "lifestyle",
        reference_image_url: str | None = None,
    ) -> str:
        fal_api_key = os.getenv("FAL_API_KEY", "")
        if not fal_api_key:
            raise RuntimeError("FAL_API_KEY is not set")
        os.environ["FAL_KEY"] = fal_api_key

        # For swap/style_ref: use the reference image as the base; for lifestyle: use product
        image_url = reference_image_url if mode in ("swap", "style_ref") and reference_image_url else product_image_url

        args = {
            "prompt": prompt,
            "image_url": image_url,
            "image_size": "square_hd",
            "num_images": 1,
            "output_format": "jpeg",
            "guidance_scale": _GUIDANCE.get(mode, 3.5),
            "strength": _STRENGTH.get(mode, 0.85),
        }

        logger.info("fal.ai %s | mode=%s | model=%s", mode, mode, _FAL_MODEL)
        result = fal_client.run(_FAL_MODEL, arguments=args)

        images = result.get("images", [])
        if not images:
            raise RuntimeError("fal.ai returned empty images list")

        url = images[0].get("url", "")
        if not url:
            raise RuntimeError(f"fal.ai image entry has no URL: {images[0]}")

        logger.info("fal.ai generated: %s", url)
        return url
