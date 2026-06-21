import { engineFingerprint } from '../fingerprint';

describe('engineFingerprint', () => {
  it('is deterministic across calls', () => {
    expect(engineFingerprint()).toBe(engineFingerprint());
  });

  // ТРИПВАЙР: это значение меняется при ЛЮБОМ изменении поведения движка
  // (фигуры/RNG/скоринг/game over). Если тест упал — движок изменился, значит
  // НУЖНО пересобрать и передеплоить backend (npm run backend:build + деплой,
  // см. docs/runbooks/leaderboard-operations.md), иначе сервер начнёт молча
  // отклонять ranked-сабмиты. Обновляйте константу осознанно, вместе с деплоем.
  it('matches the pinned engine fingerprint (bump only with a backend redeploy)', () => {
    expect(engineFingerprint()).toBe('2683425b');
  });
});
