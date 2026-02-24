from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.schemas import ListCreate, ListMemberAdd, ListMemberResponse, ListResponse, ListUpdate
from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import List, User, list_members

router = APIRouter(prefix="/lists", tags=["lists"])


def _is_member(list_id: int, user_id: int, db: Session) -> bool:
    row = db.execute(
        list_members.select().where(
            list_members.c.list_id == list_id,
            list_members.c.user_id == user_id,
        )
    ).first()
    return row is not None


def _get_list_or_404(list_id: int, user_id: int, db: Session) -> List:
    lst = db.query(List).filter(List.id == list_id).first()
    if not lst or not _is_member(list_id, user_id, db):
        raise HTTPException(status_code=404, detail="リストが見つかりません")
    return lst


def _get_member_role(list_id: int, user_id: int, db: Session) -> str:
    row = db.execute(
        list_members.select().where(
            list_members.c.list_id == list_id,
            list_members.c.user_id == user_id,
        )
    ).first()
    return row.role if row else "editor"


def _build_response(lst: List, db: Session) -> ListResponse:
    rows = db.execute(
        list_members.select().where(list_members.c.list_id == lst.id)
    ).fetchall()
    members = []
    for row in rows:
        u = db.query(User).filter(User.id == row.user_id).first()
        if u:
            members.append(ListMemberResponse(id=u.id, email=u.email, role=row.role))
    return ListResponse(
        id=lst.id,
        name=lst.name,
        owner_id=lst.owner_id,
        created_at=lst.created_at,
        members=members,
    )


@router.get("/", response_model=list[ListResponse])
def list_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        list_members.select().where(list_members.c.user_id == current_user.id)
    ).fetchall()
    result = []
    for row in rows:
        lst = db.query(List).filter(List.id == row.list_id).first()
        if lst:
            result.append(_build_response(lst, db))
    return result


@router.post("/", response_model=ListResponse, status_code=201)
def create_list(
    payload: ListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lst = List(name=payload.name, owner_id=current_user.id)
    db.add(lst)
    db.flush()
    db.execute(
        list_members.insert().values(list_id=lst.id, user_id=current_user.id, role="owner")
    )
    db.commit()
    db.refresh(lst)
    return _build_response(lst, db)


@router.patch("/{list_id}", response_model=ListResponse)
def update_list(
    list_id: int,
    payload: ListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lst = _get_list_or_404(list_id, current_user.id, db)
    if lst.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="オーナーのみ変更できます")
    lst.name = payload.name
    db.commit()
    db.refresh(lst)
    return _build_response(lst, db)


@router.delete("/{list_id}", status_code=204)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lst = _get_list_or_404(list_id, current_user.id, db)
    if lst.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="オーナーのみ削除できます")
    db.delete(lst)
    db.commit()


@router.post("/{list_id}/members", response_model=ListResponse, status_code=201)
def add_member(
    list_id: int,
    payload: ListMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lst = _get_list_or_404(list_id, current_user.id, db)
    if lst.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="オーナーのみメンバーを追加できます")
    target = db.query(User).filter(User.email == payload.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if _is_member(list_id, target.id, db):
        raise HTTPException(status_code=400, detail="すでにメンバーです")
    db.execute(
        list_members.insert().values(list_id=list_id, user_id=target.id, role=payload.role)
    )
    db.commit()
    db.refresh(lst)
    return _build_response(lst, db)


@router.delete("/{list_id}/members/{user_id}", status_code=204)
def remove_member(
    list_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lst = _get_list_or_404(list_id, current_user.id, db)
    if lst.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="オーナーのみメンバーを削除できます")
    if user_id == lst.owner_id:
        raise HTTPException(status_code=400, detail="オーナーは削除できません")
    db.execute(
        list_members.delete().where(
            list_members.c.list_id == list_id,
            list_members.c.user_id == user_id,
        )
    )
    db.commit()
