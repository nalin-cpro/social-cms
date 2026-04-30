from src.image_providers.base import ImageProvider


def get_provider(provider_name: str) -> ImageProvider:
    """Return an ImageProvider instance for the given provider name.

    Provider names match the image_provider field on Brand records.
    Default: 'fal_flux'
    """
    if not provider_name or provider_name == "fal_flux":
        from src.image_providers.fal_flux import FalFluxProvider
        return FalFluxProvider()
    if provider_name == "stability":
        from src.image_providers.stability import StabilityProvider
        return StabilityProvider()
    if provider_name == "ideogram":
        from src.image_providers.ideogram import IdeogramProvider
        return IdeogramProvider()
    raise ValueError(f"Unknown image provider: {provider_name!r}")


__all__ = ["ImageProvider", "get_provider"]
