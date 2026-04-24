"""
Google Drive operations — uploads generated assets to brand folders,
organised by brand and month.

Requires GOOGLE_CREDENTIALS_JSON (service account) and per-brand folder IDs:
  MBC_DRIVE_OUTPUT_FOLDER_ID
  MC_DRIVE_OUTPUT_FOLDER_ID
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
]
_BRAND_FOLDER_ENV = {
    "mbc": "MBC_DRIVE_OUTPUT_FOLDER_ID",
    "mc": "MC_DRIVE_OUTPUT_FOLDER_ID",
}

_service = None


def get_drive_service():
    """Authenticate with service account and return Drive v3 service. Cached per session."""
    global _service
    if _service is not None:
        return _service

    creds_path = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    if not creds_path or not Path(creds_path).exists():
        logger.warning("GOOGLE_CREDENTIALS_JSON not set or file not found — Drive unavailable")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            creds_path, scopes=_SCOPES
        )
        _service = build("drive", "v3", credentials=creds, cache_discovery=False)
        logger.info("Google Drive service authenticated")
        return _service

    except Exception as exc:
        logger.error("Drive auth failed: %s", exc)
        return None


def _brand_root_folder(brand_key: str) -> str | None:
    env_key = _BRAND_FOLDER_ENV.get(brand_key.lower(), "")
    folder_id = os.getenv(env_key, "") if env_key else ""
    if not folder_id:
        logger.warning(
            "Drive folder not configured for brand '%s' (env: %s)", brand_key, env_key
        )
    return folder_id or None


def get_or_create_month_folder(brand_key: str, month_label: str) -> str | None:
    """Return the Drive folder ID for month_label inside the brand root, creating it if absent."""
    service = get_drive_service()
    if not service:
        return None

    parent_id = _brand_root_folder(brand_key)
    if not parent_id:
        return None

    try:
        query = (
            f"'{parent_id}' in parents"
            f" and name = '{month_label}'"
            f" and mimeType = 'application/vnd.google-apps.folder'"
            f" and trashed = false"
        )
        res = service.files().list(q=query, fields="files(id, name)").execute()
        files = res.get("files", [])

        if files:
            fid = files[0]["id"]
            logger.info("Found month folder '%s': %s", month_label, fid)
            return fid

        meta = {
            "name": month_label,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        folder = service.files().create(body=meta, fields="id").execute()
        fid = folder["id"]
        logger.info("Created month folder '%s': %s", month_label, fid)
        return fid

    except Exception as exc:
        logger.error("get_or_create_month_folder failed: %s", exc)
        return None


def upload_image(
    local_path: str,
    brand_key: str,
    month_label: str,
    filename: str = None,
) -> str | None:
    """Upload a local image to the brand's month folder. Returns shareable view URL or None."""
    service = get_drive_service()
    if not service:
        logger.warning("Drive unavailable — skipping upload of %s", local_path)
        return None

    if not Path(local_path).exists():
        logger.warning("File not found, cannot upload: %s", local_path)
        return None

    folder_id = get_or_create_month_folder(brand_key, month_label)
    if not folder_id:
        return None

    try:
        from googleapiclient.http import MediaFileUpload

        upload_name = filename or Path(local_path).name
        mime = "image/jpeg" if local_path.lower().endswith((".jpg", ".jpeg")) else "image/png"

        meta = {"name": upload_name, "parents": [folder_id]}
        media = MediaFileUpload(local_path, mimetype=mime, resumable=False)
        file = service.files().create(body=meta, media_body=media, fields="id").execute()
        file_id = file["id"]

        service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
        ).execute()

        url = f"https://drive.google.com/file/d/{file_id}/view"
        logger.info("Uploaded '%s' -> %s", upload_name, url)
        return url

    except Exception as exc:
        logger.error("upload_image failed for %s: %s", local_path, exc)
        return None


def upload_content_package(
    brand_key: str,
    product_name: str,
    month_label: str,
    feed_post_path: str,
    story_1_path: str,
    story_2_path: str,
    lifestyle_path: str,
) -> dict:
    """Upload all four images for a content package. Returns dict of URLs and all_uploaded flag."""
    results = {
        "feed_post_url": upload_image(feed_post_path, brand_key, month_label),
        "story_1_url":   upload_image(story_1_path,   brand_key, month_label),
        "story_2_url":   upload_image(story_2_path,   brand_key, month_label),
        "lifestyle_url": upload_image(lifestyle_path,  brand_key, month_label),
    }
    results["all_uploaded"] = all(v is not None for v in results.values())
    return results


def find_product_lifestyle_from_drive(
    brand_key: str,
    product_name: str,
    output_path: str,
) -> bool:
    """Search the brand's Drive folder for a lifestyle image matching product_name.

    Downloads to output_path if found. Returns True on success.
    """
    service = get_drive_service()
    if not service:
        return False

    parent_id = _brand_root_folder(brand_key)
    if not parent_id:
        return False

    try:
        from src.image_gen import _to_handle
        from googleapiclient.http import MediaIoBaseDownload

        handle = _to_handle(product_name)
        query = (
            f"'{parent_id}' in parents"
            f" and name contains '{handle}'"
            f" and name contains 'lifestyle'"
            f" and trashed = false"
        )
        res = service.files().list(q=query, fields="files(id, name)").execute()
        files = res.get("files", [])

        if not files:
            logger.info("No Drive lifestyle image found for '%s'", product_name)
            return False

        file_id = files[0]["id"]
        logger.info("Found Drive lifestyle image: %s (%s)", files[0]["name"], file_id)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as fh:
            downloader = MediaIoBaseDownload(
                fh, service.files().get_media(fileId=file_id)
            )
            done = False
            while not done:
                _, done = downloader.next_chunk()

        logger.info("Downloaded lifestyle image to %s", output_path)
        return True

    except Exception as exc:
        logger.error("find_product_lifestyle_from_drive failed: %s", exc)
        return False
