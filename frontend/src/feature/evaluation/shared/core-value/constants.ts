/**
 * Core value rating descriptions for the legend.
 * Single source of truth — used by all core value display components.
 */
export const CORE_VALUE_RATING_DESCRIPTIONS: ReadonlyArray<{
  code: string;
  description: string;
}> = [
  { code: 'SS', description: '全スタッフの上位３%以内に位置する。全社へ影響を与える卓越したレベル。' },
  { code: 'S', description: '上位10%以内の望ましい行動レベルで、拠点を超えた影響を及ぼしている。' },
  { code: 'A+', description: '上位20%以内の良好な行動レベルで、部門を超えた影響を持っている。' },
  { code: 'A', description: '上位30%以内であり、部門内でのポジティブな影響が見られる。' },
  { code: 'A-', description: '30％〜70%のレンジに位置し、個人レベルでの成果は認められる。自身からの積極的な影響に期待。' },
  { code: 'B', description: '下位30%のレベルで、他人からの影響を受けている状態。' },
  { code: 'C', description: '下位10%以下に位置し、他人へのマイナスの影響を与えることがあるなど、早急な改善が必要。' },
];
