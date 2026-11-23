import { traduire } from '../i18n/traduire';
import type { StripeError } from '@stripe/stripe-js';

export const messageStripeIndisponible = (): string => traduire('stripe.indisponible');
export const messagePaiementInattendu = (): string => traduire('stripe.inattendu');

/** Raisons de refus données par la banque (decline_code) traduites : clés stripe.refus.*. */
const MESSAGES_REFUS: readonly string[] = ['insufficient_funds', 'lost_card', 'stolen_card', 'expired_card', 'incorrect_cvc', 'incorrect_number', 'processing_error', 'card_velocity_exceeded', 'do_not_honor', 'fraudulent', 'generic_decline'];

/** Codes d'erreur Stripe traduits : clés stripe.code.*. */
const MESSAGES_CODE: readonly string[] = ['expired_card', 'incorrect_cvc', 'invalid_cvc', 'incorrect_number', 'invalid_number', 'invalid_expiry_month', 'invalid_expiry_year', 'incomplete_number', 'incomplete_expiry', 'incomplete_cvc', 'processing_error', 'authentication_required', 'payment_intent_authentication_failure', 'payment_intent_payment_attempt_failed', 'payment_intent_unexpected_state', 'rate_limit'];

/**
 * Erreur de Stripe.js -> message français. Ordre : raison du refus bancaire, code de l'erreur,
 * puis message de Stripe (dans la langue de l'interface : locale passée à Stripe.js) pour les erreurs de saisie.
 */
export function messageErreurStripe(erreur: StripeError | null | undefined): string {
  if (!erreur) {
    return messagePaiementInattendu();
  }
  if (erreur.type === 'api_connection_error') {
    return messageStripeIndisponible();
  }
  if (erreur.code === 'card_declined') {
    const raison = erreur.decline_code && MESSAGES_REFUS.includes(erreur.decline_code) ? erreur.decline_code : 'generic_decline';
    return traduire(`stripe.refus.${raison}`);
  }
  if (erreur.code && MESSAGES_CODE.includes(erreur.code)) {
    return traduire(`stripe.code.${erreur.code}`);
  }
  if (erreur.type === 'validation_error' && erreur.message) {
    return erreur.message;
  }
  return messagePaiementInattendu();
}
