# Do-Next

FastAPI + PostgreSQL + React + Docker Compose によるフルスタック タスク管理アプリです。

## 機能

- ユーザー認証（JWT）
- Todo の CRUD（作成・一覧・更新・削除）
- **3段階ステータス**（未着手 / 進行中 / 完了）
- 優先度（高/中/低）・期限日・繰り返し設定
- タグ（複数付与可・カラー設定）
- 検索・フィルター（キーワード・完了状態・優先度・タグ・期限切れ）
- **カンバンボード**（ドラッグ&ドロップでステータス変更）
- **カレンダービュー**（期限日・日本の祝日表示）
- 統計ページ
- サブタスク・コメント・添付ファイル
- アーカイブ・一括操作
- デスクトップ通知（期限アラート）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| データベース | PostgreSQL 16 |
| 認証 | JWT (python-jose + passlib/bcrypt) |
| フロントエンド | React 18, Vite |
| インフラ | Docker, Docker Compose |

## 必要環境

- Docker
- Docker Compose

## セットアップ・起動

### 初回起動

```bash
git clone https://github.com/hiroki922/Do-Next.git
cd Do-Next
docker compose up --build
```

### 2回目以降

```bash
docker compose up
```

### DBをリセットして起動（スキーマ変更時など）

```bash
docker compose down -v
docker compose up --build
```

## アクセス先

| サービス | URL |
|---------|-----|
| フロントエンド | http://localhost:3000 |
| API (Swagger UI) | http://localhost:8000/docs |
| API (ReDoc) | http://localhost:8000/redoc |
| ヘルスチェック | http://localhost:8000/health |

## 使い方

1. `http://localhost:3000` にアクセス
2. 「新規登録」でアカウントを作成してログイン
3. 「タグ管理」から任意のタグを作成
4. フィルターバーの「＋ 新規タスク」からタスクを作成
5. 「ボード」タブでカンバンビューに切り替え、ドラッグ&ドロップでステータス変更
6. 「カレンダー」タブで期限日・祝日を確認

## API エンドポイント

### 認証

| Method | Path | 説明 |
|--------|------|------|
| POST | /auth/register | ユーザー登録 |
| POST | /auth/login | ログイン（JWT取得） |

### タグ（要認証）

| Method | Path | 説明 |
|--------|------|------|
| GET | /tags/ | タグ一覧 |
| POST | /tags/ | タグ作成 |
| DELETE | /tags/{id} | タグ削除 |

### Todo（要認証）

| Method | Path | 説明 |
|--------|------|------|
| GET | /todos/ | 一覧取得（フィルター対応） |
| POST | /todos/ | 作成 |
| GET | /todos/{id} | 詳細取得 |
| PATCH | /todos/{id} | 更新 |
| DELETE | /todos/{id} | 削除 |

### GET /todos/ クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| q | string | タイトル・説明のキーワード検索 |
| completed | boolean | 完了状態でフィルター |
| priority | string | 優先度でフィルター（low/medium/high） |
| status | string | ステータスでフィルター（todo/in_progress/done） |
| tag_id | integer | タグIDでフィルター |
| overdue | boolean | 期限切れのみ表示 |
| archived | boolean | アーカイブ済みを含む |

## 環境変数

`docker-compose.yml` で設定済み。変更する場合はプロジェクトルートに `.env` を作成してください。

| 変数名 | デフォルト値 | 説明 |
|-------|------------|------|
| DATABASE_URL | postgresql://postgres:password@db:5432/appdb | DB接続URL |

## ディレクトリ構成

```
Do-Next/
├── app/                  # FastAPI バックエンド
│   ├── api/
│   │   ├── routes/       # エンドポイント (auth, tags, todos, ...)
│   │   └── schemas.py    # Pydantic スキーマ
│   ├── core/
│   │   ├── security.py   # JWT・パスワードハッシュ
│   │   └── deps.py       # 認証 Dependency
│   ├── db/
│   │   ├── models.py     # SQLAlchemy モデル
│   │   └── database.py   # DB接続
│   ├── config.py
│   └── main.py
├── frontend/             # React フロントエンド
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── api.js        # API クライアント
│       ├── auth.js       # JWT ヘルパー
│       └── components/   # UI コンポーネント
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```
