import { montantEnClair } from './montant';

describe('montantEnClair', () => {
  it('CAD avec son symbole, MRU par son code et sans décimales inutiles', () => {
    expect(montantEnClair(1, 'CAD')).toBe('1,00 $');
    expect(montantEnClair(40, 'MRU')).toBe('40 MRU');
    expect(montantEnClair(40.5, 'mru')).toBe('40,50 MRU');
  });

  it('devise inconnue : le nombre et le code, sans exception', () => {
    expect(montantEnClair(3, 'XX')).toBe('3 XX');
  });
});
