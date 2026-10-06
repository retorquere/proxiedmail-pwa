# ProxiedMail Dashboard

The Quasar app for managing ProxiedMail aliases.

## Development

```sh
npm ci
npm run dev
```

Build for production with:

```sh
npm run build
```

The production output is written to `dist`. Cloudflare deployment uses the root `wrangler.jsonc` and `worker.ts`.
