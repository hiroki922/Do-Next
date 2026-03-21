# アーキテクチャ設計

## システム構成図

```
ブラウザ
  │
  │ HTTP (localhost:3000)
  ▼
┌─────────────────────────┐
│  Frontend               │
│  React 18 + Vite        │
│  (Node.js コンテナ)     │
└────────────┬────────────┘
             │ HTTP API (localhost:8000)
             ▼
┌─────────────────────────┐
│  Backend                │
│  FastAPI + Uvicorn      │
│  (Python コンテナ)      │
└────────────┬────────────┘
             │ SQLAlchemy (TCP 5432)
             ▼
┌─────────────────────────┐
│  Database               │
│  PostgreSQL 16          │
│  (DB コンテナ)          │
└─────────────────────────┘
```

## ディレクトリ構成

```
Do-Next/
├── app/                        # FastAPI バックエンド
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py         # 認証エンドポイント
│   │   │   ├── todos.py        # タスクエンドポイント
│   │   │   ├── tags.py         # タグエンドポイント
│   │   │   ├── lists.py        # リストエンドポイント
│   │   │   └── stats.py        # 統計エンドポイント
│   │   └── schemas.py          # Pydantic スキーマ（Request/Response型定義）
│   ├── core/
│   │   ├── security.py         # JWT生成・検証・パスワードハッシュ
│   │   └── deps.py             # 認証 Dependency（get_current_user）
│   ├── db/
│   │   ├── models.py           # SQLAlchemy モデル（テーブル定義）
│   │   └── database.py         # DB接続・セッション管理
│   ├── config.py               # 環境変数設定（DATABASE_URL等）
│   └── main.py                 # FastAPIアプリ起動・ルーター登録
│
├── frontend/                   # React フロントエンド
│   └── src/
│       ├── components/
│       │   ├── TodoItem.jsx        # タスクカード（表示・編集・サブタスク・コメント）
│       │   ├── KanbanView.jsx      # カンバンボード（ドラッグ&ドロップ）
│       │   ├── CalendarView.jsx    # カレンダービュー（祝日計算含む）
│       │   ├── ListSidebar.jsx     # サイドバー（リスト・メンバー管理）
│       │   ├── StatsPage.jsx       # 統計ページ
│       │   ├── TagManager.jsx      # タグ管理
│       │   ├── BulkActions.jsx     # 一括操作バー
│       │   ├── Pagination.jsx      # ページネーション
│       │   ├── TodoDetailModal.jsx # タスク詳細モーダル
│       │   ├── CommentPanel.jsx    # コメント・アクティビティパネル
│       │   ├── SubTaskList.jsx     # サブタスクリスト
│       │   ├── AttachmentPanel.jsx # 添付ファイルパネル
│       │   └── AccountSettings.jsx # アカウント設定
│       ├── App.jsx             # メインコンポーネント・ルーティング
│       ├── App.css             # グローバルスタイル
│       ├── api.js              # APIクライアント（fetch ラッパー）
│       ├── auth.js             # JWT トークン管理（localStorage）
│       └── tests/              # フロントエンドテスト（Vitest）
│
├── tests/                      # バックエンドテスト（pytest）
│   ├── conftest.py             # フィクスチャ（SQLite テスト用DB）
│   ├── test_auth.py            # 認証テスト
│   └── test_todos.py           # タスクCRUDテスト
│
├── docs/                       # 設計書
├── docker-compose.yml          # コンテナ構成定義
├── Dockerfile                  # バックエンド Dockerfile
├── requirements.txt            # 本番依存パッケージ
├── requirements-test.txt       # テスト用依存パッケージ
└── pytest.ini                  # pytest設定

```

## 認証フロー

```
1. ログイン
   クライアント → POST /auth/login
   サーバー → access_token（30分）+ refresh_token（30日）を返す
   クライアント → localStorage に保存

2. API呼び出し
   クライアント → Authorization: Bearer <access_token> ヘッダーを付与
   サーバー → JWT検証 → ユーザー特定

3. トークン期限切れ
   クライアント → POST /auth/refresh（refresh_token を送信）
   サーバー → 新しい access_token + refresh_token を返す

4. ログアウト
   クライアント → POST /auth/logout（refresh_token を送信）
   サーバー → refresh_token をDBから削除
   クライアント → localStorage をクリア
```

## データフロー（カンバンボード ステータス変更の例）

```
1. ユーザーがカードをドラッグ&ドロップ
2. React: onDrop イベント発火
3. React: 楽観的UI更新（即時表示変更）
4. React: PATCH /todos/{id} { status: "in_progress" } を送信
5. FastAPI: JWT検証 → Todo取得 → status更新 → DB commit
6. FastAPI: 更新後の TodoResponse を返す
7. React: APIレスポンスで状態を確定更新
   （失敗時は楽観的更新をロールバック）
```

## 環境変数

| 変数名 | デフォルト値 | 説明 |
|-------|------------|------|
| DATABASE_URL | postgresql://postgres:password@db:5432/appdb | PostgreSQL接続URL |
