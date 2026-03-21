"""
Todo エンドポイントのテスト

- POST   /todos/      : タスク作成
- GET    /todos/      : 一覧取得・フィルター・ページネーション
- PATCH  /todos/{id}  : 更新（ステータス変更含む）
- DELETE /todos/{id}  : 削除
"""

import pytest


# ── ヘルパー ─────────────────────────────────────────────

def create_todo(client, auth_headers, default_list_id, **kwargs):
    """テスト用タスクを作成して JSON を返す"""
    payload = {
        "title": "テストタスク",
        "list_id": default_list_id,
        **kwargs,
    }
    resp = client.post("/todos/", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── 作成 ─────────────────────────────────────────────────

def test_create_todo_minimal(client, auth_headers, default_list_id):
    """タイトルだけで作成できる"""
    todo = create_todo(client, auth_headers, default_list_id)
    assert todo["title"] == "テストタスク"
    assert todo["status"] == "todo"
    assert todo["completed"] is False


def test_create_todo_with_all_fields(client, auth_headers, default_list_id):
    """全フィールド指定で作成できる"""
    todo = create_todo(
        client, auth_headers, default_list_id,
        title="詳細タスク",
        description="説明文",
        priority="high",
        due_date="2099-12-31",
        status="in_progress",
    )
    assert todo["title"] == "詳細タスク"
    assert todo["priority"] == "high"
    assert todo["status"] == "in_progress"
    assert todo["due_date"] == "2099-12-31"


def test_create_todo_requires_auth(client, default_list_id):
    """認証なしで作成 → 401"""
    resp = client.post("/todos/", json={"title": "x", "list_id": default_list_id})
    assert resp.status_code == 401


# ── 一覧取得 ──────────────────────────────────────────────

def test_list_todos(client, auth_headers, default_list_id):
    """作成したタスクが一覧に含まれる"""
    create_todo(client, auth_headers, default_list_id, title="A")
    create_todo(client, auth_headers, default_list_id, title="B")
    resp = client.get("/todos/", headers=auth_headers)
    assert resp.status_code == 200
    titles = [t["title"] for t in resp.json()["items"]]
    assert "A" in titles
    assert "B" in titles


def test_filter_by_completed(client, auth_headers, default_list_id):
    """completed=true フィルターで完了タスクのみ返る"""
    todo = create_todo(client, auth_headers, default_list_id, title="完了タスク")
    client.patch(f"/todos/{todo['id']}", json={"completed": True}, headers=auth_headers)

    resp = client.get("/todos/?completed=true", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(t["completed"] for t in items)


def test_filter_by_status(client, auth_headers, default_list_id):
    """status フィルターで該当ステータスのみ返る"""
    create_todo(client, auth_headers, default_list_id, title="進行中", status="in_progress")
    create_todo(client, auth_headers, default_list_id, title="未着手", status="todo")

    resp = client.get("/todos/?status=in_progress", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["status"] == "in_progress"


def test_filter_by_priority(client, auth_headers, default_list_id):
    """priority フィルターで該当優先度のみ返る"""
    create_todo(client, auth_headers, default_list_id, title="高", priority="high")
    create_todo(client, auth_headers, default_list_id, title="低", priority="low")

    resp = client.get("/todos/?priority=high", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(t["priority"] == "high" for t in items)


def test_search_by_keyword(client, auth_headers, default_list_id):
    """q パラメータでタイトル検索"""
    create_todo(client, auth_headers, default_list_id, title="ユニークなタイトル")
    create_todo(client, auth_headers, default_list_id, title="別のタスク")

    resp = client.get("/todos/?q=ユニーク", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert "ユニーク" in items[0]["title"]


def test_pagination(client, auth_headers, default_list_id):
    """per_page=2 でページネーションが機能する"""
    for i in range(5):
        create_todo(client, auth_headers, default_list_id, title=f"タスク{i}")

    resp = client.get("/todos/?page=1&per_page=2", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["pages"] == 3


# ── 更新 ──────────────────────────────────────────────────

def test_update_title(client, auth_headers, default_list_id):
    """タイトルを更新できる"""
    todo = create_todo(client, auth_headers, default_list_id)
    resp = client.patch(f"/todos/{todo['id']}", json={"title": "更新済み"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "更新済み"


def test_update_status(client, auth_headers, default_list_id):
    """ステータスを 未着手 → 進行中 → 完了 と変更できる"""
    todo = create_todo(client, auth_headers, default_list_id)
    assert todo["status"] == "todo"

    resp = client.patch(f"/todos/{todo['id']}", json={"status": "in_progress"}, headers=auth_headers)
    assert resp.json()["status"] == "in_progress"

    resp = client.patch(f"/todos/{todo['id']}", json={"status": "done"}, headers=auth_headers)
    assert resp.json()["status"] == "done"


def test_complete_todo(client, auth_headers, default_list_id):
    """completed=true で完了にできる"""
    todo = create_todo(client, auth_headers, default_list_id)
    resp = client.patch(f"/todos/{todo['id']}", json={"completed": True}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["completed"] is True


def test_update_other_users_todo(client, auth_headers, default_list_id):
    """他ユーザーのタスクは更新できない → 403 or 404"""
    todo = create_todo(client, auth_headers, default_list_id)

    # 別ユーザーを作成してログイン
    client.post("/auth/register", json={"email": "other@example.com", "password": "pass123"})
    resp = client.post("/auth/login", data={"username": "other@example.com", "password": "pass123"})
    other_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    resp = client.patch(f"/todos/{todo['id']}", json={"title": "不正更新"}, headers=other_headers)
    assert resp.status_code in (403, 404)


# ── 削除 ──────────────────────────────────────────────────

def test_delete_todo(client, auth_headers, default_list_id):
    """タスクを削除できる"""
    todo = create_todo(client, auth_headers, default_list_id)
    resp = client.delete(f"/todos/{todo['id']}", headers=auth_headers)
    assert resp.status_code == 204

    # 削除後は取得できない
    resp = client.get(f"/todos/{todo['id']}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_nonexistent_todo(client, auth_headers):
    """存在しないタスクの削除 → 404"""
    resp = client.delete("/todos/99999", headers=auth_headers)
    assert resp.status_code == 404
