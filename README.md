# Coffee Compare（仮称）

**一杯ずつ比べて、自分の正解を見つける。**

ハンドドリップの抽出条件と味を「基準の一杯」と比較し、自分好みの一杯を再現・更新していくためのスマートフォン向けWebアプリです。記録アプリではなく比較アプリ — ホームは記録一覧ではなく「この一杯と比べて淹れる」から始まります。

## 特徴

- **基準 vs 今回の2杯比較**：同じ項目を同じ行に並べ、変更行だけを差分テキスト付きでハイライト
- **意図と観測の区別**：意図して変えた条件（●）と、結果的に変わった条件（○）を分けて表示
- **不明値の誠実な扱い**：未計測は「—」。不明→入力は「新規入力」とし、差分を捏造しない
- **相対評価**：「基準が好き／今回が好き／違いが分からない」。点数・順位付けはしない
- **明示的な基準更新**：「今回が好き」でも自動では基準を変えない。過去の比較は不変
- **端末内保存**：ログイン不要。IndexedDBに保存し、JSONバックアップ／復元に対応

## ドキュメント

- [要件定義書](docs/REQUIREMENTS.md)
- [デザインガイドライン](docs/DESIGN_GUIDELINES.md)（[SmartHR Design System](https://smarthr.design/)・[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios) 参照）

## 技術構成

React + TypeScript (strict) + Vite。バックエンドなし（クライアント完結）。

```
src/
  domain/          型・差分判定・バリデーション（React非依存、単体テストあり）
  application/     ユースケースと状態管理
  infrastructure/  IndexedDB・JSONバックアップ
  ui/              画面・共通コンポーネント・デザイントークン
```

## 開発

```bash
npm install
npm run dev      # 開発サーバー（http://localhost:5173）
npm test         # 単体テスト（Vitest）
npm run build    # 型チェック＋本番ビルド（dist/）
```

## デプロイ（Vercel）

1. GitHubにリポジトリを作成してpush
2. [Vercel](https://vercel.com/new)でリポジトリをImport（フレームワークはViteとして自動検出。Build: `npm run build`、Output: `dist`）
3. Deployを押すと公開URLが発行されます

## ライセンス・プライバシー

味の記録は端末の外へ送信されません。比較の結果は本人の感想であり、科学的な優劣を示すものではありません。
