from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


# ---- Tag ----

class TagCreate(BaseModel):
    name: str
    color: str | None = None


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: str | None

    model_config = {"from_attributes": True}


# ---- SubTask ----

class SubTaskCreate(BaseModel):
    title: str


class SubTaskUpdate(BaseModel):
    title: str | None = None
    completed: bool | None = None


class SubTaskResponse(BaseModel):
    id: int
    title: str
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Attachment ----

class AttachmentResponse(BaseModel):
    id: int
    filename: str
    content_type: str
    size: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Comment ----

class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    todo_id: int
    user_id: int
    user_email: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- ActivityLog ----

class ActivityLogResponse(BaseModel):
    id: int
    user_id: int
    user_email: str
    action: str
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Todo ----

class TodoCreate(BaseModel):
    title: str
    description: str | None = None
    notes: str | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: date | None = None
    due_time: str | None = None  # "HH:MM"
    recurrence: Literal["none", "daily", "weekly", "monthly"] = "none"
    recurrence_end_date: date | None = None
    status: Literal["todo", "in_progress", "done"] = "todo"
    tag_ids: list[int] = []
    list_id: int | None = None
    assignee_id: int | None = None


class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    notes: str | None = None
    completed: bool | None = None
    archived: bool | None = None
    status: Literal["todo", "in_progress", "done"] | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: date | None = None
    due_time: str | None = None  # "HH:MM"
    recurrence: Literal["none", "daily", "weekly", "monthly"] | None = None
    recurrence_end_date: date | None = None
    tag_ids: list[int] | None = None
    assignee_id: int | None = None
    position: int | None = None


class TodoResponse(BaseModel):
    id: int
    title: str
    description: str | None
    notes: str | None
    completed: bool
    archived: bool
    status: str
    priority: str
    due_date: date | None
    due_time: str | None
    recurrence: str
    recurrence_end_date: date | None
    position: int | None
    assignee_id: int | None
    assignee_email: str | None
    list_id: int
    tags: list[TagResponse]
    sub_tasks: list[SubTaskResponse]
    attachments_count: int
    comments_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if hasattr(obj, "attachments") and not hasattr(obj, "attachments_count"):
            obj.__dict__["attachments_count"] = len(obj.attachments)
        return super().model_validate(obj, *args, **kwargs)


class PaginatedTodoResponse(BaseModel):
    items: list[TodoResponse]
    total: int
    page: int
    per_page: int
    pages: int


class BulkAction(BaseModel):
    ids: list[int]
    action: Literal["complete", "delete", "archive", "unarchive"]


class TodoPositionUpdate(BaseModel):
    position: int


# ---- List ----

class ListCreate(BaseModel):
    name: str


class ListUpdate(BaseModel):
    name: str


class ListMemberAdd(BaseModel):
    email: EmailStr
    role: Literal["editor"] = "editor"


class ListMemberResponse(BaseModel):
    id: int
    email: str
    role: str = "editor"

    model_config = {"from_attributes": True}


class ListResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    created_at: datetime
    members: list[ListMemberResponse]

    model_config = {"from_attributes": True}


# ---- Auth ----

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ---- Stats ----

class WeeklyCount(BaseModel):
    date: str
    count: int


class TodoStats(BaseModel):
    total: int
    completed: int
    completion_rate: float
    by_priority: dict[str, int]
    by_tag: dict[str, int]
    weekly_completed: list[WeeklyCount]
