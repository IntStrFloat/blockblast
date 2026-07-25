import { atmosphereText, praiseVariants } from '@/core/i18n';

import {
  ATMOSPHERE,
  atmospherePhaseForScore,
  moteLayout,
  motesForPhase,
} from '../animation/atmosphere';

describe('atmospherePhaseForScore', () => {
  it('пороги конфига строго возрастают', () => {
    const thresholds = ATMOSPHERE.phaseThresholds;
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
    }
  });

  it('границы фаз: до порога — прежняя фаза, с порога — следующая', () => {
    const [t1, t2, t3] = ATMOSPHERE.phaseThresholds;
    expect(atmospherePhaseForScore(0)).toBe(0);
    expect(atmospherePhaseForScore(t1 - 1)).toBe(0);
    expect(atmospherePhaseForScore(t1)).toBe(1);
    expect(atmospherePhaseForScore(t2 - 1)).toBe(1);
    expect(atmospherePhaseForScore(t2)).toBe(2);
    expect(atmospherePhaseForScore(t3 - 1)).toBe(2);
    expect(atmospherePhaseForScore(t3)).toBe(3);
    expect(atmospherePhaseForScore(1_000_000)).toBe(3);
  });
});

describe('motesForPhase', () => {
  it('число искр не убывает с фазой и не превышает пул', () => {
    let prev = 0;
    for (let phase = 0; phase <= 3; phase++) {
      const count = motesForPhase(phase);
      expect(count).toBeGreaterThanOrEqual(prev);
      expect(count).toBeLessThanOrEqual(ATMOSPHERE.motePoolSize);
      prev = count;
    }
  });

  it('фаза 0 — без искр, фаза за пределами конфига клампится', () => {
    expect(motesForPhase(0)).toBe(0);
    expect(motesForPhase(99)).toBe(motesForPhase(3));
    expect(motesForPhase(-1)).toBe(0);
  });
});

describe('moteLayout', () => {
  it('раскладка детерминирована и в границах экрана', () => {
    for (let index = 0; index < ATMOSPHERE.motePoolSize; index++) {
      const a = moteLayout(index, 400, 800);
      const b = moteLayout(index, 400, 800);
      expect(a).toEqual(b);
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(400);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(800);
      expect(a.size).toBeGreaterThanOrEqual(ATMOSPHERE.moteSizeMin);
      expect(a.size).toBeLessThanOrEqual(ATMOSPHERE.moteSizeMax);
      expect(a.delayMs).toBeLessThanOrEqual(a.durationMs);
    }
  });
});

describe('atmosphereText', () => {
  it('фазы 1..3 непустые на обоих языках в обоих тонах', () => {
    for (const lang of ['ru', 'en'] as const) {
      for (const tone of ['classic', 'meme'] as const) {
        for (let phase = 1; phase <= ATMOSPHERE.phaseThresholds.length; phase++) {
          expect(atmosphereText(phase, tone, lang).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('фаза 0 и неизвестная фаза → пустая строка', () => {
    expect(atmosphereText(0, 'classic', 'ru')).toBe('');
    expect(atmosphereText(9, 'meme', 'en')).toBe('');
  });

  it('тона различаются', () => {
    expect(atmosphereText(1, 'classic', 'ru')).not.toBe(atmosphereText(1, 'meme', 'ru'));
  });
});

describe('praiseVariants', () => {
  it('каждый тир даёт ≥2 вариантов, наборы тонов не пересекаются', () => {
    for (const lang of ['ru', 'en'] as const) {
      for (const tier of ['good', 'great', 'amazing', 'unbelievable'] as const) {
        const classic = praiseVariants(tier, 'classic', lang);
        const meme = praiseVariants(tier, 'meme', lang);
        expect(classic.length).toBeGreaterThanOrEqual(2);
        expect(meme.length).toBeGreaterThanOrEqual(2);
        for (const text of classic) expect(meme).not.toContain(text);
      }
    }
  });
});
