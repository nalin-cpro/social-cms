from abc import ABC, abstractmethod


class ImageProvider(ABC):
    @abstractmethod
    def generate(
        self,
        product_image_url: str,
        prompt: str,
        mode: str = "lifestyle",
        reference_image_url: str | None = None,
    ) -> str:
        """Call the image generation API and return the generated image CDN URL.

        Args:
            product_image_url: Shopify or uploaded product photo to use as base.
            prompt: Full generation prompt (built by image_gen.py).
            mode: 'lifestyle' | 'swap' | 'style_ref'
              lifestyle   — generate new scene using product as subject
              swap        — keep reference scene, replace only the product
              style_ref   — generate new scene matching reference mood/lighting
            reference_image_url: Required for swap and style_ref modes.
              For lifestyle this is unused.

        Returns:
            CDN URL of the generated image (not yet downloaded locally).
        Raises:
            RuntimeError on generation failure.
        """
        pass
