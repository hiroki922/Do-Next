"""
テスト共通フィクスチャ

- SQLite in-memory DB を使用（PostgreSQL 不要でテスト可能）
- DATABASE_URL を SQLite に差し替えてから app をインポートする
- 各テスト関数ごとにテーブルを作成・削除してクリーンな状態を保つ
- client: FastAPI TestClient（DB依存をテスト用DBで上書き）
- auth_headers: ユーザー登録＆ログイン済みの認証ヘッダー
- default_list_id: 登録時に自動作成される「個人リスト」のID
"""

import os

# app インポート前に DATABASE_URL を SQLite へ差し替え
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# 環境変数を設定してから app をインポート
from app.db.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# SQLite で外部キー制約を有効化
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    """各テスト前にテーブル作成、終了後に削除"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(setup_db):
    """テスト用DBセッション"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """テスト用 FastAPI クライアント（DB をテスト用に差し替え）"""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client):
    """テスト用ユーザーを登録して返す"""
    resp = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def auth_headers(client, registered_user):
    """ログイン済みの Bearer トークンヘッダー"""
    resp = client.post("/auth/login", data={
        "username": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def default_list_id(client, auth_headers):
    """ユーザー登録時に自動作成される「個人リスト」のID"""
    resp = client.get("/lists/", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()[0]["id"]
