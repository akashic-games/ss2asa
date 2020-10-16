# ss2asa
SpriteStudio形式のファイルををakashic-animation形式にコンバートするコマンドラインツール。

# インストール

`ss2asa` は `Node.js` で動作します。以下のコマンドでインストールできます。
```sh
$ npm install -g @akashic-extension/ss2asa
```

npx が利用できる環境では `ss2asa` を直接呼び出すこともできます。

```sh
$ npx -p @akashic-extension/ss2asa ss2asa project-file.sspj
```

Akashic Engineの詳細な利用方法については、 [公式ページ](https://akashic-games.github.io/) を参照してください。

# 使い方
SpriteStudioのプロジェクトファイルを渡してください。関連ファイル(ssae,ssce)を含めすべてコンバートします。

```sh
$ ss2asa project-file.sspj
```

出力されるファイルは次のように対応します。

| SpriteStudio  | akashic       | 備考                                   |
|:------------- |:------------- | :------------------------------------- |
| sspj          | asapj         | プロジェクトファイル                   |
| ssae          | asabn, asaan  | ボーンファイルとアニメーションファイル |
| ssce          | asask         | スキンファイル                         |

## オプション
### -h, --help
ヘルプを表示します。

## -V, --version
バージョンを表示します。

### -o, --out-dir
出力先ディレクトリを指定します。存在しない時、ディレクトリを作成します。

### -p, --add-prefix
出力ファイルのファイル名に次の接頭辞を加えます。

| ファイル形式  | 接頭辞        |
|:------------- |:------------- |
| asapj         | pj_           |
| asabn         | bn_           |
| asaan         | an_           |
| asask         | sk_           |


### -l, --long-name
asaanファイル名(アニメーション名が用いられる)の前にssaeファイル名が加わります。２つの間は`_`で区切られます。

例: `ss2asa -l jobs.sspj`
```
input:
jobs.sspj
├── fighter.ssae
│   ├── attack
│   └── walk
└── healer.ssae
    ├── attack
    └── walk

output:
fighter_attack.asaan
fighter_walk.asaan
healer_attack.asaan
healer_walk.asaan
```

これは同一プロジェクト内の異なるssae間でアニメーション名の重複があった時、出力されるファイルが上書きされることを避けるための機能です。

この時各アニメーションデータの持つnameプロパティはロングネーム化されたファイル名と同じものになります。開発者はロングネームでアニメーションを指定してください。

### -b, --bundle-all
すべてのアセットデータをまとめてasapjファイルに出力します。

例(contentsプロパティ内の関係のないものは省略):
```json
{
    "version": "3.0.0",
    "type": "bundle",
    "contents": [
        {
            "type": "project",
            "name": "stickman",
            "data": {
                "userData": {}
            }
        },
        {
            "type": "bone",
            "name": "stickman",
            "data": {}
        },
        {
            "type": "skin",
            "name": "stickman",
            "data": {}
        },
        {
            "type": "animation",
            "name": "anime_1",
            "data": {}
        }
    ]
}
```

### -d, --delete-hidden
SpriteStudio上で目玉アイコンを用いて非表示にしたパーツとそのアニメーションを削除します。

### -P --set-prefix
`-p` オプションで出力ファイル名に加わる接頭辞を指定します。asapj,asabn,asask,asaan形式それぞれについて、この並びでカンマ区切りで指定します。デフォルトは`pj_,bn_,sk_,an_`です。

### -v, --verbose
実行時の出力に詳細情報を含めます。

### -u, --user-data
ユーザデータを出力します。

### -L, --label-as-user-data
ラベルをユーザデータ形式で出力します。`-u`オプションが有効である必要があります。ユーザデータキーフレームはルートボーンのアニメーションとして追加されます。プロパティ名は`label`です。

### -c, --combination-info
ボーン、スキン、アニメーションの有効な組み合わせの情報をasapjファイルのユーザデータとして出力します。`contents.userData.combinationInfo`プロパティからアクセスできます。

例(contentsプロパティ内の関係のないものは省略):
```json
{
    "version": "2.0.0",
    "contents": {
        "userData": {
            "combinationInfo": [
                {
                    "boneName": "stickman",
                    "animationNames": [
                        "anime_1",
                        "anime_1_bezier",
                        "anime_1_liner"
                    ],
                    "skinNames": [
                        "stickman"
                    ]
                }
            ]
        }
    }
}
```

### -r, --related-file-info
asapjファイルと関連するファイルの一覧をasapjファイルのユーザデータとして出力します。`contents.userData.relatedFileInfo`プロパティからアクセスできます。

例(contentsプロパティ内の関係のないものは省略):
```json
{
    "version": "2.0.0",
    "contents": {
        "userData": {
            "relatedFileInfo": {
                "boneSetFileNames": [
                    "stickgirl.asabn",
                    "stickman.asabn"
                ],
                "skinFileNames": [
                    "stickgirl.asask",
                    "stickman.asask"
                ],
                "animationFileNames": [
                    "stickgirl_anime_1.asaan",
                    "stickman_anime_1.asaan",
                    "stickman_anime_1_bezier.asaan",
                    "stickman_anime_1_liner.asaan"
                ],
                "imageFileNames": [
                    "stickgirl.png",
                    "stickman.png"
                ]
            }
        }
    }
}
```

### -s, --layout-size
アニメーションのレイアウト情報を出力します。`contents.userData.layoutSizes`プロパティからアクセスできます。

# 使い方 (Node.js API)
Node.js のモジュールとして呼び出すこともできます。

```javascript
var ss2asa = require("@akashic-extension/ss2asa");

ss2asa.convert({
    projFileName: "stickman.sspj",
    outDir: "./out",
    addPrefix: true
});
```

※ TypeScript で利用する場合、 `@akashic/akashic-engine` の型定義ファイルを `tsconfig.json` で指定する必要があります。

```diff
{
  "compilerOptions": {
    ...
  },
+  "files": [
+    "node_modules/@akashic/akashic-engine/lib/main.d.ts"
+  ]
  ...
}
```

## オプション
* `projFileName: string` (required)
  * SpriteStudioのプロジェクトファイル
* `outDir: string` (required)
  * 出力先ディレクトリ
* `addPrefix?: boolean` (default: `false`)
  * 出力ファイル名に接頭辞を追加するかどうか
* `verbose?: boolean` (default: `false`)
  * 実行時に詳細情報を出力するかどうか
* `bundleAll?: boolean` (default: `false`)
  * すべてのアセットデータをまとめてasapjファイルに出力するかどうか
* `prefixes?: string[]` (default: `[]`)
  * 出力ファイル名に追加する接頭辞の文字列配列 ([.asapj, .asabn, .asaan, .asask] の順)
* `asaanLongName?: boolean` (default: `false`)
  * asaanファイル名(アニメーション名が用いられる)の前にssaeファイル名を加えるかどうか
* `deleteHidden?: boolean` (default: `false`)
  * SpriteStudio上で目玉アイコンを用いて非表示にしたパーツとそのアニメーションを削除するかどうか
* `labelAsUserData?: boolean` (default: `false`)
  * ラベルをユーザデータ形式で出力するかどうか (`outputUserData` が `true` の場合)
* `outputUserData?: boolean` (default: `false`)
  * ユーザデータを出力するかどうか
* `outputComboInfo?: boolean` (default: `false`)
  * ボーン、スキン、アニメーションの有効な組み合わせの情報をasapjファイルのユーザデータとして出力するかどうか
* `outputRelatedFileInfo?: boolean` (default: `false`)
  * asapjファイルと関連するファイルの一覧をasapjファイルのユーザデータとして出力するかどうか
* `outputLayoutSize?: boolean` (default: `false`)
  * アニメーションのレイアウト情報を出力するかどうか

# akashic-animationのサポートするアトリビュート
以下のアトリビュートのアニメーションをサポートします。
* 参照セル
* X座標
* Y座標
* Z軸回転
* Xスケール
* Yスケール
* ローカルXスケール
* ローカルYスケール
* 不透明度
* ローカル不透明度
* 優先度
* 左右反転
* 上下反転
* イメージ左右反転
* イメージ上下反転
* 非表示
* 原点Xオフセット
* 原点Yオフセット
* UV X移動
* UV Y移動
* 当たり半径
* ユーザーデータ

# 補足
## キーフレームの外挿
akashic-animationは再生するアニメーションの0フレーム目がキーフレームでない時、0フレーム目に初期値を与えます。初期値は属性により異なります（次の表参照）。

| 属性                | 値         |
|:------------------- |:---------- |
| X,Y座標             | 0, 0       |
| Z回転               | 0          |
| X,Yスケール         | 1, 1       |
| ローカルX,Yスケール | 1, 1       |
| アルファ            | 1          |
| ローカルアルファ    | 無し       |
| セル                | 無し       |
| セル中心座標        | 0, 0       |
| セルUV              | 0, 0       |
| 優先順位            | 0          |
| イメージ左右反転    | 無し       |
| イメージ上下反転    | 無し       |
| 可視・不可視        | 可視       |
| 円アタリ判定半径    | 0          |
| 水平フリップ        | 無し       |
| 垂直フリップ        | 無し       |
| ユーザデータ        | 無し       |

最終フレームがキーフレームでない時も同様に値を与えます。この値は最後のキーフレームと同じ値になります。

**akashic-animationで再生したアニメーションがSpriteStudioと異なるとき、第0フレーム、最終フレームのいずれかまたは両方をキーフレームにすることで解決することがあります。**


## セルマップ参照イメージのアセット名に関する制限
`ss2asa`はセルマップの参照するイメージのアセット名として、もとのイメージファイル名から拡張子を除いたものをasaskファイルに保存します。たとえば"stickman.png"のアセット名は"stickman"となります。もしgame.jsonで指定されるイメージアセット名がファイル名から拡張子を除いたものでない時、実行時エラーとなります(game.jsonの更新に`akashic-cli`を使用している限りそのような不整合は起こりません)。

## NULLパーツから出力される属性値に関する制限
ss2asaはNULLパーツの持つ属性値の内、以下のもののみを出力します。
* X, Y座標
* Z回転
* X, Yスケール
* 不透明度
* 当たり半径
* ユーザデータ

## SpriteStudioの推奨環境設定
akashic-animationはSpriteStudioの全機能をサポートしていません。サポートされない機能を誤って用いることを防ぐため、初期設定から編集可能な属性を選択することをお勧めします。

### 設定方法
以下の手順はバージョン 5.5.1.5759 で確認しました。

1. 環境設定 -> 一般設定 -> 新規プロジェクトのデフォルト設定 -> 一般 -> 互換性 を開き 再生対象のプラットフォームをカスタムにする
2. 属性のチェックボックスを下の表にしたがって設定する

**注意**: この設定は新規プロジェクトに対して適用されます。既存のプロジェクトについてはこの設定が完了後、改めてプロジェクト設定を編集してください。

| 　 | 属性名            |
|:-- |:----------------- |
| ✔ | 参照セル          |
| ✔ | X座標             |
| ✔ | Y座標             |
| 　 | Z座標             |
| 　 | X軸回転           |
| 　 | Y軸回転           |
| ✔ | Z軸回転           |
| ✔ | Xスケール         |
| ✔ | Yスケール         |
| ✔ | ローカルXスケール |
| ✔ | ローカルYスケール |
| ✔ | 不透明度          |
| ✔ | ローカル不透明度  |
| ✔ | 優先度            |
| ✔ | 左右反転          |
| ✔ | 上下反転          |
| ✔ | 非表示            |
| 　 | カラーブレンド    |
| 　 | 頂点変形          |
| ✔ | 原点Xオフセット   |
| ✔ | 原点Yオフセット   |
| 　 | Xアンカー         |
| 　 | Yアンカー         |
| 　 | Xサイズ           |
| 　 | Yサイズ           |
| ✔ | イメージ左右反転  |
| ✔ | イメージ上下反転  |
| ✔ | UV X移動          |
| ✔ | UV Y移動          |
| 　 | UV 回転           |
| 　 | UV Xスケール      |
| 　 | UV Yスケール      |
| ✔ | 当たり半径        |
| ✔ | ユーザーデータ    |
| 　 | インスタンス      |

## ライセンス
本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

ただし、画像ファイルおよび音声ファイルは
[CC BY 2.1 JP](https://creativecommons.org/licenses/by/2.1/jp/) の元で公開されています。
