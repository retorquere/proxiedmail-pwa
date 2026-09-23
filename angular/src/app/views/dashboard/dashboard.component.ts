import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardBodyComponent, CardComponent, ColComponent, RowComponent, ButtonDirective, FormControlDirective, FormSelectDirective, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ProxyApiService, Binding } from '../../proxy-api.service';

@Component({ templateUrl: 'dashboard.component.html', styleUrls: ['dashboard.component.scss'], imports: [CommonModule, FormsModule, CardComponent, CardBodyComponent, ColComponent, RowComponent, ButtonDirective, FormControlDirective, FormSelectDirective, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, IconDirective] })
export class DashboardComponent implements OnInit {
  private readonly api = inject(ProxyApiService);
  readonly bindings = signal<Binding[]>([]); readonly domains = signal<string[]>([]); readonly emails = signal<string[]>([]); readonly available = signal(0); readonly twoFactor = signal(false); readonly query = signal(''); readonly heroVisible = signal(localStorage.getItem('proxiedmail.hideDashboardHero') !== 'true'); readonly alias = signal(''); readonly domain = signal(''); readonly forwarding = signal(''); readonly forwardingQuery = signal(''); readonly forwardingOpen = signal(false); readonly editBinding = signal<Binding | null>(null); readonly editForwarding = signal('');
  get filtered() { const query = this.query().toLowerCase(); return this.bindings().filter((binding) => `${binding.address} ${binding.description}`.toLowerCase().includes(query)); }
  get filteredEmails() { const query = this.forwardingQuery().trim().toLowerCase(); return this.emails().filter((email) => email.toLowerCase().includes(query)); }
  twoFactorLabel() { return this.twoFactor() ? $localize`On` : $localize`Off`; }
  fallbackDescription() { return $localize`Private forwarding address`; }
  ngOnInit() { this.refresh(); }
  async refresh() { const data = await this.api.dashboard(); this.bindings.set(data.bindings); this.domains.set(data.domains); this.emails.set(data.emails); this.available.set(data.available); this.twoFactor.set(data.twoFactor); if (!this.domain() && data.domains.length) this.domain.set(data.domains[0]); }
  create() { if (!this.alias().trim() || !this.forwarding().trim()) return; this.api.create(this.alias(), this.domain(), this.forwarding()).subscribe({ next: () => { this.alias.set(''); this.forwarding.set(''); this.forwardingQuery.set(''); this.refresh(); } }); }
  onForwardingInput(value: string) { this.forwardingQuery.set(value); this.forwarding.set(''); this.forwardingOpen.set(true); }
  openForwarding() { this.forwardingOpen.set(true); }
  closeForwarding() { this.forwardingOpen.set(false); }
  selectForwarding(email?: string) { if (!email) return; this.forwarding.set(email); this.forwardingQuery.set(email); this.forwardingOpen.set(false); }
  generateAlias() { const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; this.alias.set(Array.from({ length: 10 }, () => characters[Math.floor(Math.random() * characters.length)]).join('')); }
  beginEdit(binding: Binding) { this.editBinding.set(binding); this.editForwarding.set(binding.recipients.join(', ')); }
  saveEdit() { const binding = this.editBinding(); if (!binding) return; this.api.update(binding, this.editForwarding()).subscribe({ next: () => { this.editBinding.set(null); this.refresh(); } }); }
  setRecipients(binding: Binding, enabled: boolean) { Promise.all(binding.recipients.map((address) => this.api.setRecipient(binding, address, enabled).toPromise())).then(() => this.refresh()); }
  dismissHero() { this.heroVisible.set(false); localStorage.setItem('proxiedmail.hideDashboardHero', 'true'); }
  isEnabled(binding: Binding) { return Object.values(binding.states).some(Boolean); }
}
