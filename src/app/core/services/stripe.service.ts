import { Injectable } from '@angular/core';
import type { Stripe } from '@stripe/stripe-js';

/**
 * Chargement de Stripe.js. La version « pure » n'injecte le script de js.stripe.com qu'au premier
 * appel (page de paiement), pas au démarrage de l'application. Une instance par clé publique.
 * Les données de carte restent dans les iframes de Stripe : elles ne passent jamais par notre code.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly instances = new Map<string, Promise<Stripe | null>>();

  charger(clePublique: string): Promise<Stripe | null> {
    let instance = this.instances.get(clePublique);
    if (!instance) {
      instance = import('@stripe/stripe-js/pure').then(({ loadStripe }) =>
        loadStripe(clePublique, { locale: 'fr-CA' }),
      );
      // Échec (réseau, bloqueur) : on pourra réessayer.
      instance.catch(() => this.instances.delete(clePublique));
      this.instances.set(clePublique, instance);
    }
    return instance;
  }
}
