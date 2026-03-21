"""
認証エンドポイントのテスト

- POST /auth/register : ユーザー登録
- POST /auth/login    : ログイン・JWT取得
"""


def test_register_success(client):
    """正常登録 → 201 とユーザー情報を返す"""
    resp = client.post("/auth/register", json={
        "email": "user@example.com",
        "password": "secret123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "user@example.com"
    assert "id" in data


def test_register_duplicate_email(client):
    """同じメールアドレスで2回登録 → 400"""
    payload = {"email": "dup@example.com", "password": "pass"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_login_success(client, registered_user):
    """正しいメール＆パスワードでログイン → access_token を返す"""
    resp = client.post("/auth/login", data={
        "username": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client, registered_user):
    """パスワード間違い → 401"""
    resp = client.post("/auth/login", data={
        "username": "test@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


def test_login_unknown_email(client):
    """未登録メールアドレス → 401"""
    resp = client.post("/auth/login", data={
        "username": "nobody@example.com",
        "password": "pass",
    })
    assert resp.status_code == 401


def test_protected_endpoint_without_token(client):
    """認証トークンなしで保護エンドポイントにアクセス → 401"""
    resp = client.get("/todos/")
    assert resp.status_code == 401
