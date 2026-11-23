import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, EMPTY, filter, map, Observable, switchMap, tap } from 'rxjs';
import { GestionnaireResponse, nomComplet } from '../../../core/models/gestionnaire.model';
import { GestionnaireService } from '../../../core/services/gestionnaire.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import {
  DialogueGestionnaire,
  DonneesDialogueGestionnaire,
} from './dialogue-gestionnaire/dialogue-gestionnaire';
import { traduire } from '../../../core/i18n/traduire';

/**
 * Actions sur un gestionnaire, communes à la liste et au détail : confirmation si besoin, appel,
 * message de retour (snackbar). Chaque méthode émet le gestionnaire à jour, ou rien si l'utilisateur
 * annule ou si le serveur refuse (le message d'erreur est alors affiché).
 */
@Injectable({ providedIn: 'root' })
export class ActionsGestionnaire {
  private readonly service = inject(GestionnaireService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  creer(): Observable<GestionnaireResponse> {
    return this.ouvrirFormulaire({}).pipe(
      tap((g) =>
        this.informer(traduire('gestionnaires.actions.cree', { nom: nomComplet(g), courriel: g.courriel })),
      ),
    );
  }

  modifier(gestionnaire: GestionnaireResponse): Observable<GestionnaireResponse> {
    return this.ouvrirFormulaire({ gestionnaire }).pipe(tap(() => this.informer(traduire('commun.modificationsEnregistrees'))));
  }

  /** Désactiver demande une confirmation ; activer, non. */
  basculerActif(gestionnaire: GestionnaireResponse): Observable<GestionnaireResponse> {
    if (!gestionnaire.actif) {
      return this.executer(
        this.service.activer(gestionnaire.id),
        traduire('gestionnaires.actions.reactive', { nom: nomComplet(gestionnaire) }),
      );
    }
    return confirmer(this.dialog, {
      titre: traduire('gestionnaires.actions.desactiverTitre'),
      message: traduire('gestionnaires.actions.desactiverMessage', { nom: nomComplet(gestionnaire) }),
      action: traduire('commun.desactiver'),
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(
          this.service.desactiver(gestionnaire.id),
          traduire('gestionnaires.actions.desactive', { nom: nomComplet(gestionnaire) }),
        ),
      ),
    );
  }

  renvoyerMotDePasse(gestionnaire: GestionnaireResponse): Observable<GestionnaireResponse> {
    return confirmer(this.dialog, {
      titre: traduire('gestionnaires.actions.renvoyerTitre'),
      message: traduire('gestionnaires.actions.renvoyerMessage', { courriel: gestionnaire.courriel }),
      action: traduire('commun.renvoyer'),
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(
          this.service.renvoyerMotDePasseTemporaire(gestionnaire.id),
          traduire('gestionnaires.actions.motDePasseEnvoye', { courriel: gestionnaire.courriel }),
        ),
      ),
    );
  }

  /** Émet true une fois supprimé. */
  supprimer(gestionnaire: GestionnaireResponse): Observable<true> {
    return confirmer(this.dialog, {
      titre: traduire('gestionnaires.actions.supprimerTitre'),
      message: traduire('gestionnaires.actions.supprimerMessage', { nom: nomComplet(gestionnaire) }),
      action: traduire('commun.supprimer'),
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(
          this.service.supprimer(gestionnaire.id),
          traduire('gestionnaires.actions.supprime', { nom: nomComplet(gestionnaire) }),
        ),
      ),
      map(() => true as const),
    );
  }

  /** Sans confirmation (interrupteur). En cas de refus, l'erreur remonte pour remettre l'interrupteur. */
  changerPermission(gestionnaire: GestionnaireResponse, autorise: boolean): Observable<GestionnaireResponse> {
    return this.service.changerPermissionSondages(gestionnaire.id, autorise).pipe(
      tap(() =>
        this.informer(
          autorise
            ? traduire('gestionnaires.actions.permissionDonnee', { nom: nomComplet(gestionnaire) })
            : traduire('gestionnaires.actions.permissionRetiree', { nom: nomComplet(gestionnaire) }),
        ),
      ),
      catchError((erreur: unknown) => {
        this.informer(messageErreur(erreur));
        throw erreur;
      }),
    );
  }

  private ouvrirFormulaire(donnees: DonneesDialogueGestionnaire): Observable<GestionnaireResponse> {
    return this.dialog
      .open<DialogueGestionnaire, DonneesDialogueGestionnaire, GestionnaireResponse>(DialogueGestionnaire, {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((g): g is GestionnaireResponse => !!g));
  }

  private executer<T>(requete: Observable<T>, succes: string): Observable<T> {
    return requete.pipe(
      tap(() => this.informer(succes)),
      catchError((erreur: unknown) => {
        this.informer(messageErreur(erreur));
        return EMPTY;
      }),
    );
  }

  private informer(message: string): void {
    this.snackBar.open(message, traduire('commun.fermer'), { duration: 6000 });
  }
}
