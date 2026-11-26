import { FormControl } from '@angular/forms';
import { formulesAbonnement, offreAchat } from '../models/abonnement.model';
import { creditsDeTest, formulesDeTest, FORMULES_DE_TEST } from '../../testing/donnees-test';
import {
  abonnementIllimite,
  bornesAchat,
  quantiteValide,
  REGLES_ACHAT,
  soldeAAfficher,
  totalAchat,
  validateurQuantite,
} from './achat-sondages';

describe('Achat de sondages : calculs et règles', () => {
  it('total = quantité × prix d’un sondage, au centime près (CAD), sans erreur d’arrondi', () => {
    expect(totalAchat(4.99, 1, 'CAD')).toBe(4.99);
    expect(totalAchat(4.99, 3, 'CAD')).toBe(14.97);
    // 0,1 × 3 vaut 0,30000000000000004 en virgule flottante : calcul en centimes.
    expect(totalAchat(0.1, 3, 'CAD')).toBe(0.3);
    expect(totalAchat(4.99, 1000, 'CAD')).toBe(4990);
  });

  it('total en MRU : des entiers', () => {
    expect(totalAchat(200, 7, 'MRU')).toBe(1400);
    expect(totalAchat(200, 1000, 'mru')).toBe(200000);
  });

  it('bornes 1 et 1000 comprises ; 0, 1001, décimaux, vide : pas de total', () => {
    expect(totalAchat(4.99, 1, 'CAD')).not.toBeNull();
    expect(totalAchat(4.99, 1000, 'CAD')).not.toBeNull();
    for (const q of [0, 1001, -1, 2.5, null, undefined, NaN, '5']) {
      expect(totalAchat(4.99, q, 'CAD')).toBeNull();
    }
    expect(totalAchat(null, 5, 'CAD')).toBeNull();
  });

  it('bornes lues dans /formules (quantiteMin, quantiteMax), sinon celles du backend', () => {
    expect(bornesAchat(null)).toEqual({ min: REGLES_ACHAT.quantiteMin, max: REGLES_ACHAT.quantiteMax });
    expect(bornesAchat({ quantiteMin: 5, quantiteMax: 50 })).toEqual({ min: 5, max: 50 });
    expect(quantiteValide(4, { min: 5, max: 50 })).toBe(false);
    expect(quantiteValide(50, { min: 5, max: 50 })).toBe(true);
  });

  it('validateur du champ : requis, entier, minimum, maximum', () => {
    const controle = new FormControl<number | null>(null, { validators: [validateurQuantite(() => bornesAchat(null))] });
    expect(controle.hasError('quantiteRequise')).toBe(true);
    controle.setValue(0);
    expect(controle.errors).toEqual({ quantiteMin: { min: 1 } });
    controle.setValue(1001);
    expect(controle.errors).toEqual({ quantiteMax: { max: 1000 } });
    controle.setValue(2.5);
    expect(controle.hasError('quantiteEntiere')).toBe(true);
    controle.setValue(1);
    expect(controle.valid).toBe(true);
    controle.setValue(1000);
    expect(controle.valid).toBe(true);
  });

  it('/formules : abonnements et offre d’achat séparés (formule null exclue des abonnements)', () => {
    const formules = formulesDeTest();
    expect(formulesAbonnement(formules).map((f) => f.formule)).toEqual(['MENSUEL', 'ANNUEL']);
    expect(offreAchat(formules)?.prix).toBe(4.99);
    // Backend plus ancien (sans type) : tout est abonnement, pas d'offre d'achat.
    expect(formulesAbonnement(FORMULES_DE_TEST)).toHaveLength(2);
    expect(offreAchat(FORMULES_DE_TEST)).toBeUndefined();
  });

  it('solde affiché seulement sans abonnement en cours et avec un compte de crédits', () => {
    const credits = creditsDeTest({ solde: 3 });
    expect(abonnementIllimite('ACTIF')).toBe(true);
    expect(abonnementIllimite('EXPIRE_BIENTOT')).toBe(true);
    expect(soldeAAfficher('ACTIF', credits)).toBeNull();
    expect(soldeAAfficher('EXPIRE_BIENTOT', credits)).toBeNull();
    expect(soldeAAfficher('EXPIRE', credits)).toBe(3);
    expect(soldeAAfficher('EN_ATTENTE_PAIEMENT', creditsDeTest({ solde: 0 }))).toBe(0);
    expect(soldeAAfficher('EXPIRE', creditsDeTest({ compteCredits: false, solde: 0 }))).toBeNull();
    expect(soldeAAfficher('EXPIRE', null)).toBeNull();
  });
});
