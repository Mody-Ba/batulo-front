import { CanDeactivateFn } from '@angular/router';
import { PeutQuitter } from './editeur-sondage';

/** Avant de quitter l'éditeur : confirmation si une modification n'est pas enregistrée. */
export const quitterEditeurGuard: CanDeactivateFn<PeutQuitter> = (page) => page.peutQuitter();
