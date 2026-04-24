# MBC Automation

Automated social media and email content generation pipeline for Milwaukee Boot Company.

## What it does

For each campaign entry in `config/campaign_plan.json` the pipeline:

1. Fetches product images from the Shopify Admin API
2. Generates a lifestyle background image via Gemini Imagen 3
3. Composites a 1080x1080 post image and a 1080x1920 story image with Pillow
4. Generates caption, hashtags, story copy, and email copy via the Anthropic API
5. Uploads all images to Google Drive
6. Writes results to Google Sheets
7. Emails Justine an approval preview via Gmail

## Project structure

```
mbc-automation/
├── config/campaign_plan.json   # List of campaign items to process
├── src/
│   ├── pipeline.py             # Entry point — orchestrates the full run
│   ├── shopify.py              # Shopify Admin API client
│   ├── image_gen.py            # Gemini Imagen 3 lifestyle image generation
│   ├── compositor.py           # Pillow image compositing (post + story)
│   ├── copy_gen.py             # Anthropic API copy generation
│   ├── sheets.py               # Google Sheets read/write via gspread
│   ├── drive.py                # Google Drive upload
│   ├── notify.py               # Gmail approval email
│   └── zoho_social.py          # Phase 2: Zoho Social scheduling (placeholder)
├── assets/fonts/               # Custom fonts for Pillow compositor
├── outputs/                    # Generated images (git-ignored)
└── templates/
    ├── email_approval.html     # Approval email sent to Justine
    └── klaviyo_email.html      # Klaviyo campaign email template
```

## Setup

### 1. Clone and enter the repo

```bash
git clone <repo-url>
cd mbc-automation
```

### 2. Fill in `.env`

Copy the keys below and fill in the values:

```
ANTHROPIC_API_KEY=          # claude.ai → API keys
GEMINI_API_KEY=             # aistudio.google.com
SHOPIFY_STORE=milwaukeebootcompany.myshopify.com
SHOPIFY_ADMIN_TOKEN=        # Shopify Admin → Apps → private app token
GOOGLE_CREDENTIALS_JSON=service_account.json   # path to service account JSON
GOOGLE_SHEET_ID=            # from the Sheets URL
GOOGLE_DRIVE_FOLDER_ID=     # from the Drive folder URL
JUSTINE_EMAIL=              # approval recipient
GMAIL_SENDER=nalin@progilityconsulting.in
KLAVIYO_API_KEY=            # Klaviyo → Account → API keys
ZOHO_SOCIAL_CLIENT_ID=      # Phase 2
ZOHO_SOCIAL_CLIENT_SECRET=  # Phase 2
```

Place your Google service account JSON file at the project root as `service_account.json` (it is git-ignored via `.gitignore`).

### 3. Add campaign items

Edit `config/campaign_plan.json` — each entry should describe a post to generate.  
Example shape (fields to be finalised during implementation):

```json
[
  {
    "product_id": "12345678",
    "platform": "instagram",
    "scheduled_date": "2026-05-01",
    "tone_notes": "rugged, outdoorsy",
    "status": "pending"
  }
]
```

## Running

### With Docker (recommended)

```bash
# Build and run once
docker-compose run agent

# Rebuild after dependency changes
docker-compose build && docker-compose run agent
```

### Without Docker (local venv)

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m src.pipeline
```

## Requirements

- Python 3.12
- Docker + Docker Compose (for containerised runs)
- Google service account with access to Sheets and Drive
- Shopify private app with `read_products` scope
