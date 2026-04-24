"""
Phase 2 placeholder — schedules approved posts to Zoho Social.
Uses ZOHO_SOCIAL_CLIENT_ID and ZOHO_SOCIAL_CLIENT_SECRET from environment.
No logic implemented yet.
"""

from dotenv import load_dotenv

load_dotenv()


def get_access_token() -> str:
    pass


def schedule_post(image_url: str, caption: str, scheduled_time: str, channels: list[str]) -> dict:
    pass
