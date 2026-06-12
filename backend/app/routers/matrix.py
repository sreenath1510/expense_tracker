"""Matrix endpoint — computes the dashboard pivot on demand."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import MatrixResponse
from app.security import get_current_user
from app.services.aggregation import build_matrix

router = APIRouter(prefix="/matrix", tags=["matrix"])


@router.get("", response_model=MatrixResponse)
def get_matrix(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> MatrixResponse:
    return build_matrix(db, user.id)
