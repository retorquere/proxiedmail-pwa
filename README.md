# ProxiedMail

A Vue 3 PWA for managing [ProxiedMail](https://proxiedmail.com) proxy email addresses — create, edit, enable/disable, and delete proxy bindings directly from a mobile-friendly interface. Deployed to Cloudflare Pages with serverless Functions that also expose an addy.io-compatible API and a JMAP Contacts interface.

## Features

### Web app
- **List proxy bindings** — enabled entries shown at the top; disabled ones collapsed into a separate expandable section
- **Create & edit** proxy bindings with real address mapping and description
- **Toggle enable/disable** per binding with a single tap
- **Delete with confirmation** — modal with a required "I understand" checkbox before deletion
- **Contact list** — view contacts associated with each proxy binding
- **Pull-to-refresh** on mobile
- **PWA** — installable, works offline shell, auto-updates via service worker
- **Dark mode** — toggleable theme persisted to `localStorage`
- **Localisation** — English and Dutch (Nederlands) via vue-i18n
- **Auth** — username/password login via the ProxiedMail OAuth flow; token stored in `localStorage`

### Cloudflare Pages Functions
- **API proxy** (`/api/*`) — transparently forwards all requests to `https://proxiedmail.com`, so the SPA never hits CORS
- **addy.io-compatible alias creation** (`/addy.io`) — `POST` endpoint that generates a human-readable `given.surname@<domain>` alias using a Markov-chain name model and creates it as a ProxiedMail proxy binding; compatible with tools that support the addy.io API
- **JMAP Contacts** (`/jmap/session`, `/jmap/api`) — read-only JMAP/JSContact server that surfaces proxy bindings as an *address book*, enabling native contact-book sync (e.g. macOS/iOS Contacts, Thunderbird) directly against your ProxiedMail account

## Tech stack

| Tool | Purpose |
|---|---|
| [Vue 3](https://vuejs.org/) + TypeScript | UI framework |
| [Vite](https://vite.dev/) | Build tool & dev server |
| [Pinia](https://pinia.vuejs.org/) | State management (auth, theme, locale) |
| [Vue Router](https://router.vuejs.org/) | Client-side routing |
| [vue-i18n](https://vue-i18n.intlify.dev/) | Internationalisation (en / nl) |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | PWA manifest & service worker |
| [Cloudflare Pages](https://pages.cloudflare.com/) | Hosting + serverless Functions |
| [dprint](https://dprint.dev/) | Code formatting |
| [ESLint](https://eslint.org/) | Linting |

## Project setup

**Requirements:** Node.js `^20.19.0` or `>=22.12.0`

```sh
npm install
```

### Develop

```sh
npm run dev
```

The Vite dev server proxies `/api` requests to `https://proxiedmail.com`, so there are no CORS issues during development. The Cloudflare Pages Functions (`/addy.io`, `/jmap/*`) are not active in Vite dev mode — use `wrangler pages dev` (see below) to test them locally.

To test Functions locally with Wrangler:

```sh
npm run build-only
npx wrangler pages dev dist
```

### Type-check

```sh
npm run type-check
```

### Lint

```sh
npm run lint
```

Runs `dprint check` (format check) followed by `eslint --fix`.

### Format

```sh
npm run format
```

### Build & preview

```sh
npm run build       # type-check + vite build
npm run preview     # vite build then serve locally
```

## Cloudflare setup & deployment

### Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. Wrangler CLI — already installed as a dev dependency:
   ```sh
   npx wrangler --version
   ```
3. Log in to Cloudflare:
   ```sh
   npx wrangler login
   ```

### Create the Pages project (first time only)

```sh
npx wrangler pages project create proxiedmail-pwa
```

Use **`dist`** as the build output directory when prompted, or set it in the Cloudflare dashboard under **Pages → proxiedmail-pwa → Settings → Builds & deployments → Build output directory**.

### Deploy

```sh
npm run deploy
```

This runs `npm run build` followed by:

```sh
npx wrangler pages deploy dist --project-name proxiedmail-pwa
```

Wrangler uploads the `dist/` bundle and all `functions/` to Cloudflare Pages and prints the deployment URL.

### Production domain

After the first deploy, go to **Cloudflare Dashboard → Pages → proxiedmail-pwa → Custom domains** to attach your own domain (e.g. `app.proxiedmail.com`). Cloudflare automatically provisions a TLS certificate.

### Environment variables

No environment variables are required — the upstream URL (`https://proxiedmail.com`) and all other constants are hardcoded in the Functions source. If you need to override the upstream in a preview deployment, set a `UPSTREAM` variable in the Cloudflare Pages dashboard under **Settings → Environment variables** (you would then need to read it via `context.env` in the Functions).

### Wrangler config

The [`wrangler.toml`](wrangler.toml) at the repo root contains the minimal Pages configuration:

```toml
name = "proxiedmail"
pages_build_output_dir = "dist"
compatibility_date = "2025-01-01"
```

## Authentication

The app uses a two-step auth flow:

1. `POST /api/v1/auth` with `username` + `password` → short-lived OAuth Bearer token
2. `GET /api/v1/api-token` with Bearer token → long-lived API token stored in `localStorage`

All subsequent API calls use the `Token` header.

## API

### ProxiedMail REST API

Proxy bindings are managed via the ProxiedMail REST API. The full OpenAPI spec is in [`proxiedmail.yaml`](proxiedmail.yaml).

Key endpoint: `PATCH /api/v1/proxy-bindings/:id` — `real_addresses` values are plain booleans (`true` = enable, `false` = disable); `proxy_address` must be included in `attributes`.

### addy.io-compatible alias endpoint

```
POST /addy.io
Authorization: Bearer <api-token>
Content-Type: application/json

{ "domain": "pdxmail.net", "description": "optional label" }
```

Returns:

```json
{
  "data": {
    "local_part": "emma.johnson",
    "domain": "pdxmail.net",
    "email": "emma.johnson@pdxmail.net",
    "active": true
  }
}
```

The local part is generated from a Markov-chain model trained on US baby name data (see `src/utils/generate.ts` and `names/`). Valid domains are `pdxmail.net`, `pdxmail.com`, `proxiedmail.com`, plus any custom domains on your account. The real address is inferred from your existing proxy bindings.

### JMAP Contacts

The JMAP interface lets standard contact-book clients (macOS Contacts, iOS Contacts, Thunderbird, …) sync your ProxiedMail proxy bindings as a contact address book.

| Endpoint | Description |
|---|---|
| `GET /jmap/session` | JMAP Session resource (capabilities, API URL) |
| `POST /jmap/api` | JMAP API endpoint — accepts `Core/echo`, `AddressBook/get`, `ContactCard/get`, `ContactCard/query` |

**Two address books are exposed:**

| id | Name | Contents |
|---|---|---|
| `ab-proxies` | Proxies | One JSContact Card per proxy binding; proxy address + all forwarding addresses as email entries |
| `ab-contacts` | Contacts | One JSContact Card per contact on each proxy binding |

**macOS/iOS Contacts setup:**

1. Open **Contacts → Preferences → Accounts → Add account → Other → Add a CardDAV account** — or use **Settings → Contacts → Accounts** on iOS.
2. Select **Advanced** / **Manual** and enter:
   - **Server URL:** `https://<your-pages-domain>/jmap/session`
   - **User name:** anything (e.g. `me`)
   - **Password:** your ProxiedMail API token

> Note: macOS Contacts expects CardDAV, not raw JMAP. For native JMAP client support use a client such as [Thunderbird](https://www.thunderbird.net/) with its JMAP address book feature.

## Project structure

```
src/
  views/
    HomeView.vue        # Main screen — list, create, edit, delete proxy bindings
    LoginView.vue       # Login form
  components/
    ProxyEmailList.vue  # Proxy binding list with enabled/disabled sections
    ProxyEmailForm.vue  # Create / edit form
    ContactList.vue     # Contacts per proxy binding
    SettingsMenu.vue    # Language switcher + sign-out
  stores/
    auth.ts             # Pinia auth store
    theme.ts            # Dark/light mode store
    locale.ts           # Locale store
  router/
    index.ts            # Routes + auth guard
  utils/
    api.ts              # Typed wrappers around the ProxiedMail REST API
    generate.ts         # Markov-chain name generator (used by addy.io Function)
  i18n/
    locales/en.json     # English strings
    locales/nl.json     # Dutch strings
  types/
    proxy-binding.d.ts
functions/
  api/[[path]].ts       # Transparent reverse proxy → proxiedmail.com
  addy.io/[[path]].ts   # addy.io-compatible alias creation endpoint
  jmap/
    session.ts          # JMAP Session resource
    api.ts              # JMAP API — AddressBook/get, ContactCard/get, ContactCard/query
public/
  manifest.json         # PWA manifest
  service-worker.js     # Custom service worker additions
```
  service-worker.js
proxiedmail.yaml      # OpenAPI spec
```


## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
