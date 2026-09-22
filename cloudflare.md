# Cloudflare Deployment

This project should be deployed as a Cloudflare Worker with static assets and
an API proxy. The current Cloudflare dashboard's **Continue to Pages** option
is the legacy Pages workflow and is not needed.

The recommended production layout is:

```text
https://mailroom.example.com       Worker static assets and API proxy
                                   Worker -> https://proxiedmail.com
```

Replace `example.com` with the domain used for the deployment.

## Prerequisites

The frontend uses relative API paths such as `/api/v1/auth` and
`/gapi/settings`. Keep these paths unchanged: the Worker serves the frontend
and proxies those paths on the same hostname, so production does not need a
separate API domain or browser CORS configuration.

For local development, Vite continues to proxy these paths to
`https://proxiedmail.com`.

The Worker must be deployed before testing the production frontend.

## Add the domain to Cloudflare

1. Open the Cloudflare dashboard.
2. Select **Websites** and choose **Add a site**.
3. Enter the domain and select a plan.
4. If the domain is registered elsewhere, change its nameservers to the ones
   Cloudflare provides.
5. Wait until the zone status is **Active**.

Cloudflare will manage DNS and TLS for the Worker hostname below.

## Open the Workers and Pages area

From the Cloudflare account dashboard, open **Build > Compute > Workers & Pages**:

```text
https://dash.cloudflare.com/?to=/:account/workers-and-pages
```

From there, select **Create application**.

## Create the Worker application

1. Open **Build > Compute > Workers & Pages**.
2. Select **Create application**.
3. Choose **Continue with GitHub**.
4. Authorize GitHub and select this repository.
5. Configure the build form as follows:

   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Preview command: `npx wrangler preview`
   - Enable preview builds: on
   - Protect with Cloudflare Access: off
   - Path: `/`
   - API token: choose **Create new token**
   - API token name: `proxiedmail-pwa-builds`
   - Variable name/value: leave blank

6. Save and deploy.

The build runs `compile:pug` first. It creates the generated files in `gen/`,
then Vite writes the static assets to `dist/`. The repository's `wrangler.jsonc`
configures `dist/` as static assets, and `worker.ts` serves those assets while
proxying the API paths. The current `server.js` remains local Express
development tooling only.

## Redeploy after GitHub changes

Deployment is automatic after the GitHub connection is set up. To publish new
code:

1. Make and test the changes locally.
2. Commit them to Git.
3. Push the commit to the repository's default branch.

```sh
git add -A
git commit -m "Describe the change"
git push origin main
```

Cloudflare detects the push, runs `npm run build`, and then runs
`npx wrangler deploy`. The new deployment becomes production if the push was
to the default branch.

With preview builds enabled, pushes to other branches run `npx wrangler
preview` and create or update a preview deployment instead. They do not replace
the production deployment.

After the first deployment, add `mailroom.example.com` under the Worker
application's **Settings > Domains & Routes > Custom Domains**.

No additional Worker routing, proxy, or CORS settings are required in the
dashboard. They are implemented in `worker.ts`: it serves `dist/`, proxies
`/api/v1/*` and `/gapi/*` to `https://proxiedmail.com`, and handles the API
request headers and `OPTIONS` responses. The dashboard's same-origin setup
does not require an `ALLOWED_ORIGIN` variable or any ProxiedMail API secret.

## Add the Worker hostname

1. Open the Worker.
2. Go to **Settings > Domains & Routes**.
3. Select **Add Custom Domain**.
4. Add `mailroom.example.com`.
5. Let Cloudflare create the DNS record and certificate.

The final request flow should be:

```text
Browser -> mailroom.example.com       -> Worker static assets
Browser -> mailroom.example.com/api/v1/* -> Worker -> proxiedmail.com
Browser -> mailroom.example.com/gapi/*   -> Worker -> proxiedmail.com
```

## Verify the deployment

Check the following after deployment:

1. `https://mailroom.example.com` loads the dashboard.
2. `https://mailroom.example.com/manifest.webmanifest` is reachable.
3. `https://mailroom.example.com/sw.js` is reachable.
4. Login reaches `https://mailroom.example.com/api/v1/auth`.
5. `GET`, `POST`, `PATCH`, and `DELETE` API operations work through the Worker.

The Worker deploys `dist/`; `gen/` contains build-time generated source and
HTML and should remain ignored by Git.