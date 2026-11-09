import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Racine : les pages connectées ont leur propre mise en page (layout/mise-en-page). */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
