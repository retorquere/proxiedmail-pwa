import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  FormControlDirective,
  FormLabelDirective,
} from '@coreui/angular';
import { ProxyApiService } from '../../../proxy-api.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [
    CommonModule,
    ButtonDirective,
    CardBodyComponent,
    CardComponent,
    FormControlDirective,
    FormLabelDirective,
    RouterLink,
    FormsModule
  ]
})
export class LoginComponent {
  private readonly api = inject(ProxyApiService);
  private readonly router = inject(Router);
  readonly email = signal(''); readonly password = signal(''); readonly busy = signal(false); readonly error = signal('');
  busyLabel() { return $localize`Signing in...`; }
  signInLabel() { return $localize`Sign in`; }
  async submit() { this.busy.set(true); this.error.set(''); try { await this.api.login(this.email(), this.password()); await this.router.navigateByUrl('/dashboard'); } catch (error) { this.error.set(error instanceof Error ? error.message : $localize`Sign in failed.`); } this.busy.set(false); }
}
