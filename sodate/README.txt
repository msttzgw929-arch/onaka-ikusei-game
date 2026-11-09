ふくばら♡ゴッドハンド 〜7つの福腹物語〜
=====================================
■ 遊び方
  - belly-game-standalone.html を開くだけで遊べます（画像・音声・歌をすべて内蔵、スマホ可）。
  - フォルダ版 index.html は HTTP サーバー経由で開いてください（例: python3 -m http.server）。
    file:// で直接開くとブラウザの制限で WebGL 変形が使えず、簡易 2D 表示になります。
■ 操作
  もむ   : お腹の上でドラッグ（円を描くとボーナス）
  ぽんぽん: お腹をタップ
  つまむ : 長押し / 右クリック / 「つまむ」モード → 引っぱって離すと「ビヨーン！」
■ 本物の画像への差し替え
  python3 tools/prepare_assets.py  … 添付画像が box にあれば assets/ に取り込み、手画像の白背景を透過して左右に分割
  js/calib.js                       … 画像ごとのお腹位置（?calib=1 で楕円表示・クリック座標をコンソール出力）
  bash tools/build.sh               … 取り込み → standalone HTML 生成 → zip
■ 音声
  VOICEVOX Engine 0.25.2（ローカル CPU）で事前生成: tools/gen_voices.py, tools/gen_songs.py
  クレジット: VOICEVOX:猫使アル / VOICEVOX:九州そら / VOICEVOX:満別花丸 / VOICEVOX:四国めたん /
             VOICEVOX:猫使ビィ / VOICEVOX:もち子(cv 明日葉よもぎ) / VOICEVOX:春日部つむぎ / VOICEVOX:No.7
  各キャラクターの利用規約に従ってご利用ください（クレジット表記必須）。
