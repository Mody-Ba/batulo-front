import { HttpErrorResponse } from '@angular/common/http';
import { TRADUCTIONS, traducteurStatique } from '../../../test-providers';
import { pourcentage, periode } from '../../features/sondages/statistiques/graphiques/format';
import { messageErreur } from '../utils/erreur-http';
import { montantEnClair } from '../utils/montant';
import { dateEnClair, DateLPipe, NombreLPipe } from './formats.pipes';
import { Langue } from './langues';
import { brancherTraductions, formaterNombre, traduirePluriel } from './traduire';

/** Espaces insécables (fines ou non) ramenées à des espaces simples, marques de direction retirées. */
const net = (texte: string | null) => (texte ?? '').replace(/[  ]/g, ' ').replace(/[‎‏؜]/g, '');

function langue(l: Langue): void {
  brancherTraductions(traducteurStatique(TRADUCTIONS[l]), l);
}

describe('Formats et pluriels selon la langue', () => {
  afterEach(() => langue('fr'));

  it('nombres : « 1 234,5 » en français, « 1,234.5 » en anglais, chiffres occidentaux en arabe', () => {
    langue('fr');
    expect(net(formaterNombre(1234.5))).toBe('1 234,5');
    langue('en');
    expect(formaterNombre(1234.5)).toBe('1,234.5');
    langue('ar');
    expect(net(formaterNombre(1234.5))).toBe('1,234.5');
    expect(formaterNombre(1234.5)).not.toMatch(/[٠-٩]/);
    expect(new NombreLPipe().transform(1234567)).not.toMatch(/[٠-٩]/);
  });

  it('montants : symbole de la devise selon la langue, MRU par son code et sans décimales inutiles', () => {
    langue('fr');
    expect(net(montantEnClair(1, 'CAD'))).toBe('1,00 $');
    expect(net(montantEnClair(40, 'MRU'))).toBe('40 MRU');
    langue('en');
    expect(montantEnClair(1, 'CAD')).toBe('$1.00');
    expect(net(montantEnClair(40, 'MRU'))).toBe('MRU 40');
    langue('ar');
    expect(net(montantEnClair(40, 'MRU'))).toContain('40');
    expect(montantEnClair(1234, 'MRU')).not.toMatch(/[٠-٩]/);
  });

  it('dates : mois dans la langue, chiffres occidentaux en arabe', () => {
    const date = '2026-03-05T14:30:00';
    langue('fr');
    expect(dateEnClair(date, 'long')).toBe('5 mars 2026');
    expect(net(new DateLPipe().transform(date, 'longHeure'))).toBe('5 mars 2026 à 14:30');
    langue('en');
    expect(dateEnClair(date, 'long')).toBe('March 5, 2026');
    langue('ar');
    const arabe = dateEnClair(date, 'long');
    expect(arabe).toContain('مارس');
    expect(arabe).toContain('2026');
    expect(arabe).not.toMatch(/[٠-٩]/);
  });

  it('statistiques : pourcentages et périodes dans la langue courante', () => {
    langue('fr');
    expect(net(pourcentage(51.7))).toBe('51,7 %');
    expect(periode('2026-03')).toContain('mars');
    langue('en');
    expect(pourcentage(51.7)).toBe('51.7%');
    expect(periode('2026-03')).toContain('Mar');
  });

  it('pluriels : one / other en français et en anglais, six formes en arabe', () => {
    langue('fr');
    expect(traduirePluriel('bandeau.joursRestants', 1)).toBe('1 jour restant');
    expect(traduirePluriel('bandeau.joursRestants', 3)).toBe('3 jours restants');
    langue('en');
    expect(traduirePluriel('bandeau.joursRestants', 1)).toBe('1 day left');
    expect(traduirePluriel('bandeau.joursRestants', 2)).toBe('2 days left');
    langue('ar');
    expect(traduirePluriel('bandeau.joursRestants', 0)).toBe('لم يتبقَّ أي يوم');
    expect(traduirePluriel('bandeau.joursRestants', 2)).toBe('يومان متبقيان');
    expect(traduirePluriel('bandeau.joursRestants', 5)).toBe('5 أيام متبقية');
    expect(traduirePluriel('bandeau.joursRestants', 11)).toBe('11 يومًا متبقيًا');
    expect(traduirePluriel('bandeau.joursRestants', 100)).toBe('100 يوم متبقٍ');
  });
});

describe('Messages d’erreur du backend selon la langue', () => {
  afterEach(() => langue('fr'));

  const erreur = (code: string, message: string) =>
    new HttpErrorResponse({ status: 400, error: { code, message } });

  it('français : le message du serveur (déjà en français, plus précis)', () => {
    langue('fr');
    expect(messageErreur(erreur('SONDAGE_NON_OUVERT', 'Ce sondage ouvrira le 3 décembre 2026.'))).toBe(
      'Ce sondage ouvrira le 3 décembre 2026.',
    );
  });

  it('autre langue : traduction du code ; code inconnu : message du serveur en secours', () => {
    langue('en');
    expect(messageErreur(erreur('IDENTIFIANTS_INVALIDES', 'Courriel ou mot de passe incorrect.'))).toBe(
      'Incorrect email or password.',
    );
    expect(messageErreur(erreur('DEJA_REPONDU', 'Vous avez déjà répondu…'))).toBe(
      'You have already answered this survey from this device.',
    );
    expect(messageErreur(erreur('CODE_INCONNU', 'Message du serveur.'))).toBe('Message du serveur.');
    langue('ar');
    expect(messageErreur(erreur('ABONNEMENT_EXPIRE', 'x'))).toContain('للقراءة فقط');
    expect(messageErreur(new HttpErrorResponse({ status: 0 }))).toContain('Batulo');
  });
});
