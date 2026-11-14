import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { SondageResponse } from '../../../../core/models/sondage.model';
import { SondageService } from '../../../../core/services/sondage.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { versLocal } from '../dates-sondage';
import { DialoguePublication, DonneesPublication } from './dialogue-publication';

describe('DialoguePublication', () => {
  let fixture: ComponentFixture<DialoguePublication>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let reference: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  const complet = sondageDeTest({ sections: [sectionDeTest({ questions: [questionDeTest()] })] });

  function dans(heures: number): string {
    return versLocal(new Date(Date.now() + heures * 3_600_000).toISOString());
  }

  function creer(donnees: DonneesPublication): HTMLElement {
    TestBed.configureTestingModule({
      imports: [DialoguePublication],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: donnees },
        { provide: MatDialogRef, useValue: reference },
        { provide: SondageService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(DialoguePublication);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function saisir(element: HTMLElement, nom: string, valeur: string): void {
    const champ = element.querySelector<HTMLInputElement>(`[formcontrolname="${nom}"]`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function cocher(element: HTMLElement, nom: string): void {
    element.querySelector<HTMLInputElement>(`mat-checkbox[formcontrolname="${nom}"] input`)!.click();
    fixture.detectChanges();
  }

  function choisir(element: HTMLElement, texte: string): void {
    Array.from(element.querySelectorAll('mat-radio-button'))
      .find((r) => r.textContent?.includes(texte))!
      .querySelector('input')!
      .click();
    fixture.detectChanges();
  }

  function envoyer(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    reference = { close: vi.fn(), disableClose: false };
    service = {
      publier: vi.fn((_id: number, _dates: unknown) => of(sondageDeTest({ publie: true, statut: 'EN_COURS' }))),
      modifier: vi.fn(() => of(complet)),
      modifierDates: vi.fn(() => of(complet)),
    };
  });

  it('rappelle que le contenu sera figé ; publication immédiate sans fermeture', () => {
    const element = creer({ sondage: complet, mode: 'publier' });
    expect(element.textContent).toContain('Le contenu ne sera plus modifiable');
    envoyer(element);
    expect(service['modifier']).not.toHaveBeenCalled();
    expect(service['publier']).toHaveBeenCalledWith(3, { datePublication: null, dateFermeture: null });
    expect(reference.close).toHaveBeenCalled();
  });

  it('planifiée : date future obligatoire ; fermeture après l’ouverture', () => {
    const element = creer({ sondage: complet, mode: 'publier' });
    choisir(element, 'À une date planifiée');
    envoyer(element);
    expect(element.textContent).toContain('Indiquez la date et l’heure d’ouverture.');

    saisir(element, 'dateOuverture', dans(-2));
    envoyer(element);
    expect(element.textContent).toContain('L’ouverture planifiée doit être dans le futur.');

    saisir(element, 'dateOuverture', dans(48));
    cocher(element, 'avecFermeture');
    saisir(element, 'dateFermeture', dans(24));
    envoyer(element);
    expect(element.textContent).toContain('La fermeture doit venir après l’ouverture et après maintenant.');
    expect(service['publier']).not.toHaveBeenCalled();

    saisir(element, 'dateFermeture', dans(72));
    envoyer(element);
    const dates = service['publier'].mock.calls[0][1] as { datePublication: string; dateFermeture: string };
    expect(new Date(dates.datePublication).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(dates.dateFermeture).getTime()).toBeGreaterThan(new Date(dates.datePublication).getTime());
  });

  it('« une réponse par appareil » changé : enregistré dans le brouillon juste avant la publication', () => {
    const element = creer({ sondage: complet, mode: 'publier' });
    cocher(element, 'reponseUnique');
    envoyer(element);
    expect(service['modifier']).toHaveBeenCalledWith(3, {
      titre: 'Satisfaction 2026',
      description: null,
      reponseUnique: false,
    });
    expect(service['publier']).toHaveBeenCalled();
  });

  it('sondage incomplet : explication, publication impossible', () => {
    const element = creer({
      sondage: sondageDeTest({ sections: [sectionDeTest({ titre: 'Profil', questions: [] })] }),
      mode: 'publier',
    });
    expect(element.textContent).toContain('La section « Profil » n’a aucune question.');
    envoyer(element);
    expect(service['publier']).not.toHaveBeenCalled();
  });

  it('refus du serveur : message en haut du dialogue, focus dessus, la boîte reste ouverte', async () => {
    service['publier'].mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { code: 'DATES_INVALIDES', message: 'Dates refusées.' } }),
      ),
    );
    const element = creer({ sondage: complet, mode: 'publier' });
    envoyer(element);
    await fixture.whenStable();
    const zone = element.querySelector<HTMLElement>('.zone-erreur')!;
    // Avant les rubriques du formulaire : visible sans faire défiler.
    expect(zone.compareDocumentPosition(element.querySelector('fieldset')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(zone.textContent).toContain('Le sondage n’a pas été publié');
    expect(zone.textContent).toContain('Dates refusées.');
    expect(zone.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(zone);
    expect(reference.close).not.toHaveBeenCalled();
    expect(reference.disableClose).toBe(false);
  });

  it('serveur injoignable : un message l’explique (jamais d’échec silencieux)', () => {
    service['publier'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const element = creer({ sondage: complet, mode: 'publier' });
    envoyer(element);
    expect(element.querySelector('.zone-erreur')!.textContent).toContain('Le sondage n’a pas été publié');
    expect(element.querySelector('.zone-erreur [role="alert"]')).not.toBeNull();
  });

  it('échec du réglage « une réponse par appareil » : rien n’est publié, message propre à cette étape', () => {
    service['modifier'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'ACCES_REFUSE', message: 'Refusé.' } })),
    );
    const element = creer({ sondage: complet, mode: 'publier' });
    cocher(element, 'reponseUnique');
    envoyer(element);
    expect(service['publier']).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Le réglage « une réponse par appareil » n’a pas été enregistré : rien n’a été publié');
  });

  it('réglage enregistré puis publication refusée : l’éditeur est prévenu ; un nouvel essai ne renvoie pas le réglage', () => {
    const brouillon = { ...complet, reponseUnique: false };
    service['modifier'].mockReturnValue(of(brouillon));
    service['publier']
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of({ ...brouillon, publie: true, statut: 'EN_COURS' }));
    const surReglageEnregistre = vi.fn();
    const element = creer({ sondage: complet, mode: 'publier', surReglageEnregistre });
    cocher(element, 'reponseUnique');
    envoyer(element);
    expect(surReglageEnregistre).toHaveBeenCalledWith(brouillon);
    envoyer(element);
    expect(service['modifier']).toHaveBeenCalledTimes(1);
    expect(service['publier']).toHaveBeenCalledTimes(2);
    expect(reference.close).toHaveBeenCalled();
  });

  it('dates d’un sondage ouvert : seule la fermeture se règle ; décochée, plus de fermeture prévue', () => {
    const ouvert: SondageResponse = sondageDeTest({
      publie: true,
      statut: 'EN_COURS',
      datePublication: '2026-11-01T12:00:00Z',
      dateFermeture: '2030-01-01T12:00:00Z',
    });
    const element = creer({ sondage: ouvert, mode: 'dates' });
    expect(element.textContent).toContain('l’ouverture ne se modifie plus');
    expect(element.querySelector('[formcontrolname="reponseUnique"]')).toBeNull();
    cocher(element, 'avecFermeture');
    envoyer(element);
    expect(service['modifierDates']).toHaveBeenCalledWith(3, { dateFermeture: null });
  });

  it('dates d’un sondage planifié : ouverture inchangée renvoyée à l’identique', () => {
    const planifie = sondageDeTest({ publie: true, statut: 'NON_COMMENCE', datePublication: '2030-03-01T09:30:27.000Z' });
    const element = creer({ sondage: planifie, mode: 'dates' });
    envoyer(element);
    expect(service['modifierDates']).toHaveBeenCalledWith(3, {
      dateFermeture: null,
      datePublication: '2030-03-01T09:30:27.000Z',
    });
  });
});
