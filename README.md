# SPARTAN READER

英語を意味のかたまり（チャンク）ごとに表示し、戻り読みを減らすための英語リーディング練習アプリです。

## 主な機能

- 英文テキストをローカルでチャンク分割
- JSON形式のチャンクデータ読み込み
- WPM（表示速度）調整
- 日本語訳の表示・遅延表示（JSONに `jp` がある場合）
- 表示単位（チャンク / 1〜5語）の切り替え
- 学習履歴・お気に入りをブラウザの LocalStorage に保存
- キーボード操作（Space / ← / → / Esc）

## 入力できるJSON形式

```json
[
  {
    "en": "English meaning chunk",
    "jp": "日本語訳",
    "speaker": null
  }
]
```

`en` は必須です。`jp` と `speaker` は省略可能です。

## 開発

```bash
npm install
npm run dev
```

### チェック

```bash
npm run typecheck
npm run build
```

## プライバシー

通常の英文分割はブラウザ内で処理されます。現在のアプリ本体は外部AI APIへ英文を送信しません。

学習履歴はブラウザの LocalStorage に保存されます。
