# ProxiedMail

A Vue 3 PWA for managing [ProxiedMail](https://proxiedmail.com) proxy email addresses — create, edit, enable/disable, and delete proxy bindings directly from a mobile-friendly interface.

## Features

- **List proxy bindings** — enabled entries shown at the top; disabled ones collapsed into a separate expandable section
- **Create & edit** proxy bindings with real address mapping and description
- **Toggle enable/disable** per binding with a single tap
- **Delete with confirmation** — modal with a required "I understand" checkbox before deletion
- **Pull-to-refresh** on mobile
- **PWA** — installable, works offline shell, auto-updates via service worker
- **Auth** — username/password login via the ProxiedMail OAuth flow; token stored in `localStorage`

## Tech stack

| Tool | Purpose |
|---|---|
| [Vue 3](https://vuejs.org/) + TypeScript | UI framework |
| [Vite](https://vite.dev/) | Build tool & dev server |
| [Pinia](https://pinia.vuejs.org/) | State management (auth store) |
| [Vue Router](https://router.vuejs.org/) | Client-side routing |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | PWA manifest & service worker |
| [dprint](https://dprint.dev/) | Code formatting |
| [ESLint](https://eslint.org/) | Linting |

## Project setup

```sh
npm install
```

### Develop

```sh
npm run dev
```

The dev server proxies `/api` requests to `https://proxiedmail.com`, so no CORS issues during development.

### Type-check

```sh
npm run type-check
```

### Lint

```sh
npm run lint
```

Runs `dprint check` (format check) followed by `eslint`.

### Format

```sh
npm run format
```

### Build & preview

```sh
npm run build
npm run preview
```

## Authentication

The app uses a two-step auth flow:

1. `POST /api/v1/auth` with username + password → short-lived OAuth Bearer token
2. `GET /api/v1/api-token` with Bearer token → long-lived API token stored in `localStorage`

All subsequent API calls use the `Token` header.

## API

Proxy bindings are managed via the ProxiedMail REST API. The full OpenAPI spec is in [`proxiedmail.yaml`](proxiedmail.yaml).

Key endpoint: `PATCH /api/v1/proxy-bindings/:id` — `real_addresses` values are plain booleans (`true` = enable, `false` = disable); `proxy_address` must be included in `attributes`.

## Project structure

```
src/
  views/
    HomeView.vue      # Main screen — list, create, edit, delete
    LoginView.vue     # Login form
  components/
    ProxyEmailList.vue  # Proxy binding list with enabled/disabled sections
    ProxyEmailForm.vue  # Create / edit form
  stores/
    auth.ts           # Pinia auth store
  router/
    index.ts          # Routes + auth guard
  types/
    proxy-binding.d.ts
public/
  manifest.json
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
