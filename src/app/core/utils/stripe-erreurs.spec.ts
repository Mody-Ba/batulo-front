import type { StripeError } from '@stripe/stripe-js';
import {
  MESSAGE_PAIEMENT_INATTENDU,
  MESSAGE_STRIPE_INDISPONIBLE,
  messageErreurStripe,
} from './stripe-erreurs';

function erreur(partiel: Partial<StripeError>): StripeError {
  return { type: 'card_error', ...partiel } as StripeError;
}

describe('messageErreurStripe', () => {
  it('carte refusée : raison donnée par la banque', () => {
    expect(messageErreurStripe(erreur({ code: 'card_declined', decline_code: 'insufficient_funds' }))).toBe(
      'Votre carte a été refusée : fonds insuffisants.',
    );
    expect(messageErreurStripe(erreur({ code: 'card_declined', decline_code: 'stolen_card' }))).toContain(
      'volée',
    );
  });

  it('carte refusée sans raison connue : message générique', () => {
    expect(messageErreurStripe(erreur({ code: 'card_declined', decline_code: 'raison_inconnue' }))).toContain(
      'Votre carte a été refusée',
    );
    expect(messageErreurStripe(erreur({ code: 'card_declined' }))).toContain('Votre carte a été refusée');
  });

  it('codes courants traduits', () => {
    expect(messageErreurStripe(erreur({ code: 'expired_card' }))).toBe('Votre carte est expirée.');
    expect(messageErreurStripe(erreur({ code: 'incorrect_cvc' }))).toContain('code de sécurité');
    expect(messageErreurStripe(erreur({ code: 'payment_intent_authentication_failure' }))).toContain(
      '3-D Secure',
    );
  });

  it('Stripe injoignable', () => {
    expect(messageErreurStripe(erreur({ type: 'api_connection_error' }))).toBe(MESSAGE_STRIPE_INDISPONIBLE);
  });

  it('erreur de saisie : message de Stripe (déjà en français)', () => {
    expect(
      messageErreurStripe(erreur({ type: 'validation_error', message: 'Votre numéro de carte est incomplet.' })),
    ).toBe('Votre numéro de carte est incomplet.');
  });

  it('jamais le message anglais d’une erreur inconnue', () => {
    expect(messageErreurStripe(erreur({ type: 'api_error', message: 'Something went wrong' }))).toBe(
      MESSAGE_PAIEMENT_INATTENDU,
    );
    expect(messageErreurStripe(null)).toBe(MESSAGE_PAIEMENT_INATTENDU);
  });
});
