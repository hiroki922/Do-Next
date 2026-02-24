import csv
import io
import os
import uuid
from datetime import date, timedelta

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.api.schemas import (
    ActivityLogResponse,
    BulkAction,
    CommentCreate,
    CommentResponse,
    PaginatedTodoResponse,
    SubTaskCreate,
    SubTaskResponse,
    SubTaskUpdate,
    AttachmentResponse,
    TodoCreate,
    TodoPositionUpdate,
    TodoResponse,
    TodoUpdate,
)
from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import ActivityLog, Attachment, Comment, List, SubTask, Tag, Todo, User, list_members, todo_tags

UPLOAD_DIR = "/app/uploads"

router = APIRouter(prefix="/todos", tags=["todos"])


# ---- ヘルパー ----

def _get_accessible_list_ids(user_id: int, db: Session) -> list[int]:
    rows = db.execute(
        list_members.select().where(list_members.c.user_id == user_id)
    ).fetchall()
    return [r.list_id for r in rows]


def _get_personal_list_id(user_id: int, db: Session) -> int:
    rows = db.execute(
        list_members.select().where(list_members.c.user_id == user_id, list_members.c.role == "owner")
    ).fetchall()
    list_ids = [r.list_id for r in rows]
    lst = db.query(List).filter(List.id.in_(list_ids), List.owner_id == user_id).order_by(List.id).first()
    if not lst:
        raise HTTPException(status_code=500, detail="個人リストが見つかりません")
    return lst.id


def _get_todo_or_404(todo_id: int, user_id: int, db: Session) -> Todo:
    accessible = _get_accessible_list_ids(user_id, db)
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.list_id.in_(accessible)).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo が見つかりません")
    return todo


def _as_list(val) -> list:
    """Safely convert a SQLAlchemy relationship value to a plain list."""
    if val is None:
        return []
    if isinstance(val, list):
        return val
    try:
        return list(val)
    except TypeError:
        return [val]


def _apply_tags(todo: Todo, tag_ids: list[int], user_id: int, db: Session) -> None:
    db.execute(todo_tags.delete().where(todo_tags.c.todo_id == todo.id))
    if tag_ids:
        valid_ids = [r.id for r in db.query(Tag.id).filter(Tag.id.in_(tag_ids), Tag.user_id == user_id).all()]
        if valid_ids:
            db.execute(todo_tags.insert(), [{"todo_id": todo.id, "tag_id": tid} for tid in valid_ids])
    db.expire(todo, ["tags"])


def _build_todo_response(todo: Todo) -> TodoResponse:
    return TodoResponse(
        id=todo.id,
        title=todo.title,
        description=todo.description,
        notes=todo.notes,
        completed=todo.completed,
        archived=todo.archived,
        status=todo.status,
        priority=todo.priority,
        due_date=todo.due_date,
        due_time=todo.due_time,
        recurrence=todo.recurrence,
        recurrence_end_date=todo.recurrence_end_date,
        position=todo.position,
        assignee_id=todo.assignee_id,
        assignee_email=todo.assignee.email if todo.assignee else None,
        list_id=todo.list_id,
        tags=[{"id": t.id, "name": t.name, "color": t.color} for t in _as_list(todo.tags)],
        sub_tasks=[
            {"id": s.id, "title": s.title, "completed": s.completed, "created_at": s.created_at}
            for s in _as_list(todo.sub_tasks)
        ],
        attachments_count=len(_as_list(todo.attachments)),
        comments_count=len(_as_list(todo.comments)),
        created_at=todo.created_at,
        updated_at=todo.updated_at,
    )


def _log_activity(todo_id: int, user_id: int, action: str, detail: str | None, db: Session) -> None:
    log = ActivityLog(todo_id=todo_id, user_id=user_id, action=action, detail=detail)
    db.add(log)


def _generate_next_due(current: date, recurrence: str) -> date:
    if recurrence == "daily":
        return current + timedelta(days=1)
    if recurrence == "weekly":
        return current + timedelta(weeks=1)
    if recurrence == "monthly":
        month = current.month + 1
        year = current.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        import calendar
        day = min(current.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    return current


def _handle_recurrence(todo: Todo, user_id: int, db: Session) -> None:
    if todo.recurrence == "none" or not todo.due_date:
        return
    next_due = _generate_next_due(todo.due_date, todo.recurrence)
    if todo.recurrence_end_date and next_due > todo.recurrence_end_date:
        return
    new_todo = Todo(
        title=todo.title,
        description=todo.description,
        notes=todo.notes,
        priority=todo.priority,
        status="todo",
        due_date=next_due,
        due_time=todo.due_time,
        recurrence=todo.recurrence,
        recurrence_end_date=todo.recurrence_end_date,
        list_id=todo.list_id,
        assignee_id=todo.assignee_id,
    )
    db.add(new_todo)
    db.flush()
    tag_ids = [t.id for t in _as_list(todo.tags)]
    _apply_tags(new_todo, tag_ids, user_id, db)


# ---- 一覧 ----

@router.get("/", response_model=PaginatedTodoResponse)
def list_todos(
    list_id: int | None = Query(None),
    q: str | None = Query(None),
    completed: bool | None = Query(None),
    priority: str | None = Query(None),
    tag_id: int | None = Query(None),
    due_before: date | None = Query(None),
    overdue: bool | None = Query(None),
    archived: bool = Query(False),
    sort_by: str = Query("created_at", pattern="^(created_at|due_date|priority|position)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accessible = _get_accessible_list_ids(current_user.id, db)
    target_ids = [list_id] if list_id and list_id in accessible else accessible

    query = db.query(Todo).filter(Todo.list_id.in_(target_ids), Todo.archived == archived)

    if q:
        like = f"%{q}%"
        query = query.filter(Todo.title.ilike(like) | Todo.description.ilike(like))
    if completed is not None:
        query = query.filter(Todo.completed == completed)
    if priority:
        query = query.filter(Todo.priority == priority)
    if tag_id is not None:
        query = query.filter(Todo.tags.any(Tag.id == tag_id))
    if due_before:
        query = query.filter(Todo.due_date <= due_before)
    if overdue:
        query = query.filter(Todo.due_date < date.today(), Todo.completed == False)

    total = query.count()

    sort_col = getattr(Todo, sort_by)
    order_fn = desc if sort_order == "desc" else asc
    items = query.order_by(order_fn(sort_col)).offset((page - 1) * per_page).limit(per_page).all()

    return PaginatedTodoResponse(
        items=[_build_todo_response(t) for t in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if total > 0 else 1,
    )


# ---- CSVエクスポート ----

@router.get("/export")
def export_todos_csv(
    list_id: int | None = Query(None),
    q: str | None = Query(None),
    completed: bool | None = Query(None),
    priority: str | None = Query(None),
    archived: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accessible = _get_accessible_list_ids(current_user.id, db)
    target_ids = [list_id] if list_id and list_id in accessible else accessible

    query = db.query(Todo).filter(Todo.list_id.in_(target_ids), Todo.archived == archived)
    if q:
        like = f"%{q}%"
        query = query.filter(Todo.title.ilike(like) | Todo.description.ilike(like))
    if completed is not None:
        query = query.filter(Todo.completed == completed)
    if priority:
        query = query.filter(Todo.priority == priority)

    todos = query.order_by(asc(Todo.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "タイトル", "説明", "優先度", "完了", "期限日", "期限時刻", "繰り返し", "タグ", "作成日"])
    for t in todos:
        writer.writerow([
            t.id,
            t.title,
            t.description or "",
            t.priority,
            "完了" if t.completed else "未完了",
            t.due_date.isoformat() if t.due_date else "",
            t.due_time or "",
            t.recurrence,
            ",".join(tag.name for tag in t.tags),
            t.created_at.isoformat(),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=todos.csv"},
    )


# ---- 作成 ----

@router.post("/", response_model=TodoResponse, status_code=201)
def create_todo(
    payload: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accessible = _get_accessible_list_ids(current_user.id, db)
    list_id = payload.list_id if payload.list_id in accessible else _get_personal_list_id(current_user.id, db)

    todo = Todo(
        title=payload.title,
        description=payload.description,
        notes=payload.notes,
        priority=payload.priority,
        status=payload.status,
        due_date=payload.due_date,
        due_time=payload.due_time,
        recurrence=payload.recurrence,
        recurrence_end_date=payload.recurrence_end_date,
        list_id=list_id,
        assignee_id=payload.assignee_id,
    )
    db.add(todo)
    db.flush()
    _apply_tags(todo, payload.tag_ids, current_user.id, db)
    _log_activity(todo.id, current_user.id, "created", todo.title, db)
    db.commit()
    db.refresh(todo)
    return _build_todo_response(todo)


# ---- 一括操作 ----

@router.post("/bulk", status_code=204)
def bulk_action(
    payload: BulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accessible = _get_accessible_list_ids(current_user.id, db)
    todos = db.query(Todo).filter(Todo.id.in_(payload.ids), Todo.list_id.in_(accessible)).all()
    for todo in todos:
        if payload.action == "complete":
            todo.completed = True
            _log_activity(todo.id, current_user.id, "completed", None, db)
        elif payload.action == "delete":
            db.delete(todo)
        elif payload.action == "archive":
            todo.archived = True
            _log_activity(todo.id, current_user.id, "archived", None, db)
        elif payload.action == "unarchive":
            todo.archived = False
            _log_activity(todo.id, current_user.id, "unarchived", None, db)
    db.commit()


# ---- 詳細 ----

@router.get("/{todo_id}", response_model=TodoResponse)
def get_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = _get_todo_or_404(todo_id, current_user.id, db)
    return _build_todo_response(todo)


# ---- 更新 ----

@router.patch("/{todo_id}", response_model=TodoResponse)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = _get_todo_or_404(todo_id, current_user.id, db)
    update_data = payload.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)

    was_completed = todo.completed
    was_archived = todo.archived
    for key, value in update_data.items():
        setattr(todo, key, value)

    if tag_ids is not None:
        _apply_tags(todo, tag_ids, current_user.id, db)

    if not was_completed and todo.completed:
        _handle_recurrence(todo, current_user.id, db)
        _log_activity(todo.id, current_user.id, "completed", None, db)
    elif not was_archived and todo.archived:
        _log_activity(todo.id, current_user.id, "archived", None, db)
    elif was_archived and not todo.archived:
        _log_activity(todo.id, current_user.id, "unarchived", None, db)
    else:
        _log_activity(todo.id, current_user.id, "updated", None, db)

    db.commit()
    db.refresh(todo)
    return _build_todo_response(todo)


# ---- 削除 ----

@router.delete("/{todo_id}", status_code=204)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = _get_todo_or_404(todo_id, current_user.id, db)
    db.delete(todo)
    db.commit()


# ---- 複製 ----

@router.post("/{todo_id}/duplicate", response_model=TodoResponse, status_code=201)
def duplicate_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = _get_todo_or_404(todo_id, current_user.id, db)
    new_todo = Todo(
        title=f"{original.title} (コピー)",
        description=original.description,
        notes=original.notes,
        priority=original.priority,
        status=original.status,
        due_date=original.due_date,
        due_time=original.due_time,
        recurrence=original.recurrence,
        recurrence_end_date=original.recurrence_end_date,
        list_id=original.list_id,
        assignee_id=original.assignee_id,
    )
    db.add(new_todo)
    db.flush()
    orig_tag_ids = [t.id for t in _as_list(original.tags)]
    _apply_tags(new_todo, orig_tag_ids, current_user.id, db)
    _log_activity(new_todo.id, current_user.id, "created", f"Duplicated from #{original.id}", db)
    db.commit()
    db.refresh(new_todo)
    return _build_todo_response(new_todo)


# ---- 位置更新 ----

@router.patch("/{todo_id}/position", response_model=TodoResponse)
def update_todo_position(
    todo_id: int,
    payload: TodoPositionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = _get_todo_or_404(todo_id, current_user.id, db)
    todo.position = payload.position
    db.commit()
    db.refresh(todo)
    return _build_todo_response(todo)


# ---- サブタスク ----

@router.get("/{todo_id}/subtasks", response_model=list[SubTaskResponse])
def list_subtasks(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    return db.query(SubTask).filter(SubTask.todo_id == todo_id).all()


@router.post("/{todo_id}/subtasks", response_model=SubTaskResponse, status_code=201)
def create_subtask(
    todo_id: int,
    payload: SubTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    sub = SubTask(todo_id=todo_id, title=payload.title)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.patch("/{todo_id}/subtasks/{sub_id}", response_model=SubTaskResponse)
def update_subtask(
    todo_id: int,
    sub_id: int,
    payload: SubTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    sub = db.query(SubTask).filter(SubTask.id == sub_id, SubTask.todo_id == todo_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="サブタスクが見つかりません")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, key, value)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{todo_id}/subtasks/{sub_id}", status_code=204)
def delete_subtask(
    todo_id: int,
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    sub = db.query(SubTask).filter(SubTask.id == sub_id, SubTask.todo_id == todo_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="サブタスクが見つかりません")
    db.delete(sub)
    db.commit()


# ---- 添付ファイル ----

@router.post("/{todo_id}/attachments", response_model=AttachmentResponse, status_code=201)
async def upload_attachment(
    todo_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    stored_name = f"{uuid.uuid4()}{ext}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)

    content = await file.read()
    async with aiofiles.open(stored_path, "wb") as f:
        await f.write(content)

    att = Attachment(
        todo_id=todo_id,
        filename=file.filename or stored_name,
        stored_path=stored_path,
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/{todo_id}/attachments/{att_id}")
def download_attachment(
    todo_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    att = db.query(Attachment).filter(Attachment.id == att_id, Attachment.todo_id == todo_id).first()
    if not att or not os.path.exists(att.stored_path):
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")
    return FileResponse(att.stored_path, filename=att.filename, media_type=att.content_type)


@router.delete("/{todo_id}/attachments/{att_id}", status_code=204)
def delete_attachment(
    todo_id: int,
    att_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    att = db.query(Attachment).filter(Attachment.id == att_id, Attachment.todo_id == todo_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="添付ファイルが見つかりません")
    if os.path.exists(att.stored_path):
        os.remove(att.stored_path)
    db.delete(att)
    db.commit()


# ---- コメント ----

@router.get("/{todo_id}/comments", response_model=list[CommentResponse])
def list_comments(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    comments = db.query(Comment).filter(Comment.todo_id == todo_id).order_by(Comment.created_at.asc()).all()
    return [
        CommentResponse(
            id=c.id,
            todo_id=c.todo_id,
            user_id=c.user_id,
            user_email=c.user.email,
            content=c.content,
            created_at=c.created_at,
        )
        for c in comments
    ]


@router.post("/{todo_id}/comments", response_model=CommentResponse, status_code=201)
def create_comment(
    todo_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    comment = Comment(todo_id=todo_id, user_id=current_user.id, content=payload.content)
    db.add(comment)
    db.flush()
    _log_activity(todo_id, current_user.id, "commented", payload.content[:100], db)
    db.commit()
    db.refresh(comment)
    return CommentResponse(
        id=comment.id,
        todo_id=comment.todo_id,
        user_id=comment.user_id,
        user_email=current_user.email,
        content=comment.content,
        created_at=comment.created_at,
    )


@router.delete("/{todo_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    todo_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.todo_id == todo_id,
        Comment.user_id == current_user.id,
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="コメントが見つかりません")
    db.delete(comment)
    db.commit()


# ---- アクティビティログ ----

@router.get("/{todo_id}/activity", response_model=list[ActivityLogResponse])
def list_activity(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_todo_or_404(todo_id, current_user.id, db)
    logs = db.query(ActivityLog).filter(ActivityLog.todo_id == todo_id).order_by(ActivityLog.created_at.desc()).all()
    return [
        ActivityLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=log.user.email,
            action=log.action,
            detail=log.detail,
            created_at=log.created_at,
        )
        for log in logs
    ]
