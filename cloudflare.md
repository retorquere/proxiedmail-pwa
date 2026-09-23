# Cloudflare Deployment

This project deploys as a Cloudflare Worker with static Flutter Web assets and a same-origin API proxy. The Worker is required in production: it serves the dashboard and forwards the documented API paths to ProxiedMail.

```text
https://mailroom.example.com              Worker -> Flutter static assets
https://mailroom.example.com/api/v1/*     Worker -> https://proxiedmail.com/api/v1/*
https://mailroom.example.com/gapi/*       Worker -> https://proxiedmail.com/gapi/*
```

Replace `mailroom.example.com` with the hostname used for the deployment.

## Files and responsibilities

- `lib/`: Flutter application source.
- `web/`: Flutter Web entrypoint, manifest, and icons.
- `build/web/`: generated static Flutter output. This is the directory deployed by Wrangler.
- `worker.ts`: production Worker. It proxies `/api/v1/*` and `/gapi/*`, handles preflight requests, forwards authentication headers, and serves all other requests through the static asset binding.
- `wrangler.jsonc`: Worker name, compatibility date, and `build/web` asset binding.
- `server.js`: local Express server. It provides the same API proxy behavior for local static preview and is not required in production.
- `package.json`: local build, preview, and deployment commands.

The Worker is not optional production plumbing. Flutter Web is a static client, and the Worker provides the same-origin production API route and proxy boundary.

## Prerequisites

Install and authenticate both tools:

- Flutter stable SDK
- Node.js and npm
- Wrangler, installed through the project dependencies
- A Cloudflare account with permission to deploy Workers

Verify the local tools:

```sh
flutter --version
npm --version
npx wrangler whoami
```

## Build locally

Install JavaScript proxy/deployment dependencies and Dart dependencies:

```sh
npm install
flutter pub get
```

Run validation:

```sh
flutter analyze
flutter test
```

Build the static Flutter app:

```sh
npm run build
```

This runs `flutter build web` and writes the deployable site to `build/web`.

## Local preview and API proxy

For local development, start the Node server:

```sh
npm start
```

The server listens at `http://127.0.0.1:4173` by default. Set `PORT` to choose another port:

```sh
PORT=5173 npm start
```

The local server:

1. Proxies `/api/v1/*` to `https://proxiedmail.com/api/v1/*`.
2. Proxies `/gapi/*` to `https://proxiedmail.com/gapi/*`.
3. Serves the compiled Flutter files from `build/web`.
4. Returns the Flutter entrypoint for browser navigation requests.

The Flutter client must continue using relative paths such as `/api/v1/auth` and `/gapi/settings`. Do not change them to a development-only hostname.

## Worker configuration

`wrangler.jsonc` points Wrangler at the Flutter output:

```jsonc
{
  "main": "worker.ts",
  "assets": {
    "directory": "./build/web",
    "not_found_handling": "single-page-application"
  }
}
```

`worker.ts` handles API requests before static assets. For API paths it:

- Handles `OPTIONS` preflight requests.
- Forwards `Accept`, `Content-Type`, `Authorization`, and `Token` headers.
- Preserves the HTTP method, request body, and query string.
- Proxies to `https://proxiedmail.com`.
- Returns the upstream status, status text, body, and response headers.
- Adds the configured CORS response headers.

For every other path it calls the Cloudflare `ASSETS` binding, which serves the compiled Flutter application.

## Deploy manually

Build and deploy from the repository root:

```sh
npm run build
npx wrangler deploy
```

The `deploy` script performs both steps:

```sh
npm run deploy
```

Do not deploy `dist/`, `public/`, `web/`, or the Flutter source directory as the Worker asset directory. Wrangler must deploy `build/web`.

## GitHub Actions artifact branch

Deployment is split into two existing systems: GitHub Actions builds the Flutter artifact, and the existing Cloudflare GitHub integration deploys that artifact. The Action is defined in `.github/workflows/deploy.yml`. Pushes to `main` and manual workflow runs:

1. Install the pinned Flutter stable SDK (`3.47.5`).
2. Install npm and Dart dependencies.
3. Run `flutter analyze` and `flutter test`.
4. Run `npm run build`, which produces `build/web`.
5. Commit the generated `build/web` files to the `cloudflare` branch.

Add these repository secrets under **Settings > Secrets and variables > Actions**:

No Cloudflare secrets are required by the Action. Its GitHub token only needs permission to write the generated branch, which is provided by the workflow's `contents: write` permission.

Configure the existing Cloudflare GitHub integration to watch the `cloudflare` branch. It should deploy the checked-in `build/web` directory using the existing `worker.ts` and `wrangler.jsonc` configuration. Set the Cloudflare build command to a no-op such as `true` (or leave it empty if supported), because GitHub Actions has already compiled Flutter. Set the asset/output directory to `build/web` if Cloudflare asks for one.

Do not point Cloudflare at `main` for deployment: `main` contains Flutter source and intentionally does not commit `build/web`. Do not add a second direct Wrangler deployment from GitHub Actions, or pushes will produce competing deployments.

## Add a custom domain

1. Open Cloudflare Workers & Pages.
2. Select the Worker created by Wrangler.
3. Open **Settings > Domains & Routes**.
4. Select **Add Custom Domain**.
5. Add the production hostname, such as `mailroom.example.com`.
6. Allow Cloudflare to create the DNS record and certificate.

The expected production request flow is:

```text
Browser -> mailroom.example.com
       -> worker.ts
       -> ASSETS for Flutter files

Browser -> mailroom.example.com/api/v1/*
       -> worker.ts
       -> proxiedmail.com/api/v1/*

Browser -> mailroom.example.com/gapi/*
       -> worker.ts
       -> proxiedmail.com/gapi/*
```

No separate API domain, browser CORS configuration, dashboard backend, or production Express server is required.

## Verify deployment

After deployment, verify:

1. The root URL loads the Flutter application.
2. The Flutter manifest is reachable at `/manifest.json`.
3. Flutter service-worker assets are reachable from the root output.
4. `OPTIONS /api/v1/auth` returns a successful preflight response.
5. `POST /api/v1/auth` reaches `https://proxiedmail.com` through the Worker.
6. `GET`, `POST`, `PATCH`, and `DELETE` resource requests preserve their methods and bodies.
7. Both `Authorization: Bearer ...` and `Token: ...` headers reach the upstream API as required.
8. Refreshing a browser route still returns the Flutter application shell.
9. Authenticated API responses are not cached as current application data.

Useful commands:

```sh
npx wrangler tail
npx wrangler deployments list
npx wrangler whoami
```

Do not commit API tokens or Cloudflare credentials. The Worker only needs to proxy the user's request credentials; it does not require a ProxiedMail API secret.
