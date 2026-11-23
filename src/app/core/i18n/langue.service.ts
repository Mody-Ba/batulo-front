import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT, registerLocaleData } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter, firstValueFrom } from 'rxjs';
import { ChargeurTraductions, estPagePublique } from './chargeur-traductions';
import { ecrireLocal, lireLocal } from '../utils/stockage-local';
import { CLE_STOCKAGE_LANGUE, definitionLangue, estLangue, Langue, langueDuNavigateur } from './langues';
import { brancherTraductions } from './traduire';

/** Données de langue d'Angular chargées à la demande (fr-CA est dans le bundle initial). */
const DONNEES_LOCALES: Record<string, () => Promise<{ default: unknown }>> = {
  'en-CA': () => import('@angular/common/locales/en-CA'),
  ar: () => import('@angular/common/locales/ar'),
};
const localesChargees = new Set<string>(['fr-CA']);

/**
 * Langue de l'interface : choix gardé dans localStorage (batulo.langue), sinon langue du navigateur (fr, en, ar), sinon
 * le français. Au changement, sans rechargement : textes (Transloco), données de format, lang et dir sur <html>, et
 * direction d'Angular Material (Directionality, menus et dialogues compris).
 */
@Injectable({ providedIn: 'root' })
export class LangueService {
  private readonly transloco = inject(TranslocoService);
  private readonly direction = inject(Directionality);
  private readonly document = inject(DOCUMENT);
  private readonly chargeur = inject(ChargeurTraductions);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _langue = signal<Langue>(this.langueInitiale());
  /** Langue affichée (ses textes sont chargés). */
  readonly langue = this._langue.asReadonly();

  /** Au démarrage (provideAppInitializer) : la page s'affiche directement dans la bonne langue. */
  initialiser(): Promise<void> {
    // Arrivé par le formulaire public (/s/), seul son petit fichier est chargé : le reste en le quittant.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.completerTraductions());
    return this.appliquer(this._langue());
  }

  /** Changement de langue à l'exécution ; le choix est mémorisé. */
  async changer(langue: Langue): Promise<void> {
    ecrireLocal(CLE_STOCKAGE_LANGUE, langue);
    await this.appliquer(langue);
  }

  private langueInitiale(): Langue {
    const gardee = lireLocal<unknown>(CLE_STOCKAGE_LANGUE);
    if (estLangue(gardee)) {
      return gardee;
    }
    const navigateur = this.document.defaultView?.navigator;
    return langueDuNavigateur(navigateur?.languages?.length ? navigateur.languages : navigateur?.language ? [navigateur.language] : []);
  }

  private async appliquer(langue: Langue): Promise<void> {
    const definition = definitionLangue(langue);
    await Promise.all([this.chargerDonneesLocales(definition.localeAngular), firstValueFrom(this.transloco.load(langue))]);
    this.transloco.setActiveLang(langue);
    brancherTraductions(this.transloco, langue);
    const html = this.document.documentElement;
    html.lang = langue;
    html.dir = definition.dir;
    if (this.direction.value !== definition.dir) {
      this.direction.valueSignal.set(definition.dir);
      this.direction.change.emit(definition.dir);
    }
    this._langue.set(langue);
  }

  /** Ajoute le fichier principal aux langues chargées depuis le formulaire public, dès qu'on le quitte. */
  private async completerTraductions(): Promise<void> {
    if (estPagePublique() || this.chargeur.partielles.size === 0) {
      return;
    }
    for (const langue of [...this.chargeur.partielles]) {
      this.chargeur.partielles.delete(langue);
      const principale = await firstValueFrom(this.chargeur.principale(langue));
      this.transloco.setTranslation(principale, langue, { merge: true });
    }
  }

  private async chargerDonneesLocales(locale: string): Promise<void> {
    if (localesChargees.has(locale)) {
      return;
    }
    const module = await DONNEES_LOCALES[locale]?.();
    if (module) {
      registerLocaleData(module.default);
      localesChargees.add(locale);
    }
  }
}
