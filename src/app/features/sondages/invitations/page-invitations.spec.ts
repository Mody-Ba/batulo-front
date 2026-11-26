import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { InvitationResponse } from '../../../core/models/invitation.model';
import { VersionResponse } from '../../../core/models/sondage.model';
import { AuthService } from '../../../core/services/auth.service';
import { ExportService } from '../../../core/services/export.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { SondageService } from '../../../core/services/sondage.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { INTERVALLE_SUIVI_MS, PageInvitations } from './page-invitations';
import { inviteDeTest as invite, resumeInvitationsDeTest as resume } from '../../../testing/donnees-test';

const IL_Y_A = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const INVITES: InvitationResponse[] = [
  invite({ id: 1, prenom: 'Aminata', nom: 'Diallo', courriel: 'aminata@exemple.com', statut: 'A_INVITER' }),
  invite({ id: 2, prenom: 'Moussa', nom: 'Kane', courriel: 'moussa@exemple.com', langue: 'ar', statut: 'INVITEE', premierEnvoiLe: IL_Y_A(2), dernierEnvoiLe: IL_Y_A(2), nombreEnvois: 1 }),
  invite({ id: 3, prenom: null, nom: null, courriel: 'fatou@exemple.com', statut: 'A_REPONDU', premierEnvoiLe: IL_Y_A(50), reponduLe: '2026-11-19T00:00:00Z' }),
];

const page = (contenu: InvitationResponse[]) => ({ contenu, page: 0, taille: 20, totalElements: contenu.length, totalPages: 1 });
const ouverte: VersionResponse = { id: 3, version: 1, titre: 'Satisfaction', statut: 'EN_COURS', publie: true, datePublication: IL_Y_A(100), dateFermeture: null, dateCreation: IL_Y_A(200), nombreReponses: 0 };

describe('Onglet « Invitations »', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let versions: VersionResponse[];
  let dialog: { open: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<PageInvitations>;
  const lectureSeule = signal(false);

  async function afficher(entrees: Record<string, string> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(PageInvitations);
    fixture.componentRef.setInput('id', '3');
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const texte = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const bouton = (el: HTMLElement, classe: string) => el.querySelector<HTMLButtonElement>(`button.${classe}`)!;
  const cases = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLInputElement>('td mat-checkbox input'));

  beforeEach(() => {
    lectureSeule.set(false);
    versions = [ouverte];
    service = {
      lister: vi.fn(() => of(page(INVITES))),
      resume: vi.fn(() => of(resume({ total: 3, aInviter: 1, invitees: 1, repondues: 1, envoyees: 2, tauxReponse: 50 }))),
      envoyer: vi.fn(() => of({ enFile: 1, ignorees: [] })),
      relancer: vi.fn(() => of({ enFile: 0, ignorees: [{ invitationId: 2, raison: 'DELAI_RELANCE' }] })),
      revoquer: vi.fn(() => of(INVITES[1])),
      supprimer: vi.fn(() => of(undefined)),
      exporter: vi.fn(),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InvitationService, useValue: service },
        { provide: SondageService, useValue: { detail: vi.fn(() => of(sondageDeTest({ id: 3, publie: true, statut: 'EN_COURS' }))), versions: vi.fn(() => of(versions)) } },
        { provide: AuthService, useValue: { role: signal('ADMIN'), utilisateur: signal({ id: 1 }), lectureSeule } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: ExportService, useValue: { enregistrer: vi.fn() } },
      ],
    });
  });


  it('compteurs (invités, ouverts, répondus, taux avec barre) et tableau : nom, courriel, langue, statut en pastille, dates', async () => {
    const el = await afficher();
    expect(texte(el)).toContain('3 invités');
    expect(texte(el)).toContain('1 a répondu');
    expect(texte(el)).toContain('Taux de réponse');
    expect(el.querySelector<HTMLProgressElement>('progress#taux-reponse')!.value).toBe(50);
    expect(texte(el)).toContain('sur 2 invitations envoyées');

    const lignes = Array.from(el.querySelectorAll('tr.mat-mdc-row'));
    expect(lignes.length).toBe(3);
    expect(texte(lignes[1] as HTMLElement)).toContain('Moussa Kane');
    expect(texte(lignes[1] as HTMLElement)).toContain('moussa@exemple.com');
    expect(texte(lignes[1] as HTMLElement)).toContain('Arabe');
    expect(lignes[1].querySelector('.pastille-statut.invitation-INVITEE')!.textContent).toContain('Invité');
    expect(lignes[2].querySelector('.invitation-A_REPONDU')).not.toBeNull();
    expect(service['lister']).toHaveBeenCalledWith(3, { statut: null, recherche: '', page: 0, taille: 20 });
  });

  it('filtres dans l’URL : statut (paramètre transmis) et recherche envoyée après la frappe', async () => {
    const el = await afficher({ statut: 'INVITEE', recherche: 'kane' });
    expect(service['lister']).toHaveBeenCalledWith(3, { statut: 'INVITEE', recherche: 'kane', page: 0, taille: 20 });

    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (fixture.componentInstance as unknown as { filtrerStatut(s: string): void }).filtrerStatut('A_REPONDU');
    expect(naviguer).toHaveBeenLastCalledWith([], { queryParams: { statut: 'A_REPONDU', page: null }, queryParamsHandling: 'merge' });
    (fixture.componentInstance as unknown as { filtrerStatut(s: string | null): void }).filtrerStatut(null);
    expect(naviguer).toHaveBeenCalledTimes(1);

    const champ = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    champ.value = 'diallo';
    champ.dispatchEvent(new Event('input'));
    expect(naviguer).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 350));
    expect(naviguer).toHaveBeenLastCalledWith([], { queryParams: { recherche: 'diallo', page: null }, queryParamsHandling: 'merge' });
  });

  it('sélection multiple : case d’en-tête partielle, compteur, envoi à la sélection seulement', async () => {
    const el = await afficher();
    cases(el)[0].click();
    fixture.detectChanges();
    expect(texte(el)).toContain('1 invité sélectionné');
    expect((fixture.componentInstance as unknown as { certainesCochees(): boolean }).certainesCochees()).toBe(true);
    expect(bouton(el, 'bouton-envoyer').textContent).toContain('Envoyer aux 1 sélectionnés');

    bouton(el, 'bouton-envoyer').click();
    fixture.detectChanges();
    expect(service['envoyer']).toHaveBeenCalledWith(3, { invitationIds: [1] });
    expect(texte(el)).toContain('1 invitation en cours d’envoi.');
    expect(texte(el)).not.toContain('sélectionné');

    // Tout cocher puis tout désélectionner.
    el.querySelector<HTMLInputElement>('th mat-checkbox input')!.click();
    fixture.detectChanges();
    expect(texte(el)).toContain('3 invités sélectionnés');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Tout désélectionner'))!.click();
    fixture.detectChanges();
    expect(texte(el)).not.toContain('sélectionnés');
  });

  it('boutons désactivés avec la raison : sondage jamais publié', async () => {
    versions = [{ ...ouverte, publie: false, statut: 'NON_COMMENCE' }];
    const el = await afficher();
    expect(bouton(el, 'bouton-envoyer').disabled).toBe(true);
    expect(bouton(el, 'bouton-relancer').disabled).toBe(true);
    expect(el.querySelector('#raison-envoi')!.textContent).toContain('publiez le sondage avant d’envoyer les invitations');
    expect(bouton(el, 'bouton-envoyer').getAttribute('aria-describedby')).toBe('raison-envoi');
  });

  it('boutons désactivés avec la raison : délai de 24 h pour la sélection ; lecture seule', async () => {
    let el = await afficher();
    cases(el)[1].click();
    fixture.detectChanges();
    expect(bouton(el, 'bouton-relancer').disabled).toBe(true);
    expect(el.querySelector('#raison-relance')!.textContent).toContain('une relance au plus toutes les 24 h');

    lectureSeule.set(true);
    el = await afficher();
    expect(bouton(el, 'bouton-envoyer').disabled).toBe(true);
    expect(el.querySelector('#raison-envoi')!.textContent).toContain('Abonnement expiré : lecture seule.');
  });

  it('429 LIMITE_ENVOIS : envois bloqués avec la limite horaire, message du serveur affiché', async () => {
    service['envoyer'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429, error: { code: 'LIMITE_ENVOIS', message: 'Limite de 500 courriels par heure atteinte.' } })),
    );
    const el = await afficher();
    bouton(el, 'bouton-envoyer').click();
    fixture.detectChanges();
    expect(bouton(el, 'bouton-envoyer').disabled).toBe(true);
    expect(bouton(el, 'bouton-relancer').disabled).toBe(true);
    expect(el.querySelector('#raison-envoi')!.textContent).toContain('limite d’envois par heure atteinte ; réessayez après');
    expect(texte(el)).toContain('Limite de 500 courriels par heure atteinte.');
  });

  it('relance : rapport des ignorés avec leur raison', async () => {
    const el = await afficher();
    bouton(el, 'bouton-relancer').click();
    fixture.detectChanges();
    expect(service['relancer']).toHaveBeenCalledWith(3, {});
    expect(texte(el)).toContain('1 ignoré : relancé il y a moins de 24 h (1)');
  });

  it('révocation après confirmation (destructive) ; actions interdites après une réponse', async () => {
    await afficher();
    const composant = fixture.componentInstance as unknown as {
      revoquer(i: InvitationResponse): void;
      peutModifier(i: InvitationResponse): boolean;
      peutRevoquer(i: InvitationResponse): boolean;
      peutSupprimer(i: InvitationResponse): boolean;
    };
    composant.revoquer(INVITES[1]);
    expect(dialog.open.mock.calls[0][1].data).toMatchObject({ titre: 'Révoquer cette invitation ?', destructive: true });
    expect(dialog.open.mock.calls[0][1].data.message).toContain('Moussa Kane');
    expect(service['revoquer']).toHaveBeenCalledWith(3, 2);

    expect([composant.peutModifier(INVITES[2]), composant.peutRevoquer(INVITES[2]), composant.peutSupprimer(INVITES[2])]).toEqual([false, false, false]);
    const revoquee = invite({ statut: 'REVOQUEE' });
    expect([composant.peutModifier(revoquee), composant.peutRevoquer(revoquee), composant.peutSupprimer(revoquee)]).toEqual([false, false, true]);
  });

  it('révocation annulée : rien n’est envoyé', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });
    await afficher();
    (fixture.componentInstance as unknown as { revoquer(i: InvitationResponse): void }).revoquer(INVITES[1]);
    expect(service['revoquer']).not.toHaveBeenCalled();
  });

  it('envoi en arrière-plan : la liste est relue à chaque battement jusqu’à la fin de l’envoi', async () => {
    const battements = new Subject<number>();
    service['lister'].mockReturnValue(of(page([{ ...INVITES[0], envoiEnCours: true }])));
    fixture = TestBed.createComponent(PageInvitations);
    // Battements pilotés par le test (en vrai : interrogationPeriodique toutes les INTERVALLE_SUIVI_MS).
    (fixture.componentInstance as unknown as { battements: () => Subject<number> }).battements = () => battements;
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(texte(el)).toContain('Envoi en cours en arrière-plan');
    expect(battements.observed).toBe(true);

    battements.next(0);
    fixture.detectChanges();
    expect(texte(el)).toContain('Envoi en cours en arrière-plan');

    service['lister'].mockReturnValue(of(page([{ ...INVITES[0], envoiEnCours: false, statut: 'INVITEE', premierEnvoiLe: new Date().toISOString() }])));
    const appels = service['lister'].mock.calls.length;
    battements.next(1);
    fixture.detectChanges();
    expect(service['lister'].mock.calls.length).toBe(appels + 1);
    expect(texte(el)).not.toContain('Envoi en cours en arrière-plan');
    expect(el.querySelector('.invitation-INVITEE')).not.toBeNull();
    // Plus rien en cours : le suivi s'arrête.
    expect(battements.observed).toBe(false);
    expect(INTERVALLE_SUIVI_MS).toBe(3000);
  });
});
