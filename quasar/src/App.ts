import { Dialog, Notify } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  api,
  type Binding,
  type CustomDomain,
  type PasswordPreferences,
  type ProxyContact,
} from './api'

export default defineComponent({
  setup() {
    const { locale, t } = useI18n()
    type Page = 'dashboard' | 'domains' | 'settings'
    const loggedIn = ref(api.isAuthenticated())
    const page = ref<Page>('dashboard')
    const drawer = ref(false)
    const loading = ref(false)
    const error = ref('')
    const bindings = ref<Binding[]>([])
    const domains = ref<string[]>([])
    const customDomains = ref<CustomDomain[]>([])
    const emails = ref<string[]>([])
    const available = ref(0)
    const query = ref('')
    const alias = ref('')
    const domain = ref('')
    const forwarding = ref('')
    const loginToken = ref('')
    const busy = ref(false)
    const editBinding = ref<Binding | null>(null)
    const editDescription = ref('')
    const editRecipients = ref<string[]>([])
    const editCallbackUrl = ref('')
    const editUsedOn = ref('')
    const editPassword = ref('')
    const contactBinding = ref<Binding | null>(null)
    const contacts = ref<ProxyContact[]>([])
    const contactTarget = ref('')
    const passwordPreferences = ref<PasswordPreferences>({
      length: 13,
      symbols: true,
      numbers: true,
      letters: true,
    })
    const retention = ref('never')
    const selectedDomain = ref('')
    const selectedTarget = ref('')
    const replacementTarget = ref('')
    const hideIamRich = ref(false)
    const onlyCustomDomains = ref(false)
    const senderNameMode = ref('1')
    const senderCustomName = ref('')
    const heroVisible = ref(
      localStorage.getItem('proxiedmail.hideDashboardHero') !== 'true',
    )
    
    const filteredBindings = computed(() => {
      const term = query.value.toLowerCase()
      return bindings.value.filter(binding =>
        `${binding.address} ${binding.description}`.toLowerCase().includes(term)
      )
    })
    const visibleDomains = computed(() =>
      domains.value.filter(
        item => !(hideIamRich.value && item === 'iam-rich.net'),
      )
    )
    const availableCreateDomains = computed(() =>
      onlyCustomDomains.value && customDomains.value.length
        ? visibleDomains.value.filter(item =>
          customDomains.value.some(domain => domain.domain === item)
        )
        : visibleDomains.value
    )
    const editDialog = computed({
      get: () => Boolean(editBinding.value),
      set: value => {
        if (!value) editBinding.value = null
      },
    })
    const contactDialog = computed({
      get: () => Boolean(contactBinding.value),
      set: value => {
        if (!value) contactBinding.value = null
      },
    })
    const languageOptions = computed(() => [
      { label: t('settings.english'), value: 'en' },
      { label: t('settings.spanish'), value: 'es' },
      { label: t('settings.dutch'), value: 'nl' },
    ])
    
    function notify(message: string, color = 'positive') {
      Notify.create({ message, color, position: 'bottom-right' })
    }
    function nav(next: Page) {
      page.value = next
      drawer.value = false
      if (next === 'domains') loadDomains()
    }
    function dismissHero() {
      heroVisible.value = false
      localStorage.setItem('proxiedmail.hideDashboardHero', 'true')
    }
    function setLocale(value: string) {
      if (value !== 'en' && value !== 'es' && value !== 'nl') return
      locale.value = value
      localStorage.setItem('proxiedmail.locale', value)
    }
    async function signIn() {
      busy.value = true
      error.value = ''
      try {
        await api.login(loginToken.value)
        await api.currentUser()
        loggedIn.value = true
        await refresh()
      }
      catch (caught) {
        error.value = caught instanceof Error ? caught.message : 'Sign in failed.'
      }
      finally {
        busy.value = false
      }
    }
    function logout() {
      api.logout()
      loggedIn.value = false
      loginToken.value = ''
      page.value = 'dashboard'
    }
    async function refresh() {
      loading.value = true
      error.value = ''
      try {
        const data = await api.dashboard()
    
        bindings.value = data.bindings
        domains.value = data.domains
        customDomains.value = data.customDomains.map(domain => ({ domain }))
        emails.value = data.emails
        available.value = data.available
        passwordPreferences.value = data.passwordPreferences
        hideIamRich.value = data.appSettings.hideIamRich === 'true'
        onlyCustomDomains.value = data.appSettings.onlyCustomDomains === 'true' && data.customDomains.length > 0
        selectedDomain.value = data.settings.find(
          (item: any) => item.key === 'random_alias_default_domain',
        )?.value
          || data.domains[0]
          || ''
        domain.value = availableCreateDomains.value.includes(selectedDomain.value)
          ? selectedDomain.value
          : availableCreateDomains.value[0] || ''
        if (!availableCreateDomains.value.includes(selectedDomain.value))
          selectedDomain.value = availableCreateDomains.value[0] || ''
        selectedTarget.value = data.emails[0] || ''
        retention.value = data.settings.find((item: any) =>
          /retention|message/i.test(item.key || '')
        )?.value || 'never'
      }
      catch (caught) {
        error.value = caught instanceof Error
          ? caught.message
          : 'Unable to load email addresses.'
      }
      finally {
        loading.value = false
      }
    }
    function randomAlias() {
      alias.value = Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
    }
    async function createProxy() {
      if (!alias.value.trim() || !forwarding.value) return
      busy.value = true
      try {
        await api.create(alias.value, domain.value, forwarding.value)
        alias.value = ''
        forwarding.value = ''
        notify('Email address created.')
        await refresh()
      }
      catch (caught) {
        notify(
          caught instanceof Error ? caught.message : 'Unable to create proxy.',
          'negative',
        )
      }
      finally {
        busy.value = false
      }
    }
    function copy(value: string, message = 'Copied to clipboard.') {
      navigator.clipboard
        .writeText(value)
        .then(() => notify(message))
        .catch(() => notify('Unable to access the clipboard.', 'negative'))
    }
    function toggleForwarding(binding: Binding, enabled: boolean) {
      Promise.all(
        binding.recipients.map(address =>
          api.setRecipient(binding, address, enabled)
        ),
      )
        .then(refresh)
        .catch(caught => notify(caught.message, 'negative'))
    }
    function beginEdit(binding: Binding) {
      editBinding.value = binding
      editDescription.value = binding.description
      editRecipients.value = [...binding.recipients]
      editCallbackUrl.value = binding.callbackUrl
      editUsedOn.value = binding.usedOn.join(', ')
      editPassword.value = binding.password
    }
    function generatePassword() {
      const prefs = passwordPreferences.value
      const chars =
        `${prefs.letters ? 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ' : ''}${
          prefs.numbers ? '23456789' : ''
        }${prefs.symbols ? '!@#$%^&*' : ''}`
        || 'abcdefghijkmnpqrstuvwxyz'
      editPassword.value = Array.from(
        { length: prefs.length },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('')
    }
    async function saveEdit() {
      if (!editBinding.value) return
      busy.value = true
      try {
        await api.update(editBinding.value, {
          forwarding: editRecipients.value.join(', '),
          description: editDescription.value,
          callbackUrl: editCallbackUrl.value,
        })
        await Promise.all([
          api.updateUsedOn(
            editBinding.value,
            editUsedOn.value
              .split(',')
              .map(item => item.trim())
              .filter(Boolean),
          ),
          api.setBindingPassword(editBinding.value, editPassword.value),
        ])
        editBinding.value = null
        notify('Proxy updated.')
        await refresh()
      }
      catch (caught) {
        notify(
          caught instanceof Error ? caught.message : 'Unable to save proxy.',
          'negative',
        )
      }
      finally {
        busy.value = false
      }
    }
    function deleteProxy(binding: Binding) {
      Dialog.create({
        title: 'Delete email address?',
        message:
          'This removes the email address. Disabled addresses remain available for re-enabling.',
        cancel: true,
        persistent: true,
      }).onOk(async () => {
        try {
          await api.delete(binding)
          notify('Proxy deleted.')
          await refresh()
        }
        catch (caught) {
          notify(
            caught instanceof Error ? caught.message : 'Unable to delete email address.',
            'negative',
          )
        }
      })
    }
    async function openContacts(binding: Binding) {
      contactBinding.value = binding
      contacts.value = []
      try {
        contacts.value = await api.contacts(binding)
      }
      catch {
        notify('Unable to load contacts.', 'negative')
      }
    }
    async function createContact() {
      if (!contactBinding.value || !contactTarget.value) return
      try {
        await api.createContact(contactBinding.value, contactTarget.value)
        contacts.value = await api.contacts(contactBinding.value)
        contactTarget.value = ''
        notify('Contact created.')
      }
      catch (caught) {
        notify(
          caught instanceof Error ? caught.message : 'Unable to create contact.',
          'negative',
        )
      }
    }
    async function loadDomains() {
      loading.value = true
      try {
        customDomains.value = await api.customDomains()
      }
      catch (caught) {
        error.value = caught instanceof Error
          ? caught.message
          : 'Unable to load custom domains.'
      }
      finally {
        loading.value = false
      }
    }
    async function saveSetting(key: string, value: string) {
      try {
        await api.updateSettings([{ key, value }])
        notify('Settings saved.')
      }
      catch (caught) {
        notify(
          caught instanceof Error ? caught.message : 'Unable to save settings.',
          'negative',
        )
      }
    }
    async function replaceTarget() {
      if (!selectedTarget.value || !replacementTarget.value) return
      try {
        await api.replaceTargetAddress(
          selectedTarget.value,
          replacementTarget.value,
        )
        replacementTarget.value = ''
        notify('Target address replacement started.')
      }
      catch (caught) {
        notify(
          caught instanceof Error ? caught.message : 'Unable to replace target.',
          'negative',
        )
      }
    }
    async function saveLocalPreferences() {
      const allowedDomains = availableCreateDomains.value
      if (!allowedDomains.includes(domain.value))
        domain.value = allowedDomains[0] || ''
      if (!allowedDomains.includes(selectedDomain.value))
        selectedDomain.value = allowedDomains[0] || ''
      try {
        await api.saveAppSettings(
          {
            hideIamRich: String(hideIamRich.value),
            onlyCustomDomains: String(onlyCustomDomains.value),
          },
          domains.value,
          customDomains.value.map(domain => domain.domain),
        )
        notify('Display preferences saved.')
      }
      catch (caught) {
        notify(
          caught instanceof Error
            ? caught.message
            : 'Unable to save display preferences.',
          'negative',
        )
      }
    }
    async function exportConfiguration() {
      try {
        const payload = await api.exportConfiguration()
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json',
          }),
        )
        Object.assign(document.createElement('a'), {
          href: url,
          download: `proxiedmail-config-${
            new Date().toISOString().slice(0, 10)
          }.json`,
        }).click()
        URL.revokeObjectURL(url)
        notify('Configuration downloaded.')
      }
      catch {
        notify('Unable to export configuration.', 'negative')
      }
    }
    function statusLabel(domainRecord: CustomDomain) {
      const status = Number(domainRecord.status || 0)
      return status >= 5
        ? 'Active'
        : [
          'Not started',
          'Awaiting TXT verification',
          'Awaiting MX verification',
          'Awaiting SPF verification',
          'Active, awaiting DKIM verification',
        ][status] || 'All set'
    }
    onMounted(() => {
      if (loggedIn.value) refresh()
    })

    return {
      api,
      locale,
      languageOptions,
      loggedIn,
      page,
      drawer,
      loading,
      error,
      bindings,
      domains,
      customDomains,
      emails,
      available,
      query,
      alias,
      domain,
      forwarding,
      loginToken,
      busy,
      editBinding,
      editDescription,
      editRecipients,
      editCallbackUrl,
      editUsedOn,
      editPassword,
      contactBinding,
      contacts,
      contactTarget,
      passwordPreferences,
      retention,
      selectedDomain,
      selectedTarget,
      replacementTarget,
      hideIamRich,
      onlyCustomDomains,
      senderNameMode,
      senderCustomName,
      heroVisible,
      filteredBindings,
      visibleDomains,
      availableCreateDomains,
      editDialog,
      contactDialog,
      nav,
      dismissHero,
      setLocale,
      signIn,
      logout,
      refresh,
      randomAlias,
      createProxy,
      copy,
      toggleForwarding,
      beginEdit,
      generatePassword,
      saveEdit,
      deleteProxy,
      openContacts,
      createContact,
      loadDomains,
      saveSetting,
      replaceTarget,
      saveLocalPreferences,
      exportConfiguration,
      statusLabel,
    }
  },
})
