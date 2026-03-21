from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.schemas import TodoStats, WeeklyCount
from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import List, Tag, Todo, User, list_members, todo_tags

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/", response_model=TodoStats)
def get_stats(
    list_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # アクセス可能なリスト ID を取得
    rows = db.execute(
        list_members.select().where(list_members.c.user_id == current_user.id)
    ).fetchall()
    accessible_list_ids = [r.list_id for r in rows]

    if list_id:
        if list_id not in accessible_list_ids:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="リストが見つかりません")
        target_ids = [list_id]
    else:
        target_ids = accessible_list_ids

    todos = db.query(Todo).filter(Todo.list_id.in_(target_ids)).all()

    total = len(todos)
    completed_count = sum(1 for t in todos if t.completed)
    completion_rate = round(completed_count / total * 100, 1) if total > 0 else 0.0

    by_priority: dict[str, int] = {"low": 0, "medium": 0, "high": 0}
    for t in todos:
        by_priority[t.priority] = by_priority.get(t.priority, 0) + 1

    # タグ別集計
    todo_ids = [t.id for t in todos]
    by_tag: dict[str, int] = {}
    if todo_ids:
        tag_rows = (
            db.query(Tag.name)
            .join(todo_tags, Tag.id == todo_tags.c.tag_id)
            .filter(todo_tags.c.todo_id.in_(todo_ids))
            .all()
        )
        for (name,) in tag_rows:
            by_tag[name] = by_tag.get(name, 0) + 1

    # 週間完了数（過去7日間）
    today = date.today()
    weekly: dict[str, int] = {}
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekly[d.isoformat()] = 0

    for t in todos:
        if t.completed and t.updated_at:
            d = t.updated_at.date().isoformat()
            if d in weekly:
                weekly[d] += 1

    weekly_completed = [WeeklyCount(date=k, count=v) for k, v in weekly.items()]

    return TodoStats(
        total=total,
        completed=completed_count,
        completion_rate=completion_rate,
        by_priority=by_priority,
        by_tag=by_tag,
        weekly_completed=weekly_completed,
    )
