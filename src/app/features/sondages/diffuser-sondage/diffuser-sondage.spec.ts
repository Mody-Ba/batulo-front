import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { SondageService } from '../../../core/services/sondage.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { DiffuserSondage } from './diffuser-sondage';
import { lienSms, lienWhatsApp } from './partage';

describe('DiffuserSondage', () => {
  let fixture: ComponentFixture<DiffuserSondage>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let clipboard: { copy: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(DiffuserSondage);
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:qr');
    URL.revokeObjectURL = vi.fn();
    service = {
      lien: vi.fn(() => of({ jeton: 'Ab3x', url: 'http://localhost:4200/s/Ab3x' })),
      qrCode: vi.fn(() => of(new Blob(['png'], { type: 'image/png' }))),
      detail: vi.fn(() => of(sondageDeTest({ id: 3, titre: 'Santé « 2026 » & nutrition', publie: true, statut: 'EN_COURS' }))),
    };
    clipboard = { copy: vi.fn(() => true) };
    snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DiffuserSondage],
      providers: [
        provideRouter([]),
        { provide: SondageService, useValue: service },
        { provide: Clipboard, useValue: clipboard },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
  });

  it('affiche le lien et le copie', async () => {
    const element = await creer();
    expect(element.querySelector<HTMLInputElement>('input[readonly]')!.value).toBe('http://localhost:4200/s/Ab3x');
    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Copier'))!
      .click();
    expect(clipboard.copy).toHaveBeenCalledWith('http://localhost:4200/s/Ab3x');
    expect(snackBar.open).toHaveBeenCalledWith('Lien copié.', 'Fermer', expect.anything());
  });

  it('QR code lu en PNG (300 px par défaut), affiché et téléchargeable ; autre taille rechargée', async () => {
    const element = await creer();
    expect(service['qrCode']).toHaveBeenCalledWith(3, 300);
    expect(element.querySelector('img')!.getAttribute('src')).toBe('blob:qr');
    const telecharger = Array.from(element.querySelectorAll('a')).find((a) => a.textContent?.includes('Télécharger'))!;
    expect(telecharger.getAttribute('href')).toBe('blob:qr');
    expect(telecharger.getAttribute('download')).toBe('qr-code-sondage-3-300px.png');

    Array.from(element.querySelectorAll<HTMLButtonElement>('mat-button-toggle button'))
      .find((b) => b.textContent?.includes('1000'))!
      .click();
    fixture.detectChanges();
    expect(service['qrCode']).toHaveBeenLastCalledWith(3, 1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qr');
  });

  it('jamais publié (409 SONDAGE_BROUILLON) : explication, pas de QR code', async () => {
    service['lien'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'SONDAGE_BROUILLON', message: 'x' } })),
    );
    const element = await creer();
    expect(element.textContent).toContain('Ce sondage n’a jamais été publié');
    expect(service['qrCode']).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  describe('partage par WhatsApp et SMS', () => {
    const lien = (element: HTMLElement, classe: string) => element.querySelector<HTMLAnchorElement>(`app-partage-message a.${classe}`);
    const MESSAGE = 'Bonjour, merci de répondre à notre enquête « Santé « 2026 » & nutrition » : http://localhost:4200/s/Ab3x';

    it('sondage publié : message prérempli (titre et lien), WhatsApp dans un nouvel onglet (noopener), SMS', async () => {
      const element = await creer();
      expect(element.querySelector<HTMLTextAreaElement>('app-partage-message textarea')!.value).toBe(MESSAGE);
      const whatsapp = lien(element, 'whatsapp')!;
      expect(whatsapp.getAttribute('href')).toBe(lienWhatsApp(MESSAGE));
      expect(whatsapp.getAttribute('target')).toBe('_blank');
      expect(whatsapp.getAttribute('rel')).toBe('noopener noreferrer');
      expect(whatsapp.getAttribute('aria-label')).toBe('Partager par WhatsApp (nouvel onglet)');
      const sms = lien(element, 'sms')!;
      expect(sms.getAttribute('href')).toBe(lienSms(MESSAGE));
      expect(sms.getAttribute('target')).toBeNull();
    });

    it('message modifié : les deux liens suivent ; vide : liens désactivés ; « Message par défaut » le remet', async () => {
      const element = await creer();
      const zone = element.querySelector<HTMLTextAreaElement>('app-partage-message textarea')!;
      zone.value = 'Répondez vite : http://localhost:4200/s/Ab3x';
      zone.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(lien(element, 'whatsapp')!.getAttribute('href')).toBe(lienWhatsApp('Répondez vite : http://localhost:4200/s/Ab3x'));
      expect(lien(element, 'sms')!.getAttribute('href')).toBe(lienSms('Répondez vite : http://localhost:4200/s/Ab3x'));

      zone.value = '   ';
      zone.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(lien(element, 'whatsapp')!.getAttribute('href')).toBeNull();
      expect(lien(element, 'whatsapp')!.getAttribute('aria-disabled')).toBe('true');
      expect(lien(element, 'sms')!.getAttribute('href')).toBeNull();
      expect(element.textContent).toContain('Écrivez un message pour pouvoir le partager.');

      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Message par défaut'))!.click();
      fixture.detectChanges();
      expect(zone.value).toBe(MESSAGE);
    });

    it('brouillon jamais publié (409 SONDAGE_BROUILLON) : ni message ni boutons', async () => {
      service['lien'].mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'SONDAGE_BROUILLON', message: 'x' } })),
      );
      service['detail'].mockReturnValue(of(sondageDeTest({ id: 3, publie: false })));
      const element = await creer();
      expect(element.querySelector('app-partage-message')).toBeNull();
      expect(lien(element, 'whatsapp')).toBeNull();
      expect(element.textContent).toContain('Pas encore de lien');
    });

    it('sondage terminé : boutons masqués, phrase d’explication ; planifié : boutons gardés', async () => {
      service['detail'].mockReturnValue(of(sondageDeTest({ id: 3, publie: true, statut: 'TERMINE' })));
      let element = await creer();
      expect(element.querySelector('app-partage-message')).toBeNull();
      expect(element.textContent).toContain('Ce sondage est terminé : le lien affiche qu’il est fermé.');

      service['detail'].mockReturnValue(of(sondageDeTest({ id: 3, publie: true, statut: 'NON_COMMENCE' })));
      element = await creer();
      expect(lien(element, 'whatsapp')).not.toBeNull();
    });

    it('titre reçu après une saisie : le message modifié n’est pas écrasé ; non modifié, il prend le titre', async () => {
      const titre = new Subject<ReturnType<typeof sondageDeTest>>();
      service['detail'].mockReturnValue(titre);
      const element = await creer();
      const zone = element.querySelector<HTMLTextAreaElement>('app-partage-message textarea')!;
      expect(zone.value).toBe('Bonjour, merci de répondre à notre enquête : http://localhost:4200/s/Ab3x');
      zone.value = 'Mon texte : http://localhost:4200/s/Ab3x';
      zone.dispatchEvent(new Event('input'));
      titre.next(sondageDeTest({ id: 3, titre: 'Santé', publie: true, statut: 'EN_COURS' }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(zone.value).toBe('Mon texte : http://localhost:4200/s/Ab3x');
    });

    it('titre illisible (erreur sur le sondage) : partage possible quand même, sans titre', async () => {
      service['detail'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const element = await creer();
      expect(element.querySelector<HTMLTextAreaElement>('app-partage-message textarea')!.value).toBe(
        'Bonjour, merci de répondre à notre enquête : http://localhost:4200/s/Ab3x',
      );
    });
  });
});
