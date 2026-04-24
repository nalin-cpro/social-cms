"""
Reads and writes campaign data to Google Sheets via gspread.
Uses GOOGLE_CREDENTIALS_JSON and GOOGLE_SHEET_ID from environment.
"""

from dotenv import load_dotenv

load_dotenv()


def get_sheet_client():
    pass


def read_pending_rows(worksheet_name: str = "Posts") -> list[dict]:
    pass


def update_row_status(row_index: int, status: str, notes: str = "") -> None:
    pass


def append_output_row(data: dict, worksheet_name: str = "Outputs") -> None:
    pass
