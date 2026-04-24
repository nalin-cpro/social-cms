"""
Sends approval notification emails via Gmail API using a service account
with domain-wide delegation. Falls back gracefully if not configured.

Requires GOOGLE_CREDENTIALS_JSON and GMAIL_SENDER in environment.
The service account must have domain-wide delegation enabled and the
Gmail send scope authorised in Google Workspace Admin.
"""

import base64
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
_gmail_service = None


def get_gmail_service():
    """Authenticate for Gmail API using service account with domain-wide delegation."""
    global _gmail_service
    if _gmail_service is not None:
        return _gmail_service

    creds_path = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    sender = os.getenv("GMAIL_SENDER", "")

    if not creds_path or not Path(creds_path).exists():
        logger.warning("GOOGLE_CREDENTIALS_JSON not set or file not found — Gmail unavailable")
        return None
    if not sender:
        logger.warning("GMAIL_SENDER not set — Gmail unavailable")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            creds_path, scopes=_GMAIL_SCOPES
        )
        delegated = creds.with_subject(sender)
        _gmail_service = build("gmail", "v1", credentials=delegated, cache_discovery=False)
        logger.info("Gmail service authenticated (sender: %s)", sender)
        return _gmail_service

    except Exception as exc:
        logger.error("Gmail auth failed: %s", exc)
        return None


def build_approval_email_html(
    brand_name: str,
    month_label: str,
    posts: list,
) -> str:
    """Build a clean HTML approval email from a list of post dicts."""

    post_blocks = ""
    for post in posts:
        image_block = ""
        if post.get("feed_post_url"):
            image_block = (
                f'<a href="{post["feed_post_url"]}">'
                f'<img src="{post["feed_post_url"]}" '
                f'style="max-width:480px;width:100%;border-radius:8px;margin:12px 0;" '
                f'alt="{post.get("product_name", "")}">'
                f"</a>"
            )

        raw_caption = post.get("caption") or post.get("hook") or ""
        caption_preview = raw_caption[:150] + ("…" if len(raw_caption) > 150 else "")
        caption_block = (
            f'<p style="color:#444;font-size:14px;line-height:1.6;margin:8px 0 0;">'
            f"{caption_preview}</p>"
            if caption_preview else ""
        )

        channel_label = post.get("channel", "").replace("_", " ").title()
        post_blocks += f"""
        <div style="border:1px solid #e8e8e8;border-radius:10px;padding:24px;
                    margin-bottom:28px;background:#fff;">
          <p style="font-size:12px;color:#999;text-transform:uppercase;
                    letter-spacing:.08em;margin:0 0 4px;">
            {post.get("scheduled_date", "")}
            &nbsp;·&nbsp; {channel_label}
            &nbsp;·&nbsp; {post.get("campaign", "")}
          </p>
          <h3 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:4px 0 12px;">
            {post.get("product_name", "")}
          </h3>
          {image_block}
          {caption_block}
          <p style="font-size:13px;color:#aaa;margin:16px 0 0;font-style:italic;">
            Reply "Approved" or leave comments on this post.
          </p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{brand_name} Content Approval</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;">

        <tr><td style="background:#1a1a1a;border-radius:10px 10px 0 0;padding:32px 36px;">
          <h1 style="color:#fff;font-size:22px;font-weight:600;margin:0 0 6px;">
            {brand_name}
          </h1>
          <p style="color:#aaa;font-size:14px;margin:0;">
            Content for Approval &nbsp;·&nbsp; {month_label}
          </p>
        </td></tr>

        <tr><td style="background:#fff;padding:24px 36px 20px;
                       border-left:1px solid #e8e8e8;border-right:1px solid #e8e8e8;">
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0;">
            Please review the content below and reply to approve,
            or leave comments on any post. We'll action revisions
            and send an updated version for your final sign-off.
          </p>
        </td></tr>

        <tr><td style="background:#f4f4f4;padding:20px 36px;
                       border-left:1px solid #e8e8e8;border-right:1px solid #e8e8e8;">
          {post_blocks}
        </td></tr>

        <tr><td style="background:#fff;border-radius:0 0 10px 10px;
                       padding:20px 36px;border:1px solid #e8e8e8;border-top:none;">
          <p style="color:#ccc;font-size:12px;margin:0;text-align:center;">
            Managed by Progility &nbsp;·&nbsp;
            <a href="https://progilityconsulting.in"
               style="color:#ccc;text-decoration:none;">progilityconsulting.in</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_approval_email(
    brand_key: str,
    month_label: str,
    posts: list,
    approver_email: str = None,
) -> bool:
    """Send approval email to the brand's configured approver. Returns True on success."""
    try:
        from src.onboarding import load_brand

        service = get_gmail_service()
        if not service:
            logger.warning("Gmail unavailable — skipping approval email for %s", brand_key)
            return False

        brand = load_brand(brand_key)
        brand_name = brand.get("name", brand_key.upper())
        sender = os.getenv("GMAIL_SENDER", "")

        to_email = (
            approver_email
            or brand.get("approver_email")
            or os.getenv("JUSTINE_EMAIL", "")
        )
        if not to_email:
            logger.warning("No approver email configured for %s — skipping", brand_key)
            return False

        subject = f"{brand_name} Content — {month_label} — Ready for Review"
        html_body = build_approval_email_html(brand_name, month_label, posts)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()

        logger.info(
            "Approval email sent to %s | brand=%s month=%s posts=%d",
            to_email, brand_key, month_label, len(posts),
        )
        return True

    except Exception as exc:
        logger.error("send_approval_email failed: %s", exc)
        return False


def send_revision_notification(
    brand_key: str,
    product_name: str,
    channel: str,
    internal_email: str,
) -> bool:
    """Notify the internal team when a client comment triggers an automatic revision."""
    try:
        service = get_gmail_service()
        if not service:
            logger.warning("Gmail unavailable — skipping revision notification")
            return False

        sender = os.getenv("GMAIL_SENDER", "")
        subject = f"Content revised — {product_name} ({channel})"
        body = (
            f"A client comment on {product_name} ({channel}) triggered "
            f"an automatic revision. The updated content is ready for "
            f"your review before it goes back to the client.\n\nLog in to review."
        )

        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = internal_email
        msg.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()

        logger.info("Revision notification sent to %s", internal_email)
        return True

    except Exception as exc:
        logger.error("send_revision_notification failed: %s", exc)
        return False
