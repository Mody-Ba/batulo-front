import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, EMPTY, filter, map, Observable, switchMap, tap } from 'rxjs';
import { nomComplet } from '../../../core/models/gestionnaire.model';
import {
  AdminDetailResponse,
  CompteAdmin,
  compteDepuisDetail,
  MotDePasseTemporaireResponse,
} from '../../../core/models/super-admin.model';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { messageErreur } from '../../../core/utils/erreur-http';
import { confirmer } from '../../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { DialogueAdmin, DonneesDialogueAdmin } from './dialogue-admin/dialogue-admin';
import { traduire, traduirePluriel } from '../../../core/i18n/traduire';
import { dateEnClair } from '../../../core/i18n/formats.pipes';

/** « 3 gestionnaires », « 1 gestionnaire », « aucun gestionnaire » (dans la langue courante). */
export function libelleGestionnaires(nombre: number): string {
  return nombre === 0 ? traduire('superAdmin.actions.aucunGestionnaire') : traduirePluriel('superAdmin.actions.gestionnaires', nombre);
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

  /** Émet le compte créé (pour ouvrir son détail). */
  creer(): Observable<CompteAdmin> {
    return this.ouvrirFormulaire({}).pipe(
      map(compteDepuisDetail),
      tap((admin) => this.informer(traduire('superAdmin.actions.creee', { entreprise: admin.entreprise, courriel: admin.courriel }))),
    );
  }

  modifier(admin: CompteAdmin): Observable<AdminDetailResponse> {
    return this.ouvrirFormulaire({ admin }).pipe(tap(() => this.informer(traduire('commun.modificationsEnregistrees'))));
  }

  /**
   * Désactiver demande une confirmation, qui prévient que les gestionnaires seront bloqués ;
   * activer, non. `nombreGestionnaires` : connu sur le détail, inconnu (undefined) sinon.
   */
  basculerActif(admin: CompteAdmin, nombreGestionnaires?: number): Observable<AdminDetailResponse> {
    if (!admin.actif) {
      return this.executer(
        this.service.activerAdmin(admin.id),
        traduire('superAdmin.actions.reactivee', { entreprise: admin.entreprise }),
      );
    }
    const gestionnaires =
      nombreGestionnaires === undefined
        ? traduire('superAdmin.actions.gestionnairesBloques')
        : nombreGestionnaires === 0
          ? ''
          : traduirePluriel('superAdmin.actions.nGestionnairesBloques', nombreGestionnaires);
    return confirmer(this.dialog, {
      titre: traduire('superAdmin.actions.desactiverTitre'),
      message: traduire('superAdmin.actions.desactiverMessage', {
        nom: nomComplet(admin),
        entreprise: admin.entreprise,
        gestionnaires: gestionnaires ? ` ${gestionnaires}` : '',
      }),
      action: traduire('commun.desactiver'),
      destructive: true,
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.executer(
          this.service.desactiverAdmin(admin.id),
          traduire('superAdmin.actions.desactivee', { entreprise: admin.entreprise }),
        ),
      ),
    );
  }

  renvoyerMotDePasse(admin: CompteAdmin): Observable<MotDePasseTemporaireResponse> {
    return confirmer(this.dialog, {
      titre: traduire('gestionnaires.actions.renvoyerTitre'),
      message: traduire('gestionnaires.actions.renvoyerMessage', { courriel: admin.courriel }),
      action: traduire('commun.renvoyer'),
    }).pipe(
      filter(Boolean),
      switchMap(() =>
        this.service.renvoyerMotDePasseTemporaire(admin.id).pipe(
          tap((reponse) =>
            this.informer(
              traduire('superAdmin.actions.motDePasseEnvoye', {
                courriel: reponse.courriel,
                date: dateEnClair(reponse.expireLe, 'longHeure'),
              }),
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
  supprimer(admin: CompteAdmin, nombreGestionnaires?: number): Observable<true> {
    const nom = admin.entreprise;
    const gestionnaires =
      nombreGestionnaires === undefined
        ? traduire('superAdmin.actions.contenu.sesGestionnaires')
        : nombreGestionnaires === 0
          ? null
          : traduirePluriel('superAdmin.actions.contenu.nGestionnaires', nombreGestionnaires);
    const contenu = [
      traduire('superAdmin.actions.contenu.admin'),
      gestionnaires,
      traduire('superAdmin.actions.contenu.sondages'),
      traduire('superAdmin.actions.contenu.abonnement'),
    ]
      .filter((partie): partie is string => !!partie)
      .join(traduire('commun.separateurListe'));
    return confirmer(this.dialog, {
      titre: traduire('superAdmin.actions.supprimerTitre'),
      message: traduire('superAdmin.actions.supprimerMessage', { nom, contenu }),
      action: traduire('superAdmin.actions.supprimerDefinitivement'),
      destructive: true,
      saisieAttendue: nom,
    }).pipe(
      filter(Boolean),
      switchMap(() => this.executer(this.service.supprimerAdmin(admin.id), traduire('superAdmin.actions.supprimee', { nom }))),
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
    this.snackBar.open(message, traduire('commun.fermer'), { duration: 6000 });
  }
}
