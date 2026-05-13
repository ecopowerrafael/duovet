import { describe, it, expect } from 'vitest';
import { createPageUrl } from '../../utils/index';

describe('createPageUrl', () => {
  it('deve criar URLs corretamente', () => {
    expect(createPageUrl('Nova Página')).toBe('/nova-página');
    expect(createPageUrl('Clientes')).toBe('/clientes');
  });
});
