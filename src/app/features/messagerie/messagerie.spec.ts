import { signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConversationResponse, MessageInterneResponse } from '../../core/models/messagerie.model';
import { Role } from '../../core/models/role.model';
import { AuthService } from '../../core/services/auth.service';
import { GestionnaireService } from '../../core/services/gestionnaire.service';
import { MessagerieService } from '../../core/services/messagerie.service';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { adminLigneDeTest, gestionnaireDeTest } from '../../testing/donnees-test';
import { DialogueNouvelleConversation } from './dialogue-nouvelle-conversation';
import { EtatMessagerie } from './etat-messagerie';
import { FilConversation } from './fil-conversation';
import { lienMessage } from './liens-messages';
import { PageMessagerie } from './page-messagerie';

const BATULO: ConversationResponse = {
  id: 1,
  interlocuteur: { id: null, prenom: 'Batulo', nom: '', role: 'SUPER_ADMIN', entreprise: null },
  dernierMessage: { extrait: 'Demande d’augmentation…', dateEnvoi: '2026-11-13T09:00:00Z', expediteurNom: 'Awa Diallo', type: 'DEMANDE_ABONNEMENT', recu: false },
  nonLus: 0,
  dernierMessageLe: '2026-11-13T09:00:00Z',
};
const MOUSSA: ConversationResponse = {
  id: 5,
  interlocuteur: { id: 9, prenom: 'Moussa', nom: 'Kane', role: 'GESTIONNAIRE', entreprise: 'Sahel Data' },
  dernierMessage: { extrait: 'Les résultats sont prêts', dateEnvoi: '2026-11-14T08:00:00Z', expediteurNom: 'Moussa Kane', type: 'TEXTE', recu: true },
  nonLus: 2,
  dernierMessageLe: '2026-11-14T08:00:00Z',
};

function message(modifs: Partial<MessageInterneResponse> = {}): MessageInterneResponse {
  return {
    id: 1,
    conversationId: 5,
    type: 'TEXTE',
    referenceId: null,
    contenu: 'Bonjour',
    expediteurId: 9,
    expediteurNom: 'Moussa Kane',
    cote: 'GESTIONNAIRE',
    recu: true,
    dateEnvoi: '2026-11-14T08:00:00Z',
    luLe: null,
    ...modifs,
  };
}

const page = <T>(contenu: T[], totalPages = 1) => ({ contenu, page: 0, taille: 30, totalElements: contenu.length, totalPages });
const texte = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
const attendre = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('Messagerie', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let role: ReturnType<typeof signal<Role>>;
  let lectureSeule: ReturnType<typeof signal<boolean>>;
  let dialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    role = signal<Role>('ADMIN');
    lectureSeule = signal(false);
    dialog = { open: vi.fn() };
    service = {
      conversations: vi.fn(() => of(page([MOUSSA, BATULO]))),
      ouvrir: vi.fn(() => of(MOUSSA)),
      messages: vi.fn(() => of(page([message({ id: 2, dateEnvoi: '2026-11-14T08:00:00Z' }), message({ id: 1, dateEnvoi: '2026-11-14T07:00:00Z', recu: false, luLe: '2026-11-14T07:30:00Z' })], 2))),
      envoyer: vi.fn(() => of(message({ id: 3, recu: false, contenu: 'Merci', dateEnvoi: '2026-11-14T09:00:00Z' }))),
      marquerLue: vi.fn(() => of({ message: 'ok', nombreMarquees: 1 })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        EtatMessagerie,
        { provide: MessagerieService, useValue: service },
        { provide: AuthService, useValue: { role, lectureSeule } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  async function afficher<T>(composant: Type<T>, entrees: Record<string, unknown> = {}): Promise<ComponentFixture<T>> {
    const f = TestBed.createComponent(composant);
    for (const [nom, valeur] of Object.entries(entrees)) {
      f.componentRef.setInput(nom, valeur);
    }
    await f.whenStable();
    await attendre();
    f.detectChanges();
    await f.whenStable();
    return f;
  }

  it('liste : interlocuteur, dernier message (« Vous : » si envoyé), non lus ; Batulo pour l’admin', async () => {
    const f = await afficher(PageMessagerie);
    const lignes = (f.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.conversation');
    expect(lignes.length).toBe(2);
    expect(lignes[0].getAttribute('aria-label')).toBe('Moussa Kane, 2 non lus, Les résultats sont prêts');
    expect(lignes[0].classList).toContain('non-lue');
    expect(lignes[0].querySelector('.pastille-non-lus')!.textContent?.trim()).toBe('2');
    expect(lignes[1].textContent).toContain('Batulo');
    expect(lignes[1].getAttribute('aria-label')).toContain('Vous : Demande d’augmentation');
  });

  it('super admin : l’entreprise de l’admin est affichée', async () => {
    role.set('SUPER_ADMIN');
    service['conversations'].mockReturnValue(of(page([{ ...MOUSSA, interlocuteur: { ...MOUSSA.interlocuteur, role: 'ADMIN' } }])));
    const f = await afficher(PageMessagerie);
    expect(texte(f)).toContain('Sahel Data');
  });

  it('gestionnaire : « Écrire à mon admin » ouvre directement sa conversation (corps vide), sans dialogue', async () => {
    role.set('GESTIONNAIRE');
    const f = await afficher(PageMessagerie);
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const bouton = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Écrire à mon admin'))!;
    bouton.click();
    expect(service['ouvrir']).toHaveBeenCalledWith({});
    expect(dialog.open).not.toHaveBeenCalled();
    expect(naviguer).toHaveBeenCalledWith(['/messagerie', 5]);
  });

  it('admin : « Nouvelle conversation » ouvre le choix des interlocuteurs autorisés', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const f = await afficher(PageMessagerie);
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Nouvelle conversation'))!.click();
    expect(dialog.open.mock.calls[0][0]).toBe(DialogueNouvelleConversation);
  });

  describe('fil', () => {
    it('du plus ancien au plus récent ; reçus non lus -> conversation marquée lue (liste mise à jour)', async () => {
      const etat = TestBed.inject(EtatMessagerie);
      etat.conversations.set([MOUSSA]);
      const f = await afficher(FilConversation, { id: '5' });
      expect(service['messages']).toHaveBeenCalledWith(5, 0, 30);
      const contenus = Array.from((f.nativeElement as HTMLElement).querySelectorAll('app-message-conversation article')).map((a) => a.getAttribute('aria-label'));
      expect(contenus).toEqual(['Votre message', 'Message de Moussa Kane']);
      expect(texte(f)).toContain('Lu');
      expect(service['marquerLue']).toHaveBeenCalledWith(5);
      expect(etat.conversations()[0].nonLus).toBe(0);
      expect(etat.conversationActive()).toBe(5);
      expect((f.nativeElement as HTMLElement).querySelector('[role="log"]')).not.toBeNull();
    });

    it('« Messages plus anciens » : page suivante ajoutée au-dessus, sans doublon ; bouton masqué à la fin', async () => {
      const f = await afficher(FilConversation, { id: '5' });
      service['messages'].mockReturnValue(of({ ...page([message({ id: 1 }), message({ id: 0, dateEnvoi: '2026-11-13T07:00:00Z', contenu: 'Ancien', luLe: 'x' })], 2), page: 1 }));
      Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Messages plus anciens'))!.click();
      f.detectChanges();
      await f.whenStable();
      expect(service['messages']).toHaveBeenLastCalledWith(5, 1, 30);
      const articles = (f.nativeElement as HTMLElement).querySelectorAll('app-message-conversation');
      expect(articles.length).toBe(3);
      expect(articles[0].textContent).toContain('Ancien');
      expect(texte(f)).not.toContain('Messages plus anciens');
    });

    it('envoi : Ctrl + Entrée envoie le texte nettoyé, le message s’ajoute et la liste est relue ; Entrée seule n’envoie pas', async () => {
      const etat = TestBed.inject(EtatMessagerie);
      const f = await afficher(FilConversation, { id: '5' });
      const zone = (f.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>('textarea')!;
      zone.value = '  Merci  ';
      zone.dispatchEvent(new Event('input'));
      zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(service['envoyer']).not.toHaveBeenCalled();
      zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
      f.detectChanges();
      expect(service['envoyer']).toHaveBeenCalledWith(5, 'Merci');
      expect(texte(f)).toContain('Merci');
      expect(zone.value).toBe('');
      expect(etat.relecture()).toBe(1);
    });

    it('message vide : rien n’est envoyé, erreur affichée', async () => {
      const f = await afficher(FilConversation, { id: '5' });
      (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      f.detectChanges();
      expect(service['envoyer']).not.toHaveBeenCalled();
      expect(texte(f)).toContain('Écrivez un message.');
    });

    it('abonnement expiré : conversation admin ↔ gestionnaire en lecture seule, Batulo reste ouverte', async () => {
      lectureSeule.set(true);
      const etat = TestBed.inject(EtatMessagerie);
      etat.conversations.set([MOUSSA, BATULO]);
      let f = await afficher(FilConversation, { id: '5' });
      expect(texte(f)).toContain('Abonnement expiré : lecture seule. Vous pouvez toujours écrire à Batulo.');
      expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();

      f = await afficher(FilConversation, { id: '1' });
      expect((f.nativeElement as HTMLElement).querySelector('textarea')).not.toBeNull();
    });

    it('refus du serveur (403 ABONNEMENT_EXPIRE) : message et saisie verrouillée', async () => {
      TestBed.inject(EtatMessagerie).conversations.set([MOUSSA]);
      const f = await afficher(FilConversation, { id: '5' });
      service['envoyer'].mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'ABONNEMENT_EXPIRE', message: 'Abonnement expiré.' } })),
      );
      const zone = (f.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>('textarea')!;
      zone.value = 'Bonjour';
      zone.dispatchEvent(new Event('input'));
      (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();
      expect(texte(f)).toContain('lecture seule');
    });

    it('message automatique : carte distincte, « Message automatique », lien vers l’élément', async () => {
      service['messages'].mockReturnValue(of(page([message({ id: 4, type: 'STATISTIQUES', referenceId: 12, contenu: 'Statistiques de « Malnutrition »', luLe: 'x' })])));
      const f = await afficher(FilConversation, { id: '5' });
      const carte = (f.nativeElement as HTMLElement).querySelector('article.automatique')!;
      expect(carte.textContent).toContain('Message automatique · Statistiques envoyées');
      expect(carte.querySelector('a')!.getAttribute('href')).toBe('/admin/statistiques-recues/12');
      expect(service['marquerLue']).not.toHaveBeenCalled();
    });
  });

  it('liens des messages automatiques selon le rôle', () => {
    const stats = message({ type: 'STATISTIQUES', referenceId: 12 });
    const demande = message({ type: 'DEMANDE_ABONNEMENT', referenceId: 3 });
    expect(lienMessage(stats, 'ADMIN')!.commandes).toEqual(['/admin/statistiques-recues', 12]);
    expect(lienMessage(stats, 'GESTIONNAIRE')!.commandes).toEqual(['/gestionnaire/statistiques-envoyees']);
    expect(lienMessage(demande, 'ADMIN')!.commandes).toEqual(['/admin/abonnement/demandes']);
    expect(lienMessage(message({ type: 'REPONSE_DEMANDE' }), 'SUPER_ADMIN')!.commandes).toEqual(['/super-admin/demandes-abonnement']);
    expect(lienMessage(message(), 'ADMIN')).toBeNull();
  });

  describe('nouvelle conversation', () => {
    let reference: { close: ReturnType<typeof vi.fn> };
    let gestionnaires: { lister: ReturnType<typeof vi.fn> };
    let superAdmin: { listerAdmins: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      reference = { close: vi.fn() };
      gestionnaires = { lister: vi.fn(() => of({ contenu: [gestionnaireDeTest({ id: 9, prenom: 'Moussa', nom: 'Kane' }), gestionnaireDeTest({ id: 10, prenom: 'Inès', nom: 'Sy', actif: false })], page: 0, taille: 50, totalElements: 2, totalPages: 1 })) };
      superAdmin = { listerAdmins: vi.fn(() => of({ contenu: [adminLigneDeTest()], page: 0, taille: 50, totalElements: 1, totalPages: 1 })) };
      TestBed.configureTestingModule({
        providers: [
          { provide: MatDialogRef, useValue: reference },
          { provide: GestionnaireService, useValue: gestionnaires },
          { provide: SuperAdminService, useValue: superAdmin },
        ],
      });
    });

    it('admin : Batulo puis ses gestionnaires (désactivé signalé) ; Batulo = corps sans interlocuteur', async () => {
      const f = await afficher(DialogueNouvelleConversation);
      await attendre(350);
      f.detectChanges();
      expect(gestionnaires.lister).toHaveBeenCalledWith({ recherche: null, taille: 50 });
      const choix = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.interlocuteur'));
      expect(choix.map((b) => b.querySelector('.nom')!.textContent?.trim())).toEqual(['Batulo', 'Moussa Kane', 'Inès Sy']);
      expect(choix[2].textContent).toContain('désactivé');
      service['ouvrir'].mockReturnValue(of(BATULO));
      choix[0].click();
      expect(service['ouvrir']).toHaveBeenCalledWith({});
      expect(reference.close).toHaveBeenCalledWith(BATULO);
    });

    it('admin : un gestionnaire -> { interlocuteurId } ; erreur du serveur affichée sans fermer', async () => {
      const f = await afficher(DialogueNouvelleConversation);
      await attendre(350);
      f.detectChanges();
      const reponse = new Subject<ConversationResponse>();
      service['ouvrir'].mockReturnValue(reponse);
      (f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.interlocuteur')[1].click();
      expect(service['ouvrir']).toHaveBeenCalledWith({ interlocuteurId: 9 });
      reponse.error(new HttpErrorResponse({ status: 404, error: { code: 'INTERLOCUTEUR_INTROUVABLE', message: 'Interlocuteur introuvable.' } }));
      f.detectChanges();
      expect(texte(f)).toContain('Interlocuteur introuvable.');
      expect(reference.close).not.toHaveBeenCalled();
    });

    it('super admin : les admins (avec leur entreprise), sans Batulo', async () => {
      role.set('SUPER_ADMIN');
      const f = await afficher(DialogueNouvelleConversation);
      await attendre(350);
      f.detectChanges();
      expect(superAdmin.listerAdmins).toHaveBeenCalledWith({ recherche: null, taille: 50 });
      const choix = (f.nativeElement as HTMLElement).querySelectorAll('button.interlocuteur');
      expect(choix.length).toBe(1);
      expect(texte(f)).not.toContain('Batulo');
    });
  });
});
