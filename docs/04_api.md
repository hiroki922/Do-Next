# API設計

ベースURL: `http://localhost:8000`

認証が必要なエンドポイントは `Authorization: Bearer <access_token>` ヘッダーが必要。

Swagger UI: http://localhost:8000/docs

---

## 認証 `/auth`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| POST | /auth/register | 不要 | ユーザー登録 |
| POST | /auth/login | 不要 | ログイン（JWTトークン取得） |
| POST | /auth/refresh | 不要 | アクセストークン再発行 |
| POST | /auth/logout | 不要 | ログアウト（リフレッシュトークン無効化） |
| PATCH | /auth/me/password | 必要 | パスワード変更 |

### POST /auth/register
```json
// Request
{ "email": "user@example.com", "password": "secret123" }

// Response 201
{ "id": 1, "email": "user@example.com", "created_at": "..." }
```

### POST /auth/login
```
// Request (form-data)
username=user@example.com&password=secret123

// Response 200
{ "access_token": "...", "refresh_token": "..." }
```

---

## タグ `/tags`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /tags/ | 必要 | タグ一覧取得 |
| POST | /tags/ | 必要 | タグ作成 |
| PATCH | /tags/{tag_id} | 必要 | タグ更新 |
| DELETE | /tags/{tag_id} | 必要 | タグ削除 |

---

## リスト `/lists`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /lists/ | 必要 | リスト一覧取得（メンバー含む） |
| POST | /lists/ | 必要 | リスト作成 |
| PATCH | /lists/{list_id} | 必要 | リスト名変更 |
| DELETE | /lists/{list_id} | 必要 | リスト削除 |
| POST | /lists/{list_id}/members | 必要 | メンバー招待 |
| DELETE | /lists/{list_id}/members/{user_id} | 必要 | メンバー削除 |

---

## タスク `/todos`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /todos/ | 必要 | タスク一覧取得（フィルター・ページネーション） |
| POST | /todos/ | 必要 | タスク作成 |
| GET | /todos/export | 必要 | CSVエクスポート |
| GET | /todos/{todo_id} | 必要 | タスク詳細取得 |
| PATCH | /todos/{todo_id} | 必要 | タスク更新 |
| DELETE | /todos/{todo_id} | 必要 | タスク削除 |
| POST | /todos/{todo_id}/duplicate | 必要 | タスク複製 |
| POST | /todos/bulk | 必要 | 一括操作（完了・削除・アーカイブ） |
| PATCH | /todos/{todo_id}/position | 必要 | 手動並び替え |

### GET /todos/ クエリパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| list_id | integer | - | リストでフィルター |
| q | string | - | キーワード検索（タイトル・説明） |
| completed | boolean | - | 完了状態でフィルター |
| status | string | - | ステータスでフィルター（todo / in_progress / done） |
| priority | string | - | 優先度でフィルター（low / medium / high） |
| tag_id | integer | - | タグIDでフィルター |
| due_before | date | - | 指定日以前の期限でフィルター |
| overdue | boolean | - | 期限切れのみ |
| archived | boolean | false | アーカイブ済みを表示 |
| sort_by | string | created_at | 並び替え項目（created_at / due_date / priority / position） |
| sort_order | string | desc | 並び順（asc / desc） |
| page | integer | 1 | ページ番号 |
| per_page | integer | 20 | 1ページあたりの件数（最大500） |

### POST /todos/ リクエスト例
```json
{
  "title": "タスクタイトル",
  "description": "説明",
  "notes": "メモ",
  "priority": "high",
  "status": "todo",
  "due_date": "2025-12-31",
  "due_time": "18:00",
  "recurrence": "none",
  "tag_ids": [1, 2],
  "list_id": 1
}
```

---

## サブタスク `/todos/{todo_id}/subtasks`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /todos/{todo_id}/subtasks | 必要 | サブタスク一覧 |
| POST | /todos/{todo_id}/subtasks | 必要 | サブタスク作成 |
| PATCH | /todos/{todo_id}/subtasks/{sub_id} | 必要 | サブタスク更新 |
| DELETE | /todos/{todo_id}/subtasks/{sub_id} | 必要 | サブタスク削除 |

---

## 添付ファイル `/todos/{todo_id}/attachments`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| POST | /todos/{todo_id}/attachments | 必要 | ファイルアップロード（multipart/form-data） |
| GET | /todos/{todo_id}/attachments/{att_id} | 必要 | ファイルダウンロード |
| DELETE | /todos/{todo_id}/attachments/{att_id} | 必要 | ファイル削除 |

---

## コメント `/todos/{todo_id}/comments`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /todos/{todo_id}/comments | 必要 | コメント一覧 |
| POST | /todos/{todo_id}/comments | 必要 | コメント投稿 |
| DELETE | /todos/{todo_id}/comments/{comment_id} | 必要 | コメント削除 |

---

## アクティビティ `/todos/{todo_id}/activity`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /todos/{todo_id}/activity | 必要 | アクティビティログ取得 |

---

## 統計 `/stats`

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /stats/ | 必要 | 統計データ取得（期間フィルター対応） |

---

## その他

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | /health | 不要 | ヘルスチェック |
