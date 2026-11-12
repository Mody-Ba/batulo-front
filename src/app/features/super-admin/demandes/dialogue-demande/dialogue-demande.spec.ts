import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DemandeAbonnementResponse } from '../../../../core/models/demande-abonnement.model';
import { DemandeAbonnementService } from '../../../../core/services/demande-abonnement.service';
import { demandeDeTest } from '../../../../testing/donnees-test';
import { DialogueDemande } from './dialogue-demande';

describe('DialogueDemande', () => {
  let fixture: ComponentFixture<DialogueDemande>;
  let traiter: ReturnType<typeof vi.fn>;
  let reference: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

  function creer(demande: DemandeAbonnementResponse): HTMLElement {
    TestBed.configureTestingModule({
      imports: [DialogueDemande],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { demande } },
        { provide: MatDialogRef, useValue: reference },
        { provide: DemandeAbonnementService, useValue: { traiter } },
      ],
    });
    fixture = TestBed.createComponent(DialogueDemande);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function choisir(element: HTMLElement, libelle: string): void {
    const radio = Array.from(element.querySelectorAll('mat-radio-button')).find((r) =>
      r.textContent?.includes(libelle),
    )!;
    radio.querySelector('input')!.click();
    fixture.detectChanges();
  }

  function saisir(element: HTMLElement, texte: string): void {
    const champ = element.querySelector('textarea')!;
    champ.value = texte;
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function envoyer(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    traiter = vi.fn();
    reference = { close: vi.fn(), disableClose: false };
  });

  it('demande traitée : réponse affichée, pas de formulaire', () => {
    const element = creer(
      demandeDeTest({ statut: 'REFUSEE', reponse: 'Pas pour le moment.', traiteeParNom: 'Batulo' }),
    );
    expect(element.textContent).toContain('Pas pour le moment.');
    expect(element.textContent).toContain('Refusée par Batulo');
    expect(element.querySelector('mat-radio-group')).toBeNull();
  });

  it('exige un choix explicite, puis envoie la décision et le message', () => {
    const traitee = demandeDeTest({ statut: 'TRAITEE', reponse: 'D’accord' });
    traiter.mockReturnValue(of(traitee));
    const element = creer(demandeDeTest());

    envoyer(element);
    expect(traiter).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Choisissez d’accepter ou de refuser la demande.');

    choisir(element, 'Accepter');
    saisir(element, '  D’accord  ');
    envoyer(element);
    expect(traiter).toHaveBeenCalledWith(11, { statut: 'TRAITEE', reponse: 'D’accord' });
    expect(reference.close).toHaveBeenCalledWith(traitee);
  });

  it('acceptation sans message : envoyé comme null', () => {
    traiter.mockReturnValue(of(demandeDeTest({ statut: 'TRAITEE' })));
    const element = creer(demandeDeTest());
    choisir(element, 'Accepter');
    envoyer(element);
    expect(traiter).toHaveBeenCalledWith(11, { statut: 'TRAITEE', reponse: null });
  });

  it('refus : message obligatoire (des espaces ne suffisent pas)', () => {
    traiter.mockReturnValue(of(demandeDeTest({ statut: 'REFUSEE' })));
    const element = creer(demandeDeTest());
    choisir(element, 'Refuser');
    expect(element.textContent).toContain('Obligatoire pour un refus');

    saisir(element, '   ');
    envoyer(element);
    expect(traiter).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Expliquez à l’admin pourquoi sa demande est refusée.');

    saisir(element, 'Pas avant la fin du contrat.');
    envoyer(element);
    expect(traiter).toHaveBeenCalledWith(11, { statut: 'REFUSEE', reponse: 'Pas avant la fin du contrat.' });
  });

  it('repasser de Refuser à Accepter rend le message facultatif', () => {
    traiter.mockReturnValue(of(demandeDeTest({ statut: 'TRAITEE' })));
    const element = creer(demandeDeTest());
    choisir(element, 'Refuser');
    choisir(element, 'Accepter');
    envoyer(element);
    expect(traiter).toHaveBeenCalledWith(11, { statut: 'TRAITEE', reponse: null });
  });

  it('déjà traitée par un autre super admin : message, puis « Fermer » demande de relire la liste', () => {
    traiter.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'DEMANDE_DEJA_TRAITEE', message: 'Cette demande a déjà été traitée.' },
          }),
      ),
    );
    const element = creer(demandeDeTest());
    choisir(element, 'Refuser');
    saisir(element, 'Non');
    envoyer(element);

    expect(element.textContent).toContain('Cette demande a déjà été traitée.');
    expect(element.querySelector('mat-radio-group')).toBeNull();
    expect(reference.disableClose).toBe(true);
    const fermer = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Fermer'))!;
    fermer.click();
    expect(reference.close).toHaveBeenCalledWith('recharger');
  });
});
