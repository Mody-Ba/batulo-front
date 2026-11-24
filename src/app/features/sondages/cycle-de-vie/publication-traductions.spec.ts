import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { SondageService } from '../../../core/services/sondage.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../testing/donnees-test';
import { DialoguePublication } from './dialogue-publication/dialogue-publication';
import { manquantsParLangue } from './textes-manquants';

const REFUS = new HttpErrorResponse({
  status: 400,
  error: {
    code: 'TRADUCTIONS_INCOMPLETES',
    message: 'Traductions incomplètes : en (2), ar (1).',
    manquants: [
      { langue: 'en', cle: 'sondage.titre', source: 'Malnutrition' },
      { langue: 'ar', cle: 'question.12.libelle', source: 'Âge ?' },
      { langue: 'en', cle: 'option.40.libelle', source: 'Moins d’un an' },
    ],
  },
});

describe('Publication refusée : traductions incomplètes', () => {
  let fixture: ComponentFixture<DialoguePublication>;
  const sondage = sondageDeTest({ id: 7, sections: [sectionDeTest({ questions: [questionDeTest()] })] });

  it('textes manquants groupés par langue, dans l’ordre reçu ; rien pour une autre erreur', () => {
    expect(manquantsParLangue(REFUS)?.map((g) => [g.langue, g.textes.map((t) => t.cle)])).toEqual([
      ['en', ['sondage.titre', 'option.40.libelle']],
      ['ar', ['question.12.libelle']],
    ]);
    expect(manquantsParLangue(new HttpErrorResponse({ status: 400, error: { code: 'SONDAGE_INCOMPLET', message: 'x' } }))).toBeNull();
  });

  it('liste des textes manquants et lien vers l’écran de traduction de chaque langue (textes manquants seulement)', async () => {
    TestBed.configureTestingModule({
      imports: [DialoguePublication],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { sondage, mode: 'publier' } },
        { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
        { provide: SondageService, useValue: { publier: vi.fn(() => throwError(() => REFUS)), modifier: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(DialoguePublication);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const liste = element.querySelector('app-textes-manquants [role="alert"]')!;
    expect(liste.textContent).toContain('Publication impossible : des textes ne sont pas encore traduits.');
    expect(liste.textContent).toContain('Anglais');
    expect(liste.textContent).toContain('2 textes manquants');
    expect(liste.textContent).toContain('Moins d’un an');
    expect(liste.textContent).toContain('1 texte manquant');
    const liens = Array.from(liste.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(liens).toEqual(['/sondages/7/traductions/en?manquants=true', '/sondages/7/traductions/ar?manquants=true']);
    // Pas de message générique en plus de la liste.
    expect(element.querySelector('app-message-erreur [role="alert"]')).toBeNull();
  });
});
