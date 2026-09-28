<script lang="ts" src="./App.ts"></script>

<template lang="pug">
main(v-if="!loggedIn" class="login-page")
  q-card(flat bordered class="login-card")
    q-card-section
      div(class="brand-mark")
        | @
      div(class="eyebrow")
        | {{ $t('auth.eyebrow') }}
      h1
        | {{ $t('auth.welcome') }}
      p
        | {{ $t('auth.description') }}
    q-card-section
      q-form(@submit="signIn")
        q-input(v-model="loginToken" :label="$t('auth.token')" type="password" outlined autocomplete="off" :error="Boolean(error)" :error-message="error")
        q-btn(class="full-width q-mt-lg" color="primary" :label="$t('auth.signIn')" type="submit" :loading="busy" unelevated)
q-layout(v-else view="hHh Lpr fFf" class="app-shell")
  q-header(bordered class="topbar")
    q-toolbar
      q-btn(flat dense round icon="menu" class="lt-md" @click="drawer = !drawer")
      q-toolbar-title(class="brand" @click="nav('dashboard')")
        span(class="brand-mark small")
          | @
        | ProxiedMail
      q-tabs(class="gt-sm" active-color="primary" indicator-color="primary")
        q-tab(name="dashboard" :label="$t('nav.dashboard')" @click="nav('dashboard')")
        q-tab(name="settings" :label="$t('nav.settings')" @click="nav('settings')")
      q-space
      q-btn(flat no-caps :label="$t('nav.signOut')" @click="logout")
  q-drawer(v-model="drawer" bordered)
    q-list(padding)
      q-item(clickable v-ripple @click="nav('dashboard')")
        q-item-section(avatar)
          q-icon(name="dashboard")
        q-item-section
          | {{ $t('nav.dashboard') }}
      q-item(clickable v-ripple @click="nav('settings')")
        q-item-section(avatar)
          q-icon(name="settings")
        q-item-section
          | {{ $t('nav.settings') }}
  q-page-container
    q-page(class="page-content")
      div(v-if="error" class="q-mb-md")
        q-banner(rounded class="bg-red-1 text-negative")
          template(#avatar)
            q-icon(name="error_outline")
          | {{ error }}
          template(#action)
            q-btn(flat :label="$t('dashboard.refresh')" @click="refresh")
      template(v-if="page === 'dashboard'")
        section(v-if="heroVisible" class="hero")
          q-btn(flat round dense icon="close" aria-label="Dismiss" @click="dismissHero")
          div(class="eyebrow")
            | {{ $t('dashboard.eyebrow') }}
          h1
            | {{ $t('dashboard.title') }}
          p
            | {{ $t('dashboard.description') }}
          small(class="hero-context")
            | {{ $t('dashboard.interface') }}
        section(class="section-heading")
          div
            div(class="eyebrow text-primary")
              | {{ $t('dashboard.management') }}
            h2
              | {{ $t('dashboard.proxies') }}
            p
              | {{ $t('dashboard.proxyDescription') }}
          q-btn(outline color="primary" icon="refresh" :label="$t('dashboard.refresh')" :loading="loading" @click="refresh")
        div(class="metric-grid")
          q-card(flat bordered)
            q-card-section
              div
                | {{ $t('dashboard.active') }}
              strong
                | {{ bindings.length }}
          q-card(flat bordered)
            q-card-section
              div
                | {{ $t('dashboard.capacity') }}
              strong
                | {{ available }}
        q-card(flat bordered class="q-mb-lg")
          q-card-section
            div(class="eyebrow text-primary")
              | {{ $t('dashboard.newProxy') }}
            div(class="create-grid q-mt-md")
              q-input(v-model="alias" outlined dense :label="$t('dashboard.proxy')")
                template(#append)
                  q-btn(flat dense round icon="casino" @click="randomAlias")
              q-select(v-model="domain" outlined dense :label="$t('dashboard.domain')" :options="availableCreateDomains")
              q-select(v-model="forwarding" outlined dense :label="$t('dashboard.target')" :options="emails" use-input fill-input hide-selected)
              q-btn(color="primary" :label="$t('dashboard.create')" :disable="!alias.trim() || !forwarding" :loading="busy" @click="createProxy")
              q-input(v-model="query" outlined dense clearable type="search" :label="$t('dashboard.search')" class="search-input q-mb-md")
          template(#prepend)
            q-icon(name="search")
        div(v-if="loading" class="row justify-center q-pa-xl")
          q-spinner(color="primary" size="40px")
        div(v-else class="proxy-grid")
          q-card(v-for="binding in filteredBindings" :key="binding.id" flat bordered)
            q-card-section
              div(class="row items-center no-wrap")
                q-icon(name="alternate_email" color="primary" size="24px")
                strong(class="q-ml-sm ellipsis")
                  | {{ binding.address }}
                q-space
                q-btn(flat round dense icon="content_copy" @click="copy(binding.address, 'Email address copied.')")
                q-btn(flat round dense icon="contacts" @click="openContacts(binding)")
                q-btn(flat dense no-caps :label="$t('dashboard.edit')" @click="beginEdit(binding)")
              p(class="description")
                | {{ binding.description || 'Private forwarding address' }}
              div(class="meta")
                span
                  | {{ binding.recipients.length }} {{ $t('dashboard.recipients') }}
                span
                  | {{ binding.received }} {{ $t('dashboard.forwarded') }}
                q-toggle(:model-value="Object.values(binding.states).some(Boolean)" :label="$t('dashboard.forwarding')" color="primary" @update:model-value="toggleForwarding(binding, $event)")
              q-separator(class="q-my-sm")
              div(v-for="recipient in binding.recipients" :key="recipient" class="row justify-between q-py-xs")
                span(class="ellipsis")
                  | {{ recipient }}
                q-badge(:color="binding.verificationStates[recipient] ? 'positive' : 'warning'" :label="binding.verificationStates[recipient] ? $t('dashboard.verified') : $t('dashboard.verificationRequired')")
          div(v-if="!filteredBindings.length" class="empty-state")
            | {{ $t('dashboard.empty') }}
      template(v-else)
        section(class="section-heading")
          div
            div(class="eyebrow text-primary")
              | {{ $t('settings.eyebrow') }}
            h1
              | {{ $t('settings.title') }}
            p
              | {{ $t('settings.description') }}
            a(class="proxiedmail-link" href="https://proxiedmail.com/en/board" target="_blank" rel="noopener")
              q-icon(name="open_in_new")
              | {{ $t('settings.externalDashboard') }}
        div(class="settings-grid")
          q-card(flat bordered)
            q-card-section
              h2
                | {{ $t('settings.account') }}
              q-select(v-model="locale" outlined :label="$t('settings.language')" :options="languageOptions" emit-value map-options @update:model-value="setLocale" class="q-mb-md")
              q-select(v-model="retention" outlined :label="$t('settings.retention')" :options="[ { label: '1 day', value: '1-day' }, { label: '3 days', value: '3-days' }, { label: 'Never', value: 'never' }, ]" emit-value map-options @update:model-value="saveSetting('received_messages_retention', retention)")
              q-select(v-model="selectedDomain" outlined :label="$t('settings.defaultDomain')" :options="availableCreateDomains" class="q-mt-md" @update:model-value="saveSetting('random_alias_default_domain', selectedDomain)")
              q-toggle(v-model="hideIamRich" :label="$t('settings.hideIamRich')" class="q-mt-md" @update:model-value="saveLocalPreferences")
              q-toggle(v-model="onlyCustomDomains" :label="$t('settings.customDomains')" :disable="!customDomains.length" @update:model-value="saveLocalPreferences")
              q-separator(class="q-my-lg")
              h3
                | {{ $t('settings.replaceTarget') }}
              q-select(v-model="selectedTarget" outlined :label="$t('settings.target')" :options="emails")
              q-input(v-model="replacementTarget" outlined :label="$t('settings.replacement')" type="email" class="q-mt-md")
              q-btn(color="primary" :label="$t('settings.replace')" class="q-mt-md" :disable="!selectedTarget || !replacementTarget" @click="replaceTarget")
          q-card(flat bordered)
            q-card-section
              h2
                | {{ $t('settings.privacy') }}
              q-option-group(v-model="senderNameMode" :options="[ { label: 'Default sender name', value: '1' }, { label: 'Hide sender name', value: '0' }, { label: 'Custom sender name', value: 'custom' }, ]" type="radio" @update:model-value="saveSetting( 'sender_name_mode', senderNameMode === 'custom' ? senderCustomName : senderNameMode, )")
              q-input(v-if="senderNameMode === 'custom'" v-model="senderCustomName" outlined label="Custom sender name" class="q-mt-md" @blur="saveSetting('sender_name_mode', senderCustomName)")
              q-separator(class="q-my-lg")
              h3
                | {{ $t('settings.passwordGenerator') }}
              q-input(v-model.number="passwordPreferences.length" outlined type="number" min="6" max="128" :label="$t('settings.passwordLength')" @update:model-value="saveSetting( 'password_length', String(passwordPreferences.length), )")
              q-toggle(v-model="passwordPreferences.letters" :label="$t('settings.letters')" @update:model-value="saveSetting( 'use_letters', String(passwordPreferences.letters), )")
              q-toggle(v-model="passwordPreferences.numbers" :label="$t('settings.numbers')" @update:model-value="saveSetting( 'use_numbers', String(passwordPreferences.numbers), )")
              q-toggle(v-model="passwordPreferences.symbols" :label="$t('settings.symbols')" @update:model-value="saveSetting( 'use_symbols', String(passwordPreferences.symbols), )")
          q-card(flat bordered)
            q-card-section
              q-expansion-item(icon="integration_instructions" label="Bitwarden setup" header-class="q-px-none text-primary")
                p
                  | ProxiedMail currently emulates Bitwarden's Addy.io integration. Please ask Bitwarden to add a proper ProxiedMail integration in the
                  a(href="https://github.com/bitwarden/clients/pull/20766" target="_blank" rel="noopener")
                    | ProxiedMail integration request
                  | .
                ol(class="q-pl-lg")
                  li
                    | In Bitwarden, open
                    strong
                      | Generator
                    | , choose
                    strong
                      | Username
                    | , then choose
                    strong
                      | Forwarded email alias
                    | .
                  li
                    | In
                    strong
                      | API key
                    | , enter
                    code
                      | {{ api.apiToken() }}
                    | .
                    q-btn(flat dense round icon="content_copy" aria-label="Copy API key" @click="copy(api.apiToken())")
                  li(class="q-mt-sm")
                    q-select(v-model="selectedDomain" dense outlined label="Email domain" :options="availableCreateDomains")
                  li
                    | In
                    strong
                      | Self-host server URL
                    | , enter
                    code
                      | https://proxiedmail.com
                    | .
                  li
                    | Select
                    strong
                      | Generate
                    | to create the alias in ProxiedMail.
                q-banner(dense rounded class="bg-orange-1 text-orange-10")
                  | Treat this API key like a password. Anyone who has it can access your ProxiedMail account.
              q-separator(class="q-my-lg")
              h2
                | Export configuration
              p
                | Download a portable JSON backup of your email addresses and account preferences. Authentication tokens are never included.
              q-btn(outline color="primary" icon="download" label="Download JSON" @click="exportConfiguration")
q-dialog(v-model="editDialog")
  q-card(class="dialog-card")
    q-card-section(class="row items-center")
      div
        div(class="eyebrow text-primary")
          | EDIT EMAIL ADDRESS
        strong
          | {{ editBinding?.address }}
      q-space
      q-btn(flat round icon="close" v-close-popup)
    q-card-section
      q-input(v-model="editDescription" outlined type="textarea" label="Description")
      q-select(v-model="editRecipients" outlined multiple use-input use-chips new-value-mode="add-unique" :options="emails" label="Forward to" class="q-mt-md")
      q-expansion-item(label="Advanced settings" class="q-mt-md")
        q-input(v-model="editCallbackUrl" outlined label="Callback URL" class="q-mt-sm")
        q-input(v-model="editUsedOn" outlined label="Used on sites" hint="Separate sites with commas" class="q-mt-md")
        q-input(v-model="editPassword" outlined type="password" label="Site password" class="q-mt-md")
          template(#append)
            q-btn(flat dense round icon="refresh" @click="generatePassword")
    q-card-actions(align="between")
      q-btn(color="negative" flat label="Delete" @click="editBinding && (deleteProxy(editBinding), (editBinding = null))")
      q-btn(color="primary" label="Save changes" :loading="busy" @click="saveEdit")
q-dialog(v-model="contactDialog")
  q-card(class="dialog-card")
    q-card-section(class="row items-center")
      div
        div(class="eyebrow text-primary")
          | CONTACTS
        strong
          | {{ contactBinding?.address }}
      q-space
      q-btn(flat round icon="close" v-close-popup)
    q-card-section
      q-input(v-model="contactTarget" outlined label="Where do you want to send the email?" type="email")
        template(#append)
          q-btn(round dense flat icon="add" @click="createContact")
      q-list(separator class="q-mt-md")
        q-item(v-for="contact in contacts" :key="contact.id")
          q-item-section
            q-item-label
              | {{ contact.reverseProxyAddress }}
            q-item-label(caption)
              | {{ contact.recipientEmail }}
          q-item-section(side)
            q-btn(flat round dense icon="mail" :href="`mailto:${contact.reverseProxyAddress}`")
            q-btn(flat round dense icon="content_copy" @click="copy(contact.reverseProxyAddress, 'Contact address copied.')")
        q-item(v-if="!contacts.length")
          q-item-section(class="text-grey")
            | No contacts created yet.
</template>
