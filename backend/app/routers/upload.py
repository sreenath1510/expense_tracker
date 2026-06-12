"""Upload + parse: accepts a CSV/Excel statement, returns raw uncategorized rows."""

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas import RawStatementRow
from app.services.parser import parse_statement

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/parse", response_model=list[RawStatementRow])
async def upload_parse(file: UploadFile = File(...)) -> list[RawStatementRow]:
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file provided")

    contents = await file.read()
    if not contents:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")

    try:
        rows = parse_statement(file.filename, contents)
    except Exception as exc:  # noqa: BLE001 — surface parse failure cleanly
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Could not parse the file: {exc}",
        )
    return rows
