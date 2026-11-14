import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SondageService } from '../../../core/services/sondage.service';
import { DiffuserSondage } from './diffuser-sondage';

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
});
