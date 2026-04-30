"""Stability AI provider — stub, not yet implemented."""

from src.image_providers.base import ImageProvider


class StabilityProvider(ImageProvider):

    def generate(
        self,
        product_image_url: str,
        prompt: str,
        mode: str = "lifestyle",
        reference_image_url: str | None = None,
    ) -> str:
        raise NotImplementedError("StabilityProvider is not yet implemented")
