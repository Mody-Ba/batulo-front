import { HttpErrorResponse } from '@angular/common/http';
import {
  codeErreur,
  detailsErreur,
  MESSAGE_INJOIGNABLE,
  MESSAGE_SERVEUR,
  MESSAGE_VALIDATION,
  messageErreur,
} from './erreur-http';

function erreur(status: number, corps: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: corps });
}

describe('erreur-http', () => {
  it('affiche le message du backend', () => {
    const e = erreur(409, { code: 'COURRIEL_DEJA_UTILISE', message: 'Ce courriel est déjà utilisé.' });
    expect(codeErreur(e)).toBe('COURRIEL_DEJA_UTILISE');
    expect(messageErreur(e)).toBe('Ce courriel est déjà utilisé.');
    expect(detailsErreur(e)).toEqual([]);
  });

  it('détaille une erreur de validation par champ', () => {
    const e = erreur(400, {
      code: 'VALIDATION',
      message: 'courriel : le courriel n’est pas valide ; motDePasse : trop court',
    });
    expect(messageErreur(e)).toBe(MESSAGE_VALIDATION);
    expect(detailsErreur(e)).toEqual([
      'Courriel : le courriel n’est pas valide',
      'Mot de passe : trop court',
    ]);
  });

  it('serveur injoignable', () => {
    expect(messageErreur(erreur(0, null))).toBe(MESSAGE_INJOIGNABLE);
  });

  it('erreur 5xx sans corps', () => {
    expect(messageErreur(erreur(502, '<html>Bad gateway</html>'))).toBe(MESSAGE_SERVEUR);
  });

  it('message par défaut sinon', () => {
    expect(messageErreur(new Error('x'), 'Par défaut')).toBe('Par défaut');
  });
});
