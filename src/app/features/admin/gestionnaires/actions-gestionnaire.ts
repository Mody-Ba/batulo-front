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
        this.informer(`${nomComplet(g)} a été créé. Un mot de passe temporaire a été envoyé à ${g.courriel}.`),
      ),
    );
  }

  modifier(gestionnaire: GestionnaireResponse): Observable<GestionnaireResponse> {
    return this.ouvrirFormulaire({ gestionnaire }).pipe(tap(() => this.informer('Modifications enregistrées.')));
  }

  /** Désactiver demande une confirmation ; activer, non. */
  basculerActif(gestionnaire: GestionnaireResponse): Observable<GestionnaireResponse> {
    if (!gestionnaire.actif) {
      return this.executer(
        this.service.activer(gestionnaire.id),
        `${nomComplet(gestionnaire)} est de nouveau actif.`,
      );
    }
    return confirmer(this.dialog, {
      titre: 'Désactiver ce gestionnaire ?',
      message: `${nomComplet(gestionnaire)} ne pourra plus se connecter. Ses sondages et ses assignations sont conservés ; vous pourrez le réactiver.`,
      action: 'Désactiver',
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(this.service.desactiver(gestionnaire.id), `${nomComplet(gestionnaire)} est désactivé.`),
      ),
    );
  }

  renvoyerMotDePasse(gestionnaire: GestionnaireResponse): Observable<GestionnaireResponse> {
    return confirmer(this.dialog, {
      titre: 'Renvoyer un mot de passe temporaire ?',
      message: `Un nouveau mot de passe, valable 24 heures, sera envoyé à ${gestionnaire.courriel}. L’ancien ne fonctionnera plus.`,
      action: 'Renvoyer',
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(
          this.service.renvoyerMotDePasseTemporaire(gestionnaire.id),
          `Mot de passe temporaire envoyé à ${gestionnaire.courriel}.`,
        ),
      ),
    );
  }

  /** Émet true une fois supprimé. */
  supprimer(gestionnaire: GestionnaireResponse): Observable<true> {
    return confirmer(this.dialog, {
      titre: 'Supprimer ce gestionnaire ?',
      message: `${nomComplet(gestionnaire)} sera supprimé définitivement. Cette action est irréversible. Pour lui couper l’accès sans rien perdre, désactivez-le plutôt.`,
      action: 'Supprimer',
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(this.service.supprimer(gestionnaire.id), `${nomComplet(gestionnaire)} a été supprimé.`),
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
            ? `${nomComplet(gestionnaire)} peut maintenant créer des sondages.`
            : `${nomComplet(gestionnaire)} ne peut plus créer de sondages.`,
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
    this.snackBar.open(message, 'Fermer', { duration: 6000 });
  }
}
