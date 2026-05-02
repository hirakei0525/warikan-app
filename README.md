# warikan-app

割り勘・精算アプリ。Vercel + Vercel KV (Upstash Redis) で動きます。

## 構成

- フロント: Vite + React (`src/App.jsx`)
- バックエンド: Vercel Serverless Functions (`api/bins/[code].js`, `api/reports/[code].js`)
- ストレージ: Vercel KV (Upstash Redis) — `code` をキーにしたシンプルな KV

## デプロイ手順

1. このリポジトリを Vercel に接続（既存のプロジェクトでOK）
2. Vercel ダッシュボードで Storage を作成
   - 対象プロジェクトを開く
   - 「Storage」タブ → 「Create Database」 → 「Upstash for Redis」（または KV）を選択
   - 任意の名前で作成し、対象プロジェクトに **Connect**
   - これで `KV_REST_API_URL` `KV_REST_API_TOKEN` などの環境変数が自動で注入される
3. 再デプロイ（Storage 接続後の最初のデプロイ）

## ローカル開発

API Routes は Vercel Functions なので、ローカルで動かす場合は Vercel CLI を使います。

```bash
npm install
npm install -g vercel    # 初回のみ
vercel link              # 既存プロジェクトに紐付け
vercel env pull          # 本番の環境変数をローカルに取得
vercel dev               # http://localhost:3000 で動作確認
```

API なしで UI だけ確認したい場合は `npm run dev` でも起動できますが、保存・読込は動作しません。

## API

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/bins/:code` | セッションデータ取得（404 = 未存在） |
| PUT | `/api/bins/:code` | セッションデータ保存（90日 TTL） |
| GET | `/api/reports/:code` | 共有レポート取得 |
| PUT | `/api/reports/:code` | 共有レポート保存（365日 TTL） |

`code` は `[A-Z0-9_]{4,64}` のみ受け付けます。
