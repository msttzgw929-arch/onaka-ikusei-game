// ===== Game data =====
'use strict';
const LY = 9.4607e15;
const FOODS = [
  ['onigiri', 'おにぎり', '🍙'], ['cake', 'ショートケーキ', '🍰'], ['burger', 'ハンバーガー', '🍔'], ['pizza', 'ピザまるごと', '🍕'],
  ['ramen', '特盛ラーメン', '🍜'], ['parfait', 'ジャンボパフェ', '🍨'], ['meat', 'マンガ肉', '🍖'], ['sushi', '特上寿司桶', '🍣'],
  ['curry', '山盛りカレー', '🍛'], ['wedding', 'ウェディングケーキ', '🎂'], ['pudding', '惑星プリン', '🍮'], ['donut', '銀河ドーナツ', '🍩'],
].map(([id, name, e], i) => ({ id, name, e, i, g: 0.012 * Math.pow(1.2, i), pts: Math.round(2 * Math.pow(1.8, i)), full: 10 + i * 0.5, cost: i ? Math.round(50 * Math.pow(2.3, i)) : 0 }));
const UPGRADES = [
  { id: 'app', name: '食欲アップ', e: '😋', desc: lv => `ひと口の成長 ×${Math.pow(1.1, lv).toFixed(2)} → ×${Math.pow(1.1, lv + 1).toFixed(2)}`, c: 30, k: 1.7 },
  { id: 'sto', name: '胃袋拡張', e: '🫃', desc: lv => `満腹上限 ${100 + 25 * lv}% → ${100 + 25 * (lv + 1)}%`, c: 50, k: 1.8 },
  { id: 'mas', name: 'マッサージ上達', e: '👐', desc: lv => `マッサージ効果 ×${Math.pow(1.18, lv).toFixed(2)} → ×${Math.pow(1.18, lv + 1).toFixed(2)}`, c: 40, k: 1.75 },
  { id: 'chef', name: '専属シェフ', e: '🧑‍🍳', desc: lv => lv ? `自動ごはん ${(5 / (1 + 0.3 * (lv - 1))).toFixed(1)}秒 → ${(5 / (1 + 0.3 * lv)).toFixed(1)}秒ごと` : '自動でごはんを運んでくれる', c: 300, k: 2.3 },
  { id: 'est', name: '全自動エステ', e: '💆', desc: lv => `自動消化 ${1 + 4 * lv}%/秒 → ${1 + 4 * (lv + 1)}%/秒`, c: 500, k: 2.3 },
];
const ucost = (u, lv) => Math.round(u.c * Math.pow(u.k, lv));
// stages: threshold belly diameter (m)
const STAGES = [
  { s: 0, name: 'ふつうのお腹', v: null },
  { s: 0.6, name: 'テーブルサイズ', v: 'stage1' },
  { s: 8, name: '一軒家サイズ', v: 'stage2' },
  { s: 40, name: 'ビルサイズ', v: 'stage3' },
  { s: 340, name: '超高層ビルサイズ', v: 'stage4' },
  { s: 3800, name: '富士山サイズ', v: 'stage5' },
  { s: 4e4, name: '都市サイズ', v: 'stage6' },
  { s: 3e6, name: '国サイズ', v: 'stage7' },
  { s: 1.28e7, name: '地球サイズ', v: 'stage8' },
  { s: 1.4e9, name: '太陽サイズ', v: 'stage9' },
  { s: 9e12, name: '太陽系サイズ', v: 'st_solar' },
  { s: 2.5e17, name: '星雲サイズ', v: 'st_nebula' },
  { s: 1e21, name: '銀河サイズ', v: 'stage10' },
  { s: 1.5e23, name: '銀河団サイズ', v: 'st_cluster' },
  { s: 8.8e26, name: '宇宙サイズ', v: 'stage11' },
  { s: 1e28, name: '宇宙の果ての先へ', v: 'stage12' },
];
function stageOf(S) { let i = 0; while (i < STAGES.length - 1 && S >= STAGES[i + 1].s) i++; if (i === STAGES.length - 1) { const extra = Math.floor(Math.log10(S / STAGES[i].s)); return { i, extra, name: extra > 0 ? `超宇宙 Lv.${extra}` : STAGES[i].name }; } return { i, extra: 0, name: STAGES[i].name }; }
const REFS = [['お皿', 0.25, '枚'], ['テーブル', 1.2, '台'], ['自動車', 4.5, '台'], ['一軒家', 10, '軒'], ['学校の校舎', 50, '棟'], ['東京タワー', 333, '本'], ['スカイツリー', 634, '本'], ['富士山', 3776, '個'], ['東京23区', 2.5e4, '個'], ['日本列島', 3e6, '個'], ['月', 3.474e6, '個'], ['地球', 1.2742e7, '個'], ['木星', 1.3982e8, '個'], ['太陽', 1.392e9, '個'], ['太陽系', 9e12, '個'], ['オリオン大星雲', 24 * LY, '個'], ['天の川銀河', 1e5 * LY, '個'], ['おとめ座銀河団', 1.5e7 * LY, '個'], ['観測可能な宇宙', 9.3e10 * LY, '個']];
function jpNum(x, digits = 1) { // Japanese big-number units
  const U = [[1e20, '垓'], [1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '万']];
  if (x >= 1e24) { const e = Math.floor(Math.log10(x)); return `${(x / Math.pow(10, e)).toFixed(2)}×10^${e}`; }
  for (const [v, u] of U) if (x >= v) { const y = x / v; return (y >= 1000 ? Math.round(y).toLocaleString() : y.toFixed(y >= 100 ? 0 : digits)) + u; }
  return x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(digits);
}
function fmtSize(S) {
  if (S < 1) return { v: (S * 100).toFixed(1), u: 'cm' };
  if (S < 1000) return { v: S.toFixed(S < 10 ? 2 : 1), u: 'm' };
  if (S < 0.1 * LY) return { v: jpNum(S / 1000, 1), u: 'km' };
  return { v: jpNum(S / LY, 2), u: '光年' };
}
function fmtPts(p) { return p < 1e4 ? Math.floor(p).toLocaleString() : jpNum(p, 2); }
function compare(S) { let r = REFS[0]; for (const x of REFS) if (S >= x[1]) r = x; const n = S / r[1]; return `≒ ${r[0]} ${n < 10 ? n.toFixed(1) : jpNum(n, 0)}${r[2]}分`; }
