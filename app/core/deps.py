from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import get_db
from app.db.models import List, User, list_members

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証情報が無効です",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def get_list_member(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> tuple[List, str]:
    """リストへのアクセス権を確認し、(list, role) を返す"""
    lst = db.query(List).filter(List.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="リストが見つかりません")
    row = db.execute(
        list_members.select().where(
            list_members.c.list_id == list_id,
            list_members.c.user_id == current_user.id,
        )
    ).first()
    if not row:
        raise HTTPException(status_code=403, detail="このリストへのアクセス権がありません")
    return lst, row.role
