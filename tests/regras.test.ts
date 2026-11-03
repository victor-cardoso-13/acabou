import { describe, expect, it } from 'vitest';
import { REGRAS } from '../src/motor/regras.ts';

// Exemplo: cada regra da casa vira um teste com os exemplos que a família confirmou.
describe('regras', () => {
  it('existem', () => {
    expect(REGRAS).toBeDefined();
  });
});
