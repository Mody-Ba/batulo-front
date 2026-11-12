import { DatePipe } from '@angular/common';
import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, EMPTY, filter, map, Observable, switchMap, tap } from 'rxjs';
import { nomComplet } from '../../../core/models/gestionnaire.model';
import { AdminDetailResponse, MotDePasseTemporaireResponse } from '../../../core/models/super-admin.model';
import { UtilisateurResponse } from '../../../core/models/utilisateur.model';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { DialogueAdmin, DonneesDialogueAdmin } from './dialogue-admin/dialogue-admin';

/** « 3 gestionnaires », « 1 gestionnaire », « aucun gestionnaire ». */
export function libelleGestionnaires(nombre: number): string {
  if (nombre === 0) {
    return 'aucun gestionnaire';
  }
  return nombre === 1 ? '1 gestionnaire' : `${nombre} gestionnaires`;
}

/** Nom de l'entreprise d'un admin (toujours présent pour un admin). */
function entreprise(admin: UtilisateurResponse): string {
  return admin.entreprise ?? `Entreprise de ${nomComplet(admin)}`;
}

/**
 * Actions du super admin sur un admin, communes à la liste et au détail : confirmation si besoin, appel,
 * message de retour (snackbar). Chaque méthode émet le résultat, ou rien si l'utilisateur annule ou si le
 * serveur refuse (le message d'erreur est alors affiché).
 */
@Injectable({ providedIn: 'root' })
export class ActionsAdmin {
  private readonly service = inject(SuperAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  creer(): Observable<AdminDetailResponse> {
    return this.ouvrirFormulaire({}).pipe(
      tap(({ admin }) =>
        this.informer(
          `${entreprise(admin)} a été créée. Un mot de passe temporaire a été envoyé à ${admin.courriel} ; ` +
            'l’abonnement attend le paiement de l’admin.',
        ),
      ),
    );
  }

  modifier(admin: UtilisateurResponse): Observable<AdminDetailResponse> {
    return this.ouvrirFormulaire({ admin }).pipe(tap(() => this.informer('Modifications enregistrées.')));
  }

  /**
   * Désactiver demande une confirmation, qui prévient que les gestionnaires seront bloqués ;
   * activer, non. `nombreGestionnaires` : connu sur le détail, inconnu (undefined) sinon.
   */
  basculerActif(admin: UtilisateurResponse, nombreGestionnaires?: number): Observable<AdminDetailResponse> {
    if (!admin.actif) {
      return this.executer(
        this.service.activerAdmin(admin.id),
        `${entreprise(admin)} est de nouveau active, avec ses gestionnaires.`,
      );
    }
    const gestionnaires =
      nombreGestionnaires === undefined
        ? ' Ses gestionnaires seront bloqués aussi.'
        : nombreGestionnaires === 0
          ? ''
          : ` Ses ${libelleGestionnaires(nombreGestionnaires)} seront bloqués aussi.`;
    return confirmer(this.dialog, {
      titre: 'Désactiver cette entreprise ?',
      message:
        `${nomComplet(admin)} (${entreprise(admin)}) ne pourra plus se connecter.${gestionnaires} ` +
        'Les sondages de l’entreprise n’accepteront plus de réponses. Rien n’est supprimé ; vous pourrez la réactiver.',
      action: 'Désactiver',
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(
          this.service.desactiverAdmin(admin.id),
          `${entreprise(admin)} est désactivée, avec ses gestionnaires.`,
        ),
      ),
    );
  }

  renvoyerMotDePasse(admin: UtilisateurResponse): Observable<MotDePasseTemporaireResponse> {
    return confirmer(this.dialog, {
      titre: 'Renvoyer un mot de passe temporaire ?',
      message: `Un nouveau mot de passe, valable 24 heures, sera envoyé à ${admin.courriel}. L’ancien ne fonctionnera plus.`,
      action: 'Renvoyer',
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.service.renvoyerMotDePasseTemporaire(admin.id).pipe(
          tap((reponse) =>
            this.informer(
              `Mot de passe temporaire envoyé à ${reponse.courriel}, valable jusqu’au ` +
                `${this.dates.transform(reponse.expireLe, 'd MMMM y à HH:mm')}.`,
            ),
          ),
          catchError((erreur: unknown) => {
            this.informer(messageErreur(erreur));
            return EMPTY;
          }),
        ),
      ),
    );
  }

  /** Confirmation forte (taper le nom de l'entreprise). Émet true une fois supprimé. */
  supprimer(admin: UtilisateurResponse, nombreGestionnaires?: number): Observable<true> {
    const nom = entreprise(admin);
    const gestionnaires =
      nombreGestionnaires === undefined
        ? 'ses gestionnaires'
        : nombreGestionnaires === 0
          ? null
          : `ses ${libelleGestionnaires(nombreGestionnaires)}`;
    const contenu = ['son admin', gestionnaires, 'ses sondages et leurs réponses', 'son abonnement et ses paiements']
      .filter((partie): partie is string => !!partie)
      .join(', ');
    return confirmer(this.dialog, {
      titre: 'Supprimer cette entreprise ?',
      message:
        `L’entreprise « ${nom} » sera supprimée définitivement, avec ${contenu}. Cette action est irréversible. ` +
        'Pour lui couper l’accès sans rien perdre, désactivez-la plutôt.',
      action: 'Supprimer définitivement',
      destructive: true,
      saisieAttendue: nom,
    }).pipe(
      filter(Boolean),
      switchMap(() => this.executer(this.service.supprimerAdmin(admin.id), `${nom} a été supprimée.`)),
      map(() => true as const),
    );
  }

  private ouvrirFormulaire(donnees: DonneesDialogueAdmin): Observable<AdminDetailResponse> {
    return this.dialog
      .open<DialogueAdmin, DonneesDialogueAdmin, AdminDetailResponse>(DialogueAdmin, {
        data: donnees,
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((detail): detail is AdminDetailResponse => !!detail));
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
