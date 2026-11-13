import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FormulaireResponse } from '../../../core/models/sondage.model';
import { MESSAGE_LECTURE_SEULE } from '../../../core/services/auth.service';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { MESSAGE_SANS_PERMISSION } from '../droits-sondage';
import { CreationSondage } from './creation-sondage';

const MODELE: FormulaireResponse = {
  id: 40,
  titre: 'Enquête agricole',
  estModele: true,
  statut: 'TERMINE',
  version: 2,
  nombreQuestions: 12,
  dateCreation: '2026-01-01T12:00:00Z',
  dateModification: '2026-06-01T12:00:00Z',
};

describe('CreationSondage', () => {
  let fixture: ComponentFixture<CreationSondage>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  const role = signal<'ADMIN' | 'GESTIONNAIRE'>('ADMIN');
  const utilisateur = signal({ id: 1, peutCreerSondages: true });
  const lectureSeule = signal(false);

  let naviguer: ReturnType<typeof vi.spyOn>;

  async function creer(): Promise<HTMLElement> {
    naviguer ??= vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CreationSondage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function saisir(element: HTMLElement, nom: string, valeur: string): void {
    const champ = element.querySelector<HTMLInputElement>(`[formcontrolname="${nom}"]`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  }

  function envoyer(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  async function passerEnModeSource(element: HTMLElement): Promise<void> {
    Array.from(element.querySelectorAll<HTMLButtonElement>('mat-button-toggle button'))
      .find((b) => b.textContent?.includes('À partir d’un formulaire'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    naviguer = undefined as never;
    role.set('ADMIN');
    utilisateur.set({ id: 1, peutCreerSondages: true });
    lectureSeule.set(false);
    service = {
      creer: vi.fn(() => of(sondageDeTest({ id: 77 }))),
      formulaires: vi.fn(() => of({ contenu: [MODELE], page: 0, taille: 10, totalElements: 1, totalPages: 1 })),
    };
    TestBed.configureTestingModule({
      imports: [CreationSondage],
      providers: [
        provideRouter([]),
        { provide: SondageService, useValue: service },
        { provide: AuthService, useValue: { role, utilisateur, lectureSeule } },
      ],
    });
  });

  it('sondage vide : titre, description, réponse unique, puis ouverture de l’éditeur', async () => {
    const element = await creer();
    saisir(element, 'titre', '  Satisfaction 2026  ');
    saisir(element, 'description', 'Trois minutes');
    envoyer(element);
    expect(service['creer']).toHaveBeenCalledWith({
      titre: 'Satisfaction 2026',
      description: 'Trois minutes',
      reponseUnique: true,
    });
    expect(naviguer).toHaveBeenCalledWith(['/sondages', 77, 'modifier']);
  });

  it('titre obligatoire : rien n’est envoyé', async () => {
    const element = await creer();
    saisir(element, 'titre', '   ');
    envoyer(element);
    expect(service['creer']).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Le titre est obligatoire.');
  });

  it('à partir d’un formulaire : liste, filtre « Modèles seulement », titre proposé, source envoyée', async () => {
    const element = await creer();
    await passerEnModeSource(element);
    expect(service['formulaires']).toHaveBeenLastCalledWith(false, 0, 10);
    expect(element.textContent).toContain('Enquête agricole');
    expect(element.textContent).toContain('12 questions');

    element.querySelector<HTMLButtonElement>('app-choix-formulaire mat-slide-toggle button')!.click();
    await fixture.whenStable();
    expect(service['formulaires']).toHaveBeenLastCalledWith(true, 0, 10);
    fixture.detectChanges();

    element.querySelector<HTMLInputElement>('app-choix-formulaire mat-radio-button input')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('[formcontrolname="titre"]')!.value).toBe(
      'Enquête agricole (copie)',
    );
    expect(element.querySelector('mat-checkbox')).toBeNull();

    envoyer(element);
    expect(service['creer']).toHaveBeenCalledWith({
      titre: 'Enquête agricole (copie)',
      description: null,
      sondageSourceId: 40,
    });
  });

  it('à partir d’un formulaire, sans en choisir : message et rien n’est envoyé', async () => {
    const element = await creer();
    await passerEnModeSource(element);
    saisir(element, 'titre', 'Copie');
    envoyer(element);
    expect(service['creer']).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Choisissez le formulaire à réutiliser.');
  });

  it('refus du serveur : message affiché, la saisie est gardée', async () => {
    service['creer'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { code: 'PERMISSION_SONDAGES_REQUISE', message: 'Votre admin ne vous a pas donné la permission.' },
          }),
      ),
    );
    const element = await creer();
    saisir(element, 'titre', 'Mon sondage');
    envoyer(element);
    expect(element.textContent).toContain('Votre admin ne vous a pas donné la permission.');
    expect(element.querySelector<HTMLInputElement>('[formcontrolname="titre"]')!.value).toBe('Mon sondage');
  });

  it('gestionnaire sans permission, ou abonnement expiré : explication à la place du formulaire', async () => {
    role.set('GESTIONNAIRE');
    utilisateur.set({ id: 1, peutCreerSondages: false });
    let element = await creer();
    expect(element.textContent).toContain(MESSAGE_SANS_PERMISSION);
    expect(element.querySelector('form')).toBeNull();

    role.set('ADMIN');
    lectureSeule.set(true);
    element = await creer();
    expect(element.textContent).toContain(MESSAGE_LECTURE_SEULE);
  });
});
