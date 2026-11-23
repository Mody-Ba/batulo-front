import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, EMPTY, filter, Observable, switchMap, tap } from 'rxjs';
import { SondageResponse } from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { aLeCode, messageErreur } from '../../../core/utils/erreur-http';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { DialoguePublication, DonneesPublication } from './dialogue-publication/dialogue-publication';
import { traduire } from '../../../core/i18n/traduire';
import { dateEnClair } from '../../../core/i18n/formats.pipes';

/**
 * Cycle de vie d'un sondage, commun à la fiche et à l'éditeur : publier, ajuster les dates, fermer, nouvelle version,
 * dupliquer, modèle. Confirmation si besoin, appel, message (snackbar), navigation. Chaque méthode émet le sondage à
 * jour, ou rien si l'utilisateur annule ou si le serveur refuse (le message est alors affiché).
 */
@Injectable({ providedIn: 'root' })
export class ActionsSondage {
  private readonly service = inject(SondageService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  /** `surReglageEnregistre` : appelée si « une réponse par appareil » est enregistré avant la publication. */
  publier(
    sondage: SondageResponse,
    surReglageEnregistre?: (brouillon: SondageResponse) => void,
  ): Observable<SondageResponse> {
    return this.ouvrirDates({ sondage, mode: 'publier', surReglageEnregistre }).pipe(
      tap((publie) =>
        this.informer(
          publie.statut === 'NON_COMMENCE'
            ? traduire('sondages.actions.planifiee', { date: this.date(publie.datePublication) })
            : traduire('sondages.actions.publie'),
        ),
      ),
    );
  }

  modifierDates(sondage: SondageResponse): Observable<SondageResponse> {
    return this.ouvrirDates({ sondage, mode: 'dates' }).pipe(tap(() => this.informer(traduire('sondages.actions.datesEnregistrees'))));
  }

  fermer(sondage: SondageResponse): Observable<SondageResponse> {
    return confirmer(this.dialog, {
      titre: traduire('sondages.actions.fermerTitre'),
      message: traduire('sondages.actions.fermerMessage', { titre: sondage.titre }),
      action: traduire('sondages.fiche.fermer'),
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() => this.executer(this.service.fermer(sondage.id), traduire('sondages.actions.ferme'))),
    );
  }

  /**
   * Nouveau brouillon (version N+1) puis ouverture dans l'éditeur. Si une version est déjà en préparation
   * (BROUILLON_EXISTANT), c'est elle qui s'ouvre.
   */
  nouvelleVersion(sondage: SondageResponse): Observable<SondageResponse> {
    return this.service.nouvelleVersion(sondage.id).pipe(
      tap((brouillon) => {
        this.informer(traduire('sondages.actions.versionCreee', { version: brouillon.version }));
        void this.router.navigate(['/sondages', brouillon.id, 'modifier']);
      }),
      catchError((erreur: unknown) => {
        if (aLeCode(erreur, 'BROUILLON_EXISTANT')) {
          this.ouvrirVersionEnPreparation(sondage.id, messageErreur(erreur));
        } else {
          this.informer(messageErreur(erreur));
        }
        return EMPTY;
      }),
    );
  }

  /** Copie indépendante (version 1, sans dates, assignations ni réponses), ouverte dans l'éditeur. */
  dupliquer(sondage: SondageResponse): Observable<SondageResponse> {
    return this.executer(this.service.dupliquer(sondage.id), traduire('sondages.actions.copieCreee')).pipe(
      tap((copie) => void this.router.navigate(['/sondages', copie.id, 'modifier'])),
    );
  }

  basculerModele(sondage: SondageResponse): Observable<SondageResponse> {
    const estModele = !sondage.estModele;
    return this.executer(
      this.service.marquerModele(sondage.id, estModele),
      estModele
        ? traduire('sondages.actions.marqueModele')
        : traduire('sondages.actions.retireModele'),
    );
  }

  private ouvrirVersionEnPreparation(id: number, message: string): void {
    this.service.versions(id).subscribe({
      next: (versions) => {
        const brouillon = versions.find((v) => !v.publie);
        this.informer(brouillon ? `${message} ${traduire('sondages.actions.elleSOuvre')}` : message);
        if (brouillon) {
          void this.router.navigate(['/sondages', brouillon.id, 'modifier']);
        }
      },
      error: () => this.informer(message),
    });
  }

  private ouvrirDates(donnees: DonneesPublication): Observable<SondageResponse> {
    return this.dialog
      .open<DialoguePublication, DonneesPublication, SondageResponse>(DialoguePublication, {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((sondage): sondage is SondageResponse => !!sondage));
  }

  private executer(requete: Observable<SondageResponse>, succes: string): Observable<SondageResponse> {
    return requete.pipe(
      tap(() => this.informer(succes)),
      catchError((erreur: unknown) => {
        this.informer(messageErreur(erreur));
        return EMPTY;
      }),
    );
  }

  private date(iso: string | null): string {
    return iso ? dateEnClair(iso, 'longHeure') : '';
  }

  private informer(message: string): void {
    this.snackBar.open(message, traduire('commun.fermer'), { duration: 6000 });
  }
}

