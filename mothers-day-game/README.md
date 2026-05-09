# 母の日・もじさがしミッション

子どもがお母さんにプレゼントする宝探しゲーム。
7つの場所に紙の文字カードを隠し、写真ヒントから場所を当てて、
集まった文字でプレゼントの隠し場所がわかる仕組み。

## デプロイ手順（はじめての方向け）

### ステップ 1: GitHub アカウントを用意
[github.com](https://github.com) でアカウント作成（無料）。

### ステップ 2: リポジトリを作成
1. 右上の `+` → `New repository`
2. Repository name: `mothers-day-game`（任意の名前でOK）
3. Public を選択（無料の Pages 利用には Public が必要）
4. `Create repository`

### ステップ 3: ファイルをアップロード
1. 作ったリポジトリの画面で `uploading an existing file` をクリック
2. このフォルダの中身をすべてドラッグ＆ドロップ
   - `src/`、`public/`、`.github/` などのフォルダもまるごと
3. 一番下の `Commit changes` ボタン

### ステップ 4: GitHub Pages を有効化
1. リポジトリの `Settings` タブ
2. 左サイドバーの `Pages`
3. `Source` を **GitHub Actions** に変更
4. これで完了

### ステップ 5: 公開を待つ
1. `Actions` タブで進行状況が見られる（緑のチェックが出るまで2-3分）
2. 完了すると `Settings > Pages` の上部に URL が表示
   - 例: `https://yourname.github.io/mothers-day-game/`

スマホからその URL を開けば遊べます。

---

## 写真をデフォルトに含める方法

ゲーム内の「設定」画面で「JSONダウンロード」を押すと `config.json` がダウンロードされます。
このファイルを `public/` フォルダに置いてからリポジトリにアップロードすると、
全員が同じ初期画像で遊べるようになります。

```
mothers-day-game/
├── public/
│   └── config.json   ← ここに置く
├── src/
└── ...
```

---

## ローカル開発（オプション）

Node.js 20+ が必要です。

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド (dist/ に出力)
npm run preview  # ビルド結果のプレビュー
```

---

## 技術スタック
- React 18 + Vite
- Tailwind CSS
- Tone.js (BGM/SFX)
- lucide-react (アイコン)
- データ保存: localStorage（初回は `config.json` を fetch）
