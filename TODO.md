# TODO

1. Add account confirmation flows, including resend-confirmation handling and explicit confirmed/unconfirmed user states in the auth and dashboard experience.
3. Create a dedicated proxy detail screen that surfaces forwarding recipients, contacts, and proxy-level actions without relying on the dashboard list alone.
6. Extend settings support to cover account defaults, token-backed app settings, retention options, and the remaining ProxiedMail /gapi settings keys needed for mailbox and domain behavior.
7. Improve offline, partial-load, and error-state handling for dashboard, settings, and per-proxy mutations so API failures surface actionable messages without silently succeeding.
8. Enforce a service-worker cache policy that prevents authenticated ProxiedMail API responses from being cached as fresh data while the app is deployed as a static PWA.
10. Add responsive layout validation across mobile and desktop viewports to ensure the dashboard, proxy editor, and action controls remain usable without horizontal scrolling or clipped content.

These are the remaining API-backed gaps that are consistent with the functional specification and the ProxiedMail service contract.
