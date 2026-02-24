from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.schemas import (
    ListCreate, PasswordChange, RefreshRequest,
    TokenPair, UserCreate, UserResponse,
)
from app.core.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import List, RefreshToken, User, list_members

router = APIRouter(prefix="/auth", tags=["auth"])


def _create_personal_list(user: User, db: Session) -> List:
    lst = List(name="個人リスト", owner_id=user.id)
    db.add(lst)
    db.flush()
    db.execute(
        list_members.insert().values(list_id=lst.id, user_id=user.id, role="owner")
    )
    return lst


def _issue_token_pair(user: User, db: Session) -> TokenPair:
    access_token = create_access_token({"sub": str(user.id)})
    raw_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    rt = RefreshToken(user_id=user.id, token=raw_refresh, expires_at=expires)
    db.add(rt)
    db.commit()
    return TokenPair(access_token=access_token, refresh_token=raw_refresh)


@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="このメールアドレスは既に登録されています")
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.flush()
    _create_personal_list(user, db)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _issue_token_pair(user, db)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter(RefreshToken.token == payload.refresh_token).first()
    if not rt:
        raise HTTPException(status_code=401, detail="無効なリフレッシュトークンです")
    if rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(rt)
        db.commit()
        raise HTTPException(status_code=401, detail="リフレッシュトークンの有効期限が切れています")
    user = rt.user
    db.delete(rt)
    db.flush()
    return _issue_token_pair(user, db)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter(RefreshToken.token == payload.refresh_token).first()
    if rt:
        db.delete(rt)
        db.commit()


@router.patch("/me/password", status_code=204)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="現在のパスワードが正しくありません")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
