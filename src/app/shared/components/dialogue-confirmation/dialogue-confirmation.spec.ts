import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DialogueConfirmation, DonneesConfirmation, saisieConforme } from './dialogue-confirmation';

describe('DialogueConfirmation', () => {
  function creer(donnees: DonneesConfirmation): HTMLElement {
    TestBed.configureTestingModule({
      imports: [DialogueConfirmation],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: donnees },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(DialogueConfirmation);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function boutonAction(element: HTMLElement, libelle: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(libelle))!;
  }

  it('saisie conforme : espaces ignorés, majuscules respectées', () => {
    expect(saisieConforme('  Entreprise SA ', 'Entreprise SA')).toBe(true);
    expect(saisieConforme('entreprise sa', 'Entreprise SA')).toBe(false);
    expect(saisieConforme('', 'Entreprise SA')).toBe(false);
  });

  it('sans saisie attendue : le bouton est actif', () => {
    const element = creer({ titre: 'T', message: 'M', action: 'Désactiver' });
    expect(element.querySelector('input')).toBeNull();
    expect(boutonAction(element, 'Désactiver').disabled).toBe(false);
  });

  it('avec saisie attendue : le bouton s’active quand le nom est tapé à l’identique', async () => {
    const element = creer({ titre: 'T', message: 'M', action: 'Supprimer', saisieAttendue: 'Entreprise SA' });
    const bouton = boutonAction(element, 'Supprimer');
    expect(bouton.disabled).toBe(true);

    const champ = element.querySelector('input')!;
    champ.value = 'Entreprise S';
    champ.dispatchEvent(new Event('input'));
    TestBed.tick();
    expect(bouton.disabled).toBe(true);

    champ.value = 'Entreprise SA';
    champ.dispatchEvent(new Event('input'));
    TestBed.tick();
    expect(bouton.disabled).toBe(false);
  });
});
