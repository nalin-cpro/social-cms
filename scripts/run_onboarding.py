"""
One-time brand onboarding script.
Fetches Instagram reference images and runs Claude Vision analysis.
Caches result to config/brand_analysis_{brand_key}.json.

Usage:
    python scripts/run_onboarding.py mbc
    python scripts/run_onboarding.py mc
"""

import logging
import sys
from pathlib import Path

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.onboarding import analyse_brand_instagram

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    brand_key = sys.argv[1] if len(sys.argv) > 1 else "mbc"
    print(f"\nRunning brand onboarding for: {brand_key}\n")

    analysis = analyse_brand_instagram(brand_key)

    if analysis:
        print("\nBrand analysis complete.")
        print(f"Motifs       : {analysis.get('recurring_motifs', [])}")
        print(f"Palette      : {analysis.get('colour_palette', {}).get('dominant_colours', [])}")
        print(f"Settings     : {analysis.get('settings_and_environments', {}).get('most_common', [])}")
        print(f"\nFLUX style addition:\n  {analysis.get('flux_style_prompt_addition', '')}")
        print(f"\nAlways do    : {analysis.get('what_to_always_do', [])}")
        print(f"Never do     : {analysis.get('what_to_never_do', [])}")
        print(f"\nCached to    : config/brand_analysis_{brand_key}.json")
    else:
        print("Analysis failed — check logs above.")
        sys.exit(1)
