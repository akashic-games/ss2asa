# CHANGELOG

## 2.9.0

* ポーターを指定する -t, --porter オプションを追加
  * aop を指定するとファイル容量が削減される
* 未知のアトリビュートを無視する --ignore-unknown-attribute オプションを追加
* ポーターを検証する --debug-verify-porter オプションを追加
  * デバッグ機能。通常これを利用することはない

## 2.8.0

* SpriteStudioで利用される補間方法の一部をサポート
  * 加速による補間方法をサポート
  * 減速による補間方法をサポート

## 2.7.2

* Y移動、Z回転、セル回転位置Y座標について間違ったベジェ、エルミート補間のパラメータを出力していた不具合を修正

## 2.7.1
* API実行のサポート

## 2.7.0
* -b, --bundle-all オプションを追加

## 2.6.0
* ssee ファイルのサポート。

## 2.5.2
* SpriteStudio6対応
  * セットアップデータのassanファイルを出力しないように変更
  * X/Yローカルスケールサポート
  * ローカル不透明度サポート
  * イメージ左右反転サポート
  * イメージ上下反転サポート
* NULLパーツの不透明度も出力されるように改修
* 内部モジュールの更新
* NodeJS型定義ファイルの更新

## 2.5.1
* 初期リリース
