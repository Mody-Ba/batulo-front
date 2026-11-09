import { Component, computed, input } from '@angular/core';
import { detailsErreur, messageErreur } from '../../../core/utils/erreur-http';
import { Encadre } from '../encadre/encadre';

/**
 * Affiche clairement une erreur du backend ({ code, message }) : le message du serveur et, pour
 * une erreur de validation, la liste des champs refusés. N'affiche rien si `erreur` est null.
 *
 * <app-message-erreur [erreur]="erreur()" />
 */
@Component({
  selector: 'app-message-erreur',
  imports: [Encadre],
  template: `
    @if (erreur() !== null) {
      <app-encadre type="erreur" role="alert" [titre]="titre()">
        <p>{{ message() }}</p>
        @if (details().length) {
          <ul>
            @for (detail of details(); track detail) {
              <li>{{ detail }}</li>
            }
          </ul>
        }
        <ng-content />
      </app-encadre>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class MessageErreur {
  /** Erreur reçue (HttpErrorResponse en général) ; null pour ne rien afficher. */
  readonly erreur = input<unknown>(null);
  /** Message si le serveur n'en donne pas. */
  readonly parDefaut = input<string | undefined>(undefined);
  readonly titre = input<string | null>(null);

  protected readonly message = computed(() => messageErreur(this.erreur(), this.parDefaut()));
  protected readonly details = computed(() => detailsErreur(this.erreur()));
}
