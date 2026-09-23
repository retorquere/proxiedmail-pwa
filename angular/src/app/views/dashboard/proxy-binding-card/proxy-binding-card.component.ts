import { CommonModule } from '@angular/common'
import { Component, inject, input, output, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ButtonDirective, CardBodyComponent, CardComponent, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, FormControlDirective } from '@coreui/angular'
import { IconDirective } from '@coreui/icons-angular'
import { Binding, PasswordPreferences, ProxyApiService, ProxyContact } from '../../../proxy-api.service'

@Component({
  selector: 'app-proxy-binding-card',
  templateUrl: './proxy-binding-card.component.html',
  styleUrls: ['./proxy-binding-card.component.scss'],
  imports: [CommonModule, FormsModule, ButtonDirective, CardBodyComponent, CardComponent, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, FormControlDirective, IconDirective],
})
export class ProxyBindingCardComponent {
  private readonly api = inject(ProxyApiService)
  readonly binding = input.required<Binding>()
  readonly emails = input.required<string[]>()
  readonly passwordPreferences = input.required<PasswordPreferences>()
  readonly changed = output<void>()
  readonly editing = signal(false)
  readonly editDescription = signal('')
  readonly editRecipients = signal<string[]>([])
  readonly editRecipientQuery = signal('')
  readonly editRecipientOpen = signal(false)
  readonly editCallbackUrl = signal('')
  readonly editUsedOn = signal('')
  readonly editSitePassword = signal('')
  readonly advancedSettingsOpen = signal(false)
  readonly saving = signal(false)
  readonly deleteConfirmationOpen = signal(false)
  readonly deleting = signal(false)
  readonly contacts = signal<ProxyContact[]>([])
  readonly contactsOpen = signal(false)
  readonly contactTarget = signal('')
  readonly contactsLoading = signal(false)
  readonly contactCreating = signal(false)
  readonly copiedContact = signal('')
  readonly toast = signal('')
  readonly copiedProxy = signal(false)
  get availableEditEmails() {
    const query = this.editRecipientQuery().trim().toLowerCase()
    return this.emails().filter(email => !this.editRecipients().includes(email) && email.toLowerCase().includes(query))
  }
  get isForwardingEnabled() {
    return Object.values(this.binding().states).some(Boolean)
  }
  fallbackDescription() {
    return $localize`Private forwarding address`
  }
  beginEdit() {
    const binding = this.binding()
    this.editing.set(true)
    this.editDescription.set(binding.description)
    this.editRecipients.set([...binding.recipients])
    this.editRecipientQuery.set('')
    this.editCallbackUrl.set(binding.callbackUrl)
    this.editUsedOn.set(binding.usedOn.join(', '))
    this.editSitePassword.set(binding.password)
  }
  async openContacts() {
    this.contactsOpen.set(true)
    this.contactsLoading.set(true)
    this.contacts.set(await this.api.contacts(this.binding()))
    this.contactsLoading.set(false)
  }
  closeContacts() {
    this.contactsOpen.set(false)
  }
  createContact() {
    const target = this.contactTarget().trim()
    if (!target) return
    this.contactCreating.set(true)
    this.api.createContact(this.binding(), target).subscribe({
      next: async () => {
        this.contactTarget.set('')
        this.contacts.set(await this.api.contacts(this.binding()))
        this.contactCreating.set(false)
      },
      error: () => this.contactCreating.set(false),
    })
  }
  async copyContact(address: string) {
    await navigator.clipboard.writeText(address)
    this.copiedContact.set(address)
    this.toast.set($localize`Contact address copied.`)
    setTimeout(() => this.toast.set(''), 2200)
  }
  generateSitePassword() {
    const preferences = this.passwordPreferences()
    const letters = preferences.letters ? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' : ''
    const numbers = preferences.numbers ? '0123456789' : ''
    const symbols = preferences.symbols ? '!@#$%^&*' : ''
    const characters = `${letters}${numbers}${symbols}` || 'abcdefghijklmnopqrstuvwxyz'
    this.editSitePassword.set(Array.from({ length: preferences.length }, () => characters[Math.floor(Math.random() * characters.length)]).join(''))
  }
  async copyProxyAddress() {
    await navigator.clipboard.writeText(this.binding().address)
    this.copiedProxy.set(true)
    this.toast.set($localize`Proxy address copied.`)
    setTimeout(() => this.toast.set(''), 2200)
  }
  cancelEdit() {
    this.editing.set(false)
  }
  openDeleteConfirmation() {
    this.deleteConfirmationOpen.set(true)
  }
  closeDeleteConfirmation() {
    if (!this.deleting()) this.deleteConfirmationOpen.set(false)
  }
  confirmDelete() {
    this.deleting.set(true)
    this.api.delete(this.binding()).subscribe({
      next: () => this.changed.emit(),
      error: () => this.deleting.set(false),
    })
  }
  saveEdit() {
    const binding = this.binding()
    this.saving.set(true)
    this.api.update(binding, { forwarding: this.editRecipients().join(', '), description: this.editDescription(), callbackUrl: this.editCallbackUrl() }).subscribe({
      next: () => {
        Promise.all([this.api.updateUsedOn(binding, this.editUsedOn().split(',').map(value => value.trim()).filter(Boolean)).toPromise(), this.api.setBindingPassword(binding, this.editSitePassword()).toPromise()]).then(() => {
          this.editing.set(false)
          this.saving.set(false)
          this.changed.emit()
        })
      },
      error: () => this.saving.set(false),
    })
  }
  onRecipientInput(value: string) {
    this.editRecipientQuery.set(value)
    this.editRecipientOpen.set(true)
  }
  addRecipient(value = this.editRecipientQuery()) {
    const email = value.trim()
    if (!email || this.editRecipients().includes(email)) return
    this.editRecipients.update(recipients => [...recipients, email])
    this.editRecipientQuery.set('')
    this.editRecipientOpen.set(true)
  }
  selectRecipient(email: string) {
    this.addRecipient(email)
  }
  removeRecipient(email: string) {
    this.editRecipients.update(recipients => recipients.filter(recipient => recipient !== email))
  }
  setRecipients(enabled: boolean) {
    const binding = this.binding()
    Promise.all(binding.recipients.map(address => this.api.setRecipient(binding, address, enabled).toPromise())).then(() => this.changed.emit())
  }
}
