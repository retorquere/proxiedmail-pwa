<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Dialog, Notify } from "quasar";
import {
  api,
  type Binding,
  type CustomDomain,
  type PasswordPreferences,
  type ProxyContact,
} from "./api";

type Page = "dashboard" | "domains" | "settings";
const loggedIn = ref(api.isAuthenticated());
const page = ref<Page>("dashboard");
const drawer = ref(false);
const loading = ref(false);
const error = ref("");
const bindings = ref<Binding[]>([]);
const domains = ref<string[]>([]);
const customDomains = ref<CustomDomain[]>([]);
const emails = ref<string[]>([]);
const available = ref(0);
const query = ref("");
const alias = ref("");
const domain = ref("");
const forwarding = ref("");
const loginToken = ref("");
const busy = ref(false);
const editBinding = ref<Binding | null>(null);
const editDescription = ref("");
const editRecipients = ref<string[]>([]);
const editCallbackUrl = ref("");
const editUsedOn = ref("");
const editPassword = ref("");
const contactBinding = ref<Binding | null>(null);
const contacts = ref<ProxyContact[]>([]);
const contactTarget = ref("");
const passwordPreferences = ref<PasswordPreferences>({
  length: 13,
  symbols: true,
  numbers: true,
  letters: true,
});
const retention = ref("never");
const selectedDomain = ref("");
const selectedTarget = ref("");
const replacementTarget = ref("");
const hideIamRich = ref(false);
const onlyCustomDomains = ref(false);
const senderNameMode = ref("1");
const senderCustomName = ref("");
const heroVisible = ref(
  localStorage.getItem("proxiedmail.hideDashboardHero") !== "true",
);

const filteredBindings = computed(() => {
  const term = query.value.toLowerCase();
  return bindings.value.filter((binding) =>
    `${binding.address} ${binding.description}`.toLowerCase().includes(term),
  );
});
const visibleDomains = computed(() =>
  domains.value.filter(
    (item) => !(hideIamRich.value && item === "iam-rich.net"),
  ),
);
const availableCreateDomains = computed(() =>
  onlyCustomDomains.value && customDomains.value.length
    ? visibleDomains.value.filter((item) =>
        customDomains.value.some((domain) => domain.domain === item),
      )
    : visibleDomains.value,
);
const editDialog = computed({
  get: () => Boolean(editBinding.value),
  set: (value) => {
    if (!value) editBinding.value = null;
  },
});
const contactDialog = computed({
  get: () => Boolean(contactBinding.value),
  set: (value) => {
    if (!value) contactBinding.value = null;
  },
});

function notify(message: string, color = "positive") {
  Notify.create({ message, color, position: "bottom-right" });
}
function nav(next: Page) {
  page.value = next;
  drawer.value = false;
  if (next === "domains") loadDomains();
}
function dismissHero() {
  heroVisible.value = false;
  localStorage.setItem("proxiedmail.hideDashboardHero", "true");
}
async function signIn() {
  busy.value = true;
  error.value = "";
  try {
    await api.login(loginToken.value);
    await api.currentUser();
    loggedIn.value = true;
    await refresh();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Sign in failed.";
  } finally {
    busy.value = false;
  }
}
function logout() {
  api.logout();
  loggedIn.value = false;
  loginToken.value = "";
  page.value = "dashboard";
}
async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.dashboard();
    bindings.value = data.bindings;
    domains.value = data.domains;
    customDomains.value = data.customDomains.map((domain) => ({ domain }));
    emails.value = data.emails;
    available.value = data.available;
    passwordPreferences.value = data.passwordPreferences;
    hideIamRich.value = data.appSettings.hideIamRich === "true";
    onlyCustomDomains.value =
      data.appSettings.onlyCustomDomains === "true" &&
      data.customDomains.length > 0;
    selectedDomain.value =
      data.settings.find(
        (item: any) => item.key === "random_alias_default_domain",
      )?.value ||
      data.domains[0] ||
      "";
    domain.value = availableCreateDomains.value.includes(selectedDomain.value)
      ? selectedDomain.value
      : availableCreateDomains.value[0] || "";
    if (!availableCreateDomains.value.includes(selectedDomain.value))
      selectedDomain.value = availableCreateDomains.value[0] || "";
    selectedTarget.value = data.emails[0] || "";
    retention.value =
      data.settings.find((item: any) =>
        /retention|message/i.test(item.key || ""),
      )?.value || "never";
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? caught.message
        : "Unable to load proxy addresses.";
  } finally {
    loading.value = false;
  }
}
function randomAlias() {
  alias.value = Array.from(
    { length: 10 },
    () =>
      "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)],
  ).join("");
}
async function createProxy() {
  if (!alias.value.trim() || !forwarding.value) return;
  busy.value = true;
  try {
    await api.create(alias.value, domain.value, forwarding.value);
    alias.value = "";
    forwarding.value = "";
    notify("Proxy address created.");
    await refresh();
  } catch (caught) {
    notify(
      caught instanceof Error ? caught.message : "Unable to create proxy.",
      "negative",
    );
  } finally {
    busy.value = false;
  }
}
function copy(value: string, message = "Copied to clipboard.") {
  navigator.clipboard
    .writeText(value)
    .then(() => notify(message))
    .catch(() => notify("Unable to access the clipboard.", "negative"));
}
function toggleForwarding(binding: Binding, enabled: boolean) {
  Promise.all(
    binding.recipients.map((address) =>
      api.setRecipient(binding, address, enabled),
    ),
  )
    .then(refresh)
    .catch((caught) => notify(caught.message, "negative"));
}
function beginEdit(binding: Binding) {
  editBinding.value = binding;
  editDescription.value = binding.description;
  editRecipients.value = [...binding.recipients];
  editCallbackUrl.value = binding.callbackUrl;
  editUsedOn.value = binding.usedOn.join(", ");
  editPassword.value = binding.password;
}
function generatePassword() {
  const prefs = passwordPreferences.value;
  const chars =
    `${prefs.letters ? "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ" : ""}${prefs.numbers ? "23456789" : ""}${prefs.symbols ? "!@#$%^&*" : ""}` ||
    "abcdefghijkmnpqrstuvwxyz";
  editPassword.value = Array.from(
    { length: prefs.length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}
async function saveEdit() {
  if (!editBinding.value) return;
  busy.value = true;
  try {
    await api.update(editBinding.value, {
      forwarding: editRecipients.value.join(", "),
      description: editDescription.value,
      callbackUrl: editCallbackUrl.value,
    });
    await Promise.all([
      api.updateUsedOn(
        editBinding.value,
        editUsedOn.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
      api.setBindingPassword(editBinding.value, editPassword.value),
    ]);
    editBinding.value = null;
    notify("Proxy updated.");
    await refresh();
  } catch (caught) {
    notify(
      caught instanceof Error ? caught.message : "Unable to save proxy.",
      "negative",
    );
  } finally {
    busy.value = false;
  }
}
function deleteProxy(binding: Binding) {
  Dialog.create({
    title: "Delete proxy?",
    message:
      "This removes the proxy address. Disabled proxies remain available for re-enabling.",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(binding);
      notify("Proxy deleted.");
      await refresh();
    } catch (caught) {
      notify(
        caught instanceof Error ? caught.message : "Unable to delete proxy.",
        "negative",
      );
    }
  });
}
async function openContacts(binding: Binding) {
  contactBinding.value = binding;
  contacts.value = [];
  try {
    contacts.value = await api.contacts(binding);
  } catch {
    notify("Unable to load contacts.", "negative");
  }
}
async function createContact() {
  if (!contactBinding.value || !contactTarget.value) return;
  try {
    await api.createContact(contactBinding.value, contactTarget.value);
    contacts.value = await api.contacts(contactBinding.value);
    contactTarget.value = "";
    notify("Contact created.");
  } catch (caught) {
    notify(
      caught instanceof Error ? caught.message : "Unable to create contact.",
      "negative",
    );
  }
}
async function loadDomains() {
  loading.value = true;
  try {
    customDomains.value = await api.customDomains();
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? caught.message
        : "Unable to load custom domains.";
  } finally {
    loading.value = false;
  }
}
async function saveSetting(key: string, value: string) {
  try {
    await api.updateSettings([{ key, value }]);
    notify("Settings saved.");
  } catch (caught) {
    notify(
      caught instanceof Error ? caught.message : "Unable to save settings.",
      "negative",
    );
  }
}
async function replaceTarget() {
  if (!selectedTarget.value || !replacementTarget.value) return;
  try {
    await api.replaceTargetAddress(
      selectedTarget.value,
      replacementTarget.value,
    );
    replacementTarget.value = "";
    notify("Target address replacement started.");
  } catch (caught) {
    notify(
      caught instanceof Error ? caught.message : "Unable to replace target.",
      "negative",
    );
  }
}
async function saveLocalPreferences() {
  const allowedDomains = availableCreateDomains.value;
  if (!allowedDomains.includes(domain.value))
    domain.value = allowedDomains[0] || "";
  if (!allowedDomains.includes(selectedDomain.value))
    selectedDomain.value = allowedDomains[0] || "";
  try {
    await api.saveAppSettings(
      {
        hideIamRich: String(hideIamRich.value),
        onlyCustomDomains: String(onlyCustomDomains.value),
      },
      domains.value,
      customDomains.value.map((domain) => domain.domain),
    );
    notify("Display preferences saved.");
  } catch (caught) {
    notify(
      caught instanceof Error
        ? caught.message
        : "Unable to save display preferences.",
      "negative",
    );
  }
}
async function exportConfiguration() {
  try {
    const payload = {
      format: "proxiedmail-portable-config",
      version: 1,
      exportedAt: new Date().toISOString(),
      proxies: bindings.value.map((binding) => ({
        proxyAddress: binding.address,
        description: binding.description,
        targets: binding.recipients,
        callbackUrl: binding.callbackUrl,
        usedOn: binding.usedOn,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    Object.assign(document.createElement("a"), {
      href: url,
      download: `proxiedmail-config-${new Date().toISOString().slice(0, 10)}.json`,
    }).click();
    URL.revokeObjectURL(url);
    notify("Configuration downloaded.");
  } catch {
    notify("Unable to export configuration.", "negative");
  }
}
function statusLabel(domainRecord: CustomDomain) {
  const status = Number(domainRecord.status || 0);
  return status >= 5
    ? "Active"
    : [
        "Not started",
        "Awaiting TXT verification",
        "Awaiting MX verification",
        "Awaiting SPF verification",
        "Active, awaiting DKIM verification",
      ][status] || "All set";
}
onMounted(() => {
  if (loggedIn.value) refresh();
});
</script>

<template>
  <main v-if="!loggedIn" class="login-page">
    <q-card flat bordered class="login-card">
      <q-card-section
        ><div class="brand-mark">@</div>
        <div class="eyebrow">PRIVATE EMAIL RELAY</div>
        <h1>Welcome to ProxiedMail</h1>
        <p>
          Manage private aliases without exposing your inbox.
        </p></q-card-section
      >
      <q-card-section
        ><q-form @submit="signIn"
          ><q-input
            v-model="loginToken"
            label="API token"
            type="password"
            outlined
            autocomplete="off"
            :error="Boolean(error)"
            :error-message="error" /><q-btn
            class="full-width q-mt-lg"
            color="primary"
            label="Sign in"
            type="submit"
            :loading="busy"
            unelevated /></q-form
      ></q-card-section>
    </q-card>
  </main>
  <q-layout v-else view="hHh Lpr fFf" class="app-shell">
    <q-header bordered class="topbar"
      ><q-toolbar
        ><q-btn
          flat
          dense
          round
          icon="menu"
          class="lt-md"
          @click="drawer = !drawer" /><q-toolbar-title
          class="brand"
          @click="nav('dashboard')"
          ><span class="brand-mark small">@</span> ProxiedMail</q-toolbar-title
        ><q-tabs class="gt-sm" active-color="primary" indicator-color="primary"
          ><q-tab
            name="dashboard"
            label="Dashboard"
            @click="nav('dashboard')" /><q-tab
            name="domains"
            label="Domains"
            @click="nav('domains')" /><q-tab
            name="settings"
            label="Settings"
            @click="nav('settings')" /></q-tabs
        ><q-space /><q-btn
          flat
          no-caps
          label="Sign out"
          @click="logout" /></q-toolbar
    ></q-header>
    <q-drawer v-model="drawer" bordered
      ><q-list padding
        ><q-item clickable v-ripple @click="nav('dashboard')"
          ><q-item-section avatar><q-icon name="dashboard" /></q-item-section
          ><q-item-section>Dashboard</q-item-section></q-item
        ><q-item clickable v-ripple @click="nav('domains')"
          ><q-item-section avatar><q-icon name="dns" /></q-item-section
          ><q-item-section>Domains</q-item-section></q-item
        ><q-item clickable v-ripple @click="nav('settings')"
          ><q-item-section avatar><q-icon name="settings" /></q-item-section
          ><q-item-section>Settings</q-item-section></q-item
        ></q-list
      ></q-drawer
    >
    <q-page-container
      ><q-page class="page-content">
        <div v-if="error" class="q-mb-md">
          <q-banner rounded class="bg-red-1 text-negative"
            ><template #avatar><q-icon name="error_outline" /></template
            >{{ error
            }}<template #action
              ><q-btn flat label="Retry" @click="refresh" /></template
          ></q-banner>
        </div>
        <template v-if="page === 'dashboard'"
          ><section v-if="heroVisible" class="hero">
            <q-btn
              flat
              round
              dense
              icon="close"
              aria-label="Dismiss"
              @click="dismissHero"
            />
            <div class="eyebrow">YOUR PRIVATE ADDRESS BOOK</div>
            <h1>Keep your inbox yours.</h1>
            <p>
              Every service gets its own address. Quiet, clear, and easy to
              replace.
            </p>
          </section>
          <section class="section-heading">
            <div>
              <div class="eyebrow text-primary">PROXY MANAGEMENT</div>
              <h2>Proxy addresses</h2>
              <p>Private forwarding addresses for your online accounts.</p>
            </div>
            <q-btn
              outline
              color="primary"
              icon="refresh"
              label="Refresh"
              :loading="loading"
              @click="refresh"
            />
          </section>
          <div class="metric-grid">
            <q-card flat bordered
              ><q-card-section
                ><div>Active proxies</div>
                <strong>{{ bindings.length }}</strong></q-card-section
              ></q-card
            ><q-card flat bordered
              ><q-card-section
                ><div>Available capacity</div>
                <strong>{{ available }}</strong></q-card-section
              ></q-card
            >
          </div>
          <q-card flat bordered class="q-mb-lg"
            ><q-card-section
              ><div class="eyebrow text-primary">NEW PROXY ADDRESS</div>
              <div class="create-grid q-mt-md">
                <q-input v-model="alias" outlined dense label="Proxy"
                  ><template #append
                    ><q-btn
                      flat
                      dense
                      round
                      icon="casino"
                      @click="randomAlias" /></template></q-input
                ><q-select
                  v-model="domain"
                  outlined
                  dense
                  label="Domain"
                  :options="availableCreateDomains"
                /><q-select
                  v-model="forwarding"
                  outlined
                  dense
                  label="Target email"
                  :options="emails"
                  use-input
                  fill-input
                  hide-selected
                /><q-btn
                  color="primary"
                  label="Create"
                  :disable="!alias.trim() || !forwarding"
                  :loading="busy"
                  @click="createProxy"
                /></div></q-card-section></q-card
          ><q-input
            v-model="query"
            outlined
            dense
            clearable
            type="search"
            label="Search aliases"
            class="search-input q-mb-md"
            ><template #prepend><q-icon name="search" /></template
          ></q-input>
          <div v-if="loading" class="row justify-center q-pa-xl">
            <q-spinner color="primary" size="40px" />
          </div>
          <div v-else class="proxy-grid">
            <q-card
              v-for="binding in filteredBindings"
              :key="binding.id"
              flat
              bordered
              ><q-card-section
                ><div class="row items-center no-wrap">
                  <q-icon
                    name="alternate_email"
                    color="primary"
                    size="24px"
                  /><strong class="q-ml-sm ellipsis">{{
                    binding.address
                  }}</strong
                  ><q-space /><q-btn
                    flat
                    round
                    dense
                    icon="content_copy"
                    @click="copy(binding.address, 'Proxy address copied.')"
                  /><q-btn
                    flat
                    round
                    dense
                    icon="contacts"
                    @click="openContacts(binding)"
                  /><q-btn
                    flat
                    dense
                    no-caps
                    label="Edit"
                    @click="beginEdit(binding)"
                  />
                </div>
                <p class="description">
                  {{ binding.description || "Private forwarding address" }}
                </p>
                <div class="meta">
                  <span>{{ binding.recipients.length }} recipient(s)</span
                  ><span>{{ binding.received }} forwarded</span
                  ><q-toggle
                    :model-value="Object.values(binding.states).some(Boolean)"
                    label="Forwarding"
                    color="primary"
                    @update:model-value="toggleForwarding(binding, $event)"
                  />
                </div>
                <q-separator class="q-my-sm" />
                <div
                  v-for="recipient in binding.recipients"
                  :key="recipient"
                  class="row justify-between q-py-xs"
                >
                  <span class="ellipsis">{{ recipient }}</span
                  ><q-badge
                    :color="
                      binding.verificationStates[recipient]
                        ? 'positive'
                        : 'warning'
                    "
                    :label="
                      binding.verificationStates[recipient]
                        ? 'Verified'
                        : 'Verification required'
                    "
                  /></div></q-card-section
            ></q-card>
            <div v-if="!filteredBindings.length" class="empty-state">
              No proxy addresses match this search.
            </div>
          </div></template
        >
        <template v-else-if="page === 'domains'"
          ><section class="section-heading">
            <div>
              <div class="eyebrow text-primary">ACCOUNT DOMAINS</div>
              <h1>Domains</h1>
              <p>Custom domains available for your proxy addresses.</p>
            </div>
            <q-btn
              outline
              color="primary"
              icon="refresh"
              label="Refresh"
              @click="loadDomains"
            />
          </section>
          <div v-if="loading" class="row justify-center q-pa-xl">
            <q-spinner color="primary" size="40px" />
          </div>
          <div v-else class="domain-grid">
            <q-card
              v-for="item in customDomains"
              :key="item.domain"
              flat
              bordered
              ><q-card-section
                ><strong>{{ item.domain }}</strong
                ><q-expansion-item
                  dense
                  label="Setup status"
                  header-class="q-px-none q-mt-sm"
                  ><q-list dense
                    ><q-item
                      ><q-item-section>Verification status</q-item-section
                      ><q-item-section side
                        ><q-badge
                          :color="
                            Number(item.status || 0) >= 5
                              ? 'positive'
                              : 'warning'
                          "
                          >{{ statusLabel(item) }}</q-badge
                        ></q-item-section
                      ></q-item
                    ><q-item
                      v-for="key in ['mx', 'spf', 'dkim', 'dmarc']"
                      :key="key"
                      ><q-item-section>{{ key.toUpperCase() }}</q-item-section
                      ><q-item-section side>{{
                        item[key] || item[`${key}_status`] || "Not reported"
                      }}</q-item-section></q-item
                    ></q-list
                  ></q-expansion-item
                ></q-card-section
              ></q-card
            >
            <div v-if="!customDomains.length" class="empty-state">
              No custom domains are available.
            </div>
          </div></template
        >
        <template v-else
          ><section class="section-heading">
            <div>
              <div class="eyebrow text-primary">ACCOUNT SETTINGS</div>
              <h1>Settings</h1>
              <p>Control account preferences and integrations.</p>
              <a
                href="https://proxiedmail.com/en/board"
                target="_blank"
                rel="noopener"
                >Open full dashboard</a
              >
            </div>
          </section>
          <div class="settings-grid">
            <q-card flat bordered
              ><q-card-section
                ><h2>Account settings</h2>
                <q-select
                  v-model="retention"
                  outlined
                  label="Received-message retention"
                  :options="[
                    { label: '1 day', value: '1-day' },
                    { label: '3 days', value: '3-days' },
                    { label: 'Never', value: 'never' },
                  ]"
                  emit-value
                  map-options
                  @update:model-value="
                    saveSetting('received_messages_retention', retention)
                  " /><q-select
                  v-model="selectedDomain"
                  outlined
                  label="Default proxy domain"
                  :options="availableCreateDomains"
                  class="q-mt-md"
                  @update:model-value="
                    saveSetting('random_alias_default_domain', selectedDomain)
                  " /><q-toggle
                  v-model="hideIamRich"
                  label="Hide iam-rich.net from the proxy domain list"
                  class="q-mt-md"
                  @update:model-value="saveLocalPreferences" /><q-toggle
                  v-model="onlyCustomDomains"
                  label="Only use custom domains"
                  :disable="!customDomains.length"
                  @update:model-value="saveLocalPreferences" /><q-separator
                  class="q-my-lg" />
                <h3>Replace target address</h3>
                <q-select
                  v-model="selectedTarget"
                  outlined
                  label="Target address"
                  :options="emails" /><q-input
                  v-model="replacementTarget"
                  outlined
                  label="Replacement address"
                  type="email"
                  class="q-mt-md" /><q-btn
                  color="primary"
                  label="Replace target"
                  class="q-mt-md"
                  :disable="!selectedTarget || !replacementTarget"
                  @click="replaceTarget" /></q-card-section></q-card
            ><q-card flat bordered
              ><q-card-section
                ><h2>Privacy and sending</h2>
                <q-option-group
                  v-model="senderNameMode"
                  :options="[
                    { label: 'Default sender name', value: '1' },
                    { label: 'Hide sender name', value: '0' },
                    { label: 'Custom sender name', value: 'custom' },
                  ]"
                  type="radio"
                  @update:model-value="
                    saveSetting(
                      'sender_name_mode',
                      senderNameMode === 'custom'
                        ? senderCustomName
                        : senderNameMode,
                    )
                  " /><q-input
                  v-if="senderNameMode === 'custom'"
                  v-model="senderCustomName"
                  outlined
                  label="Custom sender name"
                  class="q-mt-md"
                  @blur="
                    saveSetting('sender_name_mode', senderCustomName)
                  " /><q-separator class="q-my-lg" />
                <h3>Password generator</h3>
                <q-input
                  v-model.number="passwordPreferences.length"
                  outlined
                  type="number"
                  min="6"
                  max="128"
                  label="Password length"
                  @update:model-value="
                    saveSetting(
                      'password_length',
                      String(passwordPreferences.length),
                    )
                  " /><q-toggle
                  v-model="passwordPreferences.letters"
                  label="Use letters"
                  @update:model-value="
                    saveSetting(
                      'use_letters',
                      String(passwordPreferences.letters),
                    )
                  " /><q-toggle
                  v-model="passwordPreferences.numbers"
                  label="Use numbers"
                  @update:model-value="
                    saveSetting(
                      'use_numbers',
                      String(passwordPreferences.numbers),
                    )
                  " /><q-toggle
                  v-model="passwordPreferences.symbols"
                  label="Use symbols"
                  @update:model-value="
                    saveSetting(
                      'use_symbols',
                      String(passwordPreferences.symbols),
                    )
                  " /></q-card-section></q-card
            ><q-card flat bordered
              ><q-card-section
                ><q-expansion-item
                  icon="integration_instructions"
                  label="Bitwarden setup"
                  header-class="q-px-none text-primary"
                >
                  <p>
                    ProxiedMail currently emulates Bitwarden's Addy.io
                    integration. Please ask Bitwarden to add a proper
                    ProxiedMail integration in the
                    <a
                      href="https://github.com/bitwarden/clients/pull/20766"
                      target="_blank"
                      rel="noopener"
                      >ProxiedMail integration request</a
                    >.
                  </p>
                  <ol class="q-pl-lg">
                    <li>
                      In Bitwarden, open <strong>Generator</strong>, choose
                      <strong>Username</strong>, then choose
                      <strong>Forwarded email alias</strong>.
                    </li>
                    <li>
                      In <strong>API key</strong>, enter
                      <code>{{ api.apiToken() }}</code>.
                      <q-btn
                        flat
                        dense
                        round
                        icon="content_copy"
                        aria-label="Copy API key"
                        @click="copy(api.apiToken())"
                      />
                    </li>
                    <li class="q-mt-sm">
                      <q-select
                        v-model="selectedDomain"
                        dense
                        outlined
                        label="Email domain"
                        :options="availableCreateDomains"
                      />
                    </li>
                    <li>
                      In <strong>Self-host server URL</strong>, enter
                      <code>https://proxiedmail.com</code>.
                    </li>
                    <li>
                      Select <strong>Generate</strong> to create the alias in
                      ProxiedMail.
                    </li>
                  </ol>
                  <q-banner dense rounded class="bg-orange-1 text-orange-10">
                    Treat this API key like a password. Anyone who has it can
                    access your ProxiedMail account.
                  </q-banner>
                </q-expansion-item>
                <q-separator class="q-my-lg" />
                <h2>Export configuration</h2>
                <p>
                  Download a portable JSON backup of your proxy addresses and
                  account preferences. Authentication tokens are never included.
                </p>
                <q-btn
                  outline
                  color="primary"
                  icon="download"
                  label="Download JSON"
                  @click="exportConfiguration" /></q-card-section
            ></q-card></div
        ></template> </q-page
    ></q-page-container>
  </q-layout>
  <q-dialog v-model="editDialog"
    ><q-card class="dialog-card"
      ><q-card-section class="row items-center"
        ><div>
          <div class="eyebrow text-primary">EDIT PROXY</div>
          <strong>{{ editBinding?.address }}</strong>
        </div>
        <q-space /><q-btn
          flat
          round
          icon="close"
          v-close-popup /></q-card-section
      ><q-card-section
        ><q-input
          v-model="editDescription"
          outlined
          type="textarea"
          label="Description" /><q-select
          v-model="editRecipients"
          outlined
          multiple
          use-input
          use-chips
          new-value-mode="add-unique"
          :options="emails"
          label="Forward to"
          class="q-mt-md" /><q-expansion-item
          label="Advanced settings"
          class="q-mt-md"
          ><q-input
            v-model="editCallbackUrl"
            outlined
            label="Callback URL"
            class="q-mt-sm" /><q-input
            v-model="editUsedOn"
            outlined
            label="Used on sites"
            hint="Separate sites with commas"
            class="q-mt-md" /><q-input
            v-model="editPassword"
            outlined
            type="password"
            label="Site password"
            class="q-mt-md"
            ><template #append
              ><q-btn
                flat
                dense
                round
                icon="refresh"
                @click="
                  generatePassword
                " /></template></q-input></q-expansion-item></q-card-section
      ><q-card-actions align="between"
        ><q-btn
          color="negative"
          flat
          label="Delete"
          @click="
            editBinding && (deleteProxy(editBinding), (editBinding = null))
          " /><q-btn
          color="primary"
          label="Save changes"
          :loading="busy"
          @click="saveEdit" /></q-card-actions></q-card
  ></q-dialog>
  <q-dialog v-model="contactDialog"
    ><q-card class="dialog-card"
      ><q-card-section class="row items-center"
        ><div>
          <div class="eyebrow text-primary">CONTACTS</div>
          <strong>{{ contactBinding?.address }}</strong>
        </div>
        <q-space /><q-btn
          flat
          round
          icon="close"
          v-close-popup /></q-card-section
      ><q-card-section
        ><q-input
          v-model="contactTarget"
          outlined
          label="Where do you want to send the email?"
          type="email"
          ><template #append
            ><q-btn
              round
              dense
              flat
              icon="add"
              @click="createContact" /></template></q-input
        ><q-list separator class="q-mt-md"
          ><q-item v-for="contact in contacts" :key="contact.id"
            ><q-item-section
              ><q-item-label>{{ contact.reverseProxyAddress }}</q-item-label
              ><q-item-label caption>{{
                contact.recipientEmail
              }}</q-item-label></q-item-section
            ><q-item-section side
              ><q-btn
                flat
                round
                dense
                icon="mail"
                :href="`mailto:${contact.reverseProxyAddress}`" /><q-btn
                flat
                round
                dense
                icon="content_copy"
                @click="
                  copy(contact.reverseProxyAddress, 'Contact address copied.')
                " /></q-item-section></q-item
          ><q-item v-if="!contacts.length"
            ><q-item-section class="text-grey"
              >No contacts created yet.</q-item-section
            ></q-item
          ></q-list
        ></q-card-section
      ></q-card
    ></q-dialog
  >
</template>
