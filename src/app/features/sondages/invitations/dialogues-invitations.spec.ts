import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { RapportImportResponse } from '../../../core/models/invitation.model';
import { ExportService } from '../../../core/services/export.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { SondageService } from '../../../core/services/sondage.service';
import { inviteDeTest, sondageResumeDeTest } from '../../../testing/donnees-test';
import { DialogueImport } from './dialogue-import';
import { DialogueInvite } from './dialogue-invite';
import { DialogueReprise } from './dialogue-reprise';
import { contenuModeleCsv, estFichierCsv, NOM_MODELE_CSV } from './modele-csv';
import { libelleRefus } from './rapport-import';

const texte = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
const boutons = (el: HTMLElement | Document) => Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
const bouton = (el: HTMLElement | Document, libelle: string) => boutons(el).find((b) => texte(b).includes(libelle))!;

async function stable<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement;
}

function saisir(champ: HTMLInputElement, valeur: string): void {
  champ.value = valeur;
  champ.dispatchEvent(new Event('input'));
  champ.dispatchEvent(new Event('blur'));
}

describe('Modèle CSV et raisons de refus', () => {
  it('modèle : BOM UTF-8, en-têtes du serveur séparés par « ; », une ligne d’exemple', () => {
    const contenu = contenuModeleCsv();
    expect(contenu.charCodeAt(0)).toBe(0xfeff);
    const lignes = contenu.slice(1).trim().split('\r\n');
    expect(lignes[0]).toBe('prenom;nom;courriel;telephone;langue');
    expect(lignes.length).toBe(2);
    expect(lignes[1].split(';').length).toBe(5);
  });

  it('fichier accepté : extension .csv (toute casse) ou type text/csv', () => {
    expect(estFichierCsv({ name: 'invites.CSV', type: '' })).toBe(true);
    expect(estFichierCsv({ name: 'export', type: 'text/csv' })).toBe(true);
    expect(estFichierCsv({ name: 'invites.xlsx', type: 'application/vnd.ms-excel' })).toBe(false);
  });

  it('raison traduite, sinon le message du serveur, sinon le code', () => {
    expect(libelleRefus({ raison: 'DOUBLON_FICHIER', message: null })).toBe('En double dans le fichier');
    expect(libelleRefus({ raison: 'NOUVELLE_RAISON', message: 'Raison du serveur' })).toBe('Raison du serveur');
    expect(libelleRefus({ raison: 'NOUVELLE_RAISON', message: null })).toBe('NOUVELLE_RAISON');
  });
});

describe('Dialogue d’import CSV', () => {
  let service: { importer: ReturnType<typeof vi.fn> };
  let exports: { enregistrer: ReturnType<typeof vi.fn> };
  let reference: { close: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<DialogueImport>;

  const RAPPORT: RapportImportResponse = {
    acceptees: 2,
    refusees: [
      { ligne: 3, courriel: 'pas-un-courriel', raison: 'COURRIEL_INVALIDE', message: 'Courriel invalide.' },
      { ligne: 5, courriel: 'a@exemple.com', raison: 'DOUBLON_FICHIER', message: null },
    ],
  };

  async function afficher(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DialogueImport],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { sondageId: 7 } },
        { provide: MatDialogRef, useValue: reference },
        { provide: InvitationService, useValue: service },
        { provide: ExportService, useValue: exports },
      ],
    });
    fixture = TestBed.createComponent(DialogueImport);
    return stable(fixture);
  }

  function choisirFichier(el: HTMLElement, fichier: File): void {
    const champ = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(champ, 'files', { value: [fichier], configurable: true });
    champ.dispatchEvent(new Event('change'));
  }

  beforeEach(() => {
    service = { importer: vi.fn(() => of(RAPPORT)) };
    exports = { enregistrer: vi.fn() };
    reference = { close: vi.fn() };
  });

  it('télécharge le modèle CSV', async () => {
    const el = await afficher();
    bouton(el, 'Télécharger le modèle CSV').click();
    expect(exports.enregistrer).toHaveBeenCalledWith({ nom: NOM_MODELE_CSV, contenu: expect.any(Blob) });
  });

  it('« Importer » désactivé sans fichier ; un fichier non CSV est refusé avant l’envoi', async () => {
    const el = await afficher();
    expect(bouton(el, 'Importer').disabled).toBe(true);
    choisirFichier(el, new File(['x'], 'invites.xlsx', { type: 'application/octet-stream' }));
    await stable(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Choisissez un fichier .csv.');
    expect(bouton(el, 'Importer').disabled).toBe(true);
  });

  it('fichier déposé dans la zone, puis rapport : acceptées, refusées avec ligne, courriel et raison', async () => {
    const el = await afficher();
    const fichier = new File(['courriel\na@exemple.com'], 'invites.csv', { type: 'text/csv' });
    const zone = el.querySelector<HTMLElement>('.zone-depot')!;
    const survol = new Event('dragover', { cancelable: true });
    zone.dispatchEvent(survol);
    await stable(fixture);
    expect(zone.classList).toContain('survol');
    const depot = Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: { files: [fichier] } });
    zone.dispatchEvent(depot);
    await stable(fixture);
    expect(depot.defaultPrevented).toBe(true);
    expect(texte(el)).toContain('invites.csv');

    bouton(el, 'Importer').click();
    await stable(fixture);
    expect(service.importer).toHaveBeenCalledWith(7, fichier);
    const rapport = el.querySelector<HTMLElement>('app-rapport-import [role="status"]')!;
    expect(texte(rapport)).toContain('2 lignes acceptées');
    expect(texte(rapport)).toContain('2 lignes refusées');
    const lignes = Array.from(rapport.querySelectorAll('tbody tr')).map((tr) => texte(tr as HTMLElement).trim());
    expect(lignes[0]).toContain('3');
    expect(lignes[0]).toContain('pas-un-courriel');
    expect(lignes[0]).toContain('Courriel invalide');
    expect(lignes[1]).toContain('En double dans le fichier');

    bouton(el, 'Fermer').click();
    expect(reference.close).toHaveBeenCalledWith(RAPPORT);
  });

  it('« Importer un autre fichier » revient au choix ; la fermeture rend encore le dernier rapport utile', async () => {
    const el = await afficher();
    choisirFichier(el, new File(['x'], 'a.csv'));
    await stable(fixture);
    bouton(el, 'Importer').click();
    await stable(fixture);
    bouton(el, 'Importer un autre fichier').click();
    await stable(fixture);
    expect(el.querySelector('.zone-depot')).not.toBeNull();
    expect(bouton(el, 'Importer').disabled).toBe(true);

    service.importer.mockReturnValue(of({ acceptees: 0, refusees: [] }));
    choisirFichier(el, new File(['x'], 'b.csv'));
    await stable(fixture);
    bouton(el, 'Importer').click();
    await stable(fixture);
    bouton(el, 'Fermer').click();
    expect(reference.close).toHaveBeenCalledWith(RAPPORT);
  });

  it('refus du serveur (IMPORT_TROP_GRAND) : message affiché, fichier gardé pour réessayer ; bouton bloqué pendant l’envoi', async () => {
    const reponse = new Subject<RapportImportResponse>();
    service.importer.mockReturnValue(reponse);
    const el = await afficher();
    choisirFichier(el, new File(['x'], 'gros.csv'));
    await stable(fixture);
    bouton(el, 'Importer').click();
    await stable(fixture);
    expect(bouton(el, 'Import…').disabled).toBe(true);
    reponse.error(new HttpErrorResponse({ status: 400, error: { code: 'IMPORT_TROP_GRAND', message: 'Le fichier dépasse 1000 lignes.' } }));
    await stable(fixture);
    expect(el.querySelector('app-message-erreur')?.textContent).toContain('Le fichier dépasse 1000 lignes.');
    expect(texte(el)).toContain('gros.csv');
    expect(bouton(el, 'Importer').disabled).toBe(false);
  });
});

describe('Dialogue « Reprendre la liste d’un autre sondage »', () => {
  let service: { reprendre: ReturnType<typeof vi.fn> };
  let sondages: { lister: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<DialogueReprise>;

  const page = (contenu: ReturnType<typeof sondageResumeDeTest>[], numero = 0, totalPages = 1) => ({
    contenu,
    page: numero,
    taille: 100,
    totalElements: contenu.length,
    totalPages,
  });

  async function afficher(versionsExclues: number[] = [7]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DialogueReprise],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { sondageId: 7, versionsExclues } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: InvitationService, useValue: service },
        { provide: SondageService, useValue: sondages },
      ],
    });
    fixture = TestBed.createComponent(DialogueReprise);
    return stable(fixture);
  }

  async function choisirSource(el: HTMLElement, titre: string): Promise<void> {
    el.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    await stable(fixture);
    const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find((o) => texte(o).includes(titre))!;
    option.click();
    await stable(fixture);
  }

  beforeEach(() => {
    service = { reprendre: vi.fn(() => of({ acceptees: 4, refusees: [
      { ligne: 1, courriel: 'deja@exemple.com', raison: 'DEJA_INVITE', message: null },
      { ligne: 2, courriel: 'autre@exemple.com', raison: 'DEJA_INVITE', message: null },
      { ligne: 3, courriel: 'trop@exemple.com', raison: 'LIMITE_INVITES', message: null },
    ] })) };
    sondages = {
      lister: vi.fn((filtre: { page: number }) =>
        of(
          filtre.page === 0
            ? page([sondageResumeDeTest({ id: 7, titre: 'Ce sondage' }), sondageResumeDeTest({ id: 12, titre: 'Enquête 2025', version: 2 })], 0, 2)
            : page([sondageResumeDeTest({ id: 8, titre: 'Ancienne version de celui-ci' }), sondageResumeDeTest({ id: 20, titre: 'Formation' })], 1, 2),
        ),
      ),
    };
  });

  it('sources : toutes les pages, une ligne par lignée, sauf ce sondage et ses versions', async () => {
    const el = await afficher([7, 8]);
    expect(sondages.lister).toHaveBeenCalledWith(expect.objectContaining({ derniereVersion: true, page: 0 }));
    expect(sondages.lister).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    el.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    await stable(fixture);
    const options = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).map((o) => texte(o));
    expect(options.length).toBe(2);
    expect(options[0]).toContain('Enquête 2025');
    expect(options[0]).toContain('Version 2');
    expect(options[1]).toContain('Formation');
  });

  it('« Reprendre la liste » désactivé tant qu’aucune source n’est choisie ; rapport : ajoutées, doublons ignorés à part, autres refus listés', async () => {
    const el = await afficher();
    expect(bouton(el, 'Reprendre la liste').disabled).toBe(true);
    await choisirSource(el, 'Formation');
    bouton(el, 'Reprendre la liste').click();
    await stable(fixture);
    expect(service.reprendre).toHaveBeenCalledWith(7, 20);
    const rapport = texte(el.querySelector<HTMLElement>('app-rapport-import')!);
    expect(rapport).toContain('4 personnes ajoutées');
    expect(rapport).toContain('2 personnes ignorées (déjà invitées)');
    expect(rapport).toContain('1 ligne refusée');
    expect(rapport).toContain('Limite de 10 000 invités atteinte');
    expect(rapport).not.toContain('deja@exemple.com');
    expect(bouton(el, 'Fermer')).toBeTruthy();
  });

  it('aucun autre sondage : message ; erreur de chargement : message d’erreur', async () => {
    sondages.lister.mockReturnValue(of(page([sondageResumeDeTest({ id: 7 })])));
    let el = await afficher();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Aucun autre sondage disponible.');

    TestBed.resetTestingModule();
    sondages.lister.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    el = await afficher();
    expect(el.querySelector('app-message-erreur')?.textContent?.trim()).not.toBe('');
    expect(el.querySelector('mat-select')).toBeNull();
  });

  it('refus du serveur : message affiché, la source reste choisie', async () => {
    service.reprendre.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'REPRISE_INVALIDE', message: 'Le sondage source doit être un autre sondage.' } })),
    );
    const el = await afficher();
    await choisirSource(el, 'Enquête 2025');
    bouton(el, 'Reprendre la liste').click();
    await stable(fixture);
    expect(texte(el)).toContain('Le sondage source doit être un autre sondage.');
    expect(bouton(el, 'Reprendre la liste').disabled).toBe(false);
  });
});

describe('Dialogue d’un invité', () => {
  let service: { ajouter: ReturnType<typeof vi.fn>; modifier: ReturnType<typeof vi.fn> };
  let reference: { close: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<DialogueInvite>;

  async function afficher(invitation?: ReturnType<typeof inviteDeTest>): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DialogueInvite],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { sondageId: 7, invitation } },
        { provide: MatDialogRef, useValue: reference },
        { provide: InvitationService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(DialogueInvite);
    return stable(fixture);
  }

  const champ = (el: HTMLElement, nom: string) => el.querySelector<HTMLInputElement>(`input[formcontrolname="${nom}"]`)!;
  const soumettre = async (el: HTMLElement) => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable(fixture);
  };

  beforeEach(() => {
    service = { ajouter: vi.fn((_id, i) => of(inviteDeTest({ id: 40, ...i }))), modifier: vi.fn((_id, invitationId, i) => of(inviteDeTest({ id: invitationId, ...i }))) };
    reference = { close: vi.fn() };
  });

  it('courriel obligatoire et valide : rien n’est envoyé, erreurs affichées', async () => {
    const el = await afficher();
    expect(texte(el)).toContain('Ajouter un invité');
    await soumettre(el);
    expect(texte(el)).toContain('Le courriel est obligatoire.');
    saisir(champ(el, 'courriel'), 'pas-un-courriel');
    await stable(fixture);
    expect(texte(el)).toContain('Courriel invalide.');
    await soumettre(el);
    expect(service.ajouter).not.toHaveBeenCalled();
  });

  it('ajout : champs nettoyés, vides envoyés à null, langue principale par défaut ; ferme avec l’invité', async () => {
    const el = await afficher();
    saisir(champ(el, 'courriel'), '  aminata@exemple.com ');
    saisir(champ(el, 'prenom'), ' Aminata ');
    saisir(champ(el, 'telephone'), '   ');
    await soumettre(el);
    expect(service.ajouter).toHaveBeenCalledWith(7, { courriel: 'aminata@exemple.com', prenom: 'Aminata', nom: null, telephone: null, langue: null });
    expect(reference.close).toHaveBeenCalledWith(expect.objectContaining({ id: 40, courriel: 'aminata@exemple.com' }));
  });

  it('modification : champs préremplis (langue comprise), PUT sur l’invité', async () => {
    const el = await afficher(inviteDeTest({ id: 9, prenom: 'Moussa', nom: 'Kane', courriel: 'moussa@exemple.com', telephone: '+222 1', langue: 'ar' }));
    expect(texte(el)).toContain('Modifier l’invité');
    expect(champ(el, 'prenom').value).toBe('Moussa');
    expect(texte(el.querySelector<HTMLElement>('mat-select')!)).toContain('Arabe');
    saisir(champ(el, 'nom'), 'Kane-Ba');
    await soumettre(el);
    expect(service.modifier).toHaveBeenCalledWith(7, 9, { courriel: 'moussa@exemple.com', prenom: 'Moussa', nom: 'Kane-Ba', telephone: '+222 1', langue: 'ar' });
    expect(reference.close).toHaveBeenCalled();
  });

  it('409 INVITE_EXISTANT : message du serveur, la boîte reste ouverte et le bouton se réactive', async () => {
    service.ajouter.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'INVITE_EXISTANT', message: 'Cette adresse est déjà invitée.' } })),
    );
    const el = await afficher();
    saisir(champ(el, 'courriel'), 'deja@exemple.com');
    await soumettre(el);
    expect(el.querySelector('app-message-erreur')?.textContent).toContain('Cette adresse est déjà invitée.');
    expect(reference.close).not.toHaveBeenCalled();
    expect(bouton(el, 'Ajouter').disabled).toBe(false);
  });
});
