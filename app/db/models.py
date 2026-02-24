from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


# ---- 中間テーブル ----

todo_tags = Table(
    "todo_tags",
    Base.metadata,
    Column("todo_id", Integer, ForeignKey("todos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

list_members = Table(
    "list_members",
    Base.metadata,
    Column("list_id", Integer, ForeignKey("lists.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(20), nullable=False, default="editor"),
)


# ---- ユーザー ----

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    tags: Mapped[list["Tag"]] = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    owned_lists: Mapped[list["List"]] = relationship("List", back_populates="owner", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    member_lists: Mapped[list["List"]] = relationship("List", secondary=list_members, back_populates="members")


# ---- リスト ----

class List(Base):
    __tablename__ = "lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped["User"] = relationship("User", back_populates="owned_lists")
    members: Mapped[list["User"]] = relationship("User", secondary=list_members, back_populates="member_lists")
    todos: Mapped[list["Todo"]] = relationship("Todo", back_populates="list", cascade="all, delete-orphan")


# ---- タグ ----

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # e.g. "#3b82f6"
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="tags")
    todos: Mapped[list["Todo"]] = relationship("Todo", secondary=todo_tags, back_populates="tags")


# ---- Todo ----

class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", name="priority_enum"),
        default="medium",
        nullable=False,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM" 形式
    recurrence: Mapped[str] = mapped_column(
        Enum("none", "daily", "weekly", "monthly", name="recurrence_enum"),
        default="none",
        nullable=False,
    )
    recurrence_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("todo", "in_progress", "done", name="status_enum"),
        default="todo",
        nullable=False,
    )
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assignee_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    list_id: Mapped[int] = mapped_column(Integer, ForeignKey("lists.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    list: Mapped["List"] = relationship("List", back_populates="todos")
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assignee_id])
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary=todo_tags, back_populates="todos")
    sub_tasks: Mapped[list["SubTask"]] = relationship("SubTask", back_populates="todo", cascade="all, delete-orphan")
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="todo", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="todo", cascade="all, delete-orphan")
    activity_logs: Mapped[list["ActivityLog"]] = relationship("ActivityLog", back_populates="todo", cascade="all, delete-orphan")


# ---- サブタスク ----

class SubTask(Base):
    __tablename__ = "sub_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    todo_id: Mapped[int] = mapped_column(Integer, ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    todo: Mapped["Todo"] = relationship("Todo", back_populates="sub_tasks")


# ---- 添付ファイル ----

class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    todo_id: Mapped[int] = mapped_column(Integer, ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    content_type: Mapped[str] = mapped_column(String(200), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    todo: Mapped["Todo"] = relationship("Todo", back_populates="attachments")


# ---- コメント ----

class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    todo_id: Mapped[int] = mapped_column(Integer, ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    todo: Mapped["Todo"] = relationship("Todo", back_populates="comments")
    user: Mapped["User"] = relationship("User")


# ---- アクティビティログ ----

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    todo_id: Mapped[int] = mapped_column(Integer, ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # "created","updated","completed","archived","commented"
    detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    todo: Mapped["Todo"] = relationship("Todo", back_populates="activity_logs")
    user: Mapped["User"] = relationship("User")


# ---- リフレッシュトークン ----

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
