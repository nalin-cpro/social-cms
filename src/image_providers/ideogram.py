"""Ideogram provider — stub, not yet implemented."""

from src.image_providers.base import ImageProvider


class IdeogramProvider(ImageProvider):

    def generate(
        self,
        product_image_url: str,
        prompt: str,
        mode: str = "lifestyle",
        reference_image_url: str | None = None,
    ) -> str:
        raise NotImplementedError("IdeogramProvider is not yet implemented")
