# ProxiedMail API summary

This is a quick reference for the ProxiedMail API contract in proxiedmail.yaml. It is meant to help with focused lookups without reading the full spec each time.

## 1. High-level model

The product is built around proxy email bindings.

- A proxy binding is one alias such as alias@proxiedmail.com
- It forwards incoming mail to one or more real email addresses
- The main object is the proxy binding record
- The real_addresses field is a map keyed by forwarding email address
- Each entry can carry forwarding state and verification metadata

The important concepts are:

- proxy binding: alias + forwarding targets + metadata
- real email: a user’s actual inbox address that receives forwarded mail
- contact: a recipient tied to a binding with a reverse proxy address
- callback: webhook payload for inbound mail events
- settings: key/value frontend preferences
- domain: selectable domain for proxy creation

## 2. Auth model

The API uses a two-step token flow:

1. POST /api/v1/auth
   - body contains username and password
   - returns OAuth bearer token
2. Use Bearer token to call GET /api/v1/api-token
   - returns long-lived API token
3. Use long-lived token in the Token header for most API calls

Auth headers:

- Bearer token: for /api/v1/auth and token-exchange auth calls
- Token header: for most /api/v1 and /gapi requests

## 3. Core endpoints

### Proxy bindings

- GET /api/v1/proxy-bindings
  - list all proxy bindings
  - includes quota metadata in meta:
    - usedProxyBindings
    - availableProxyBindings
- POST /api/v1/proxy-bindings
  - create a new binding
- PATCH /api/v1/proxy-bindings/{id}
  - update binding and recipient state
- DELETE /api/v1/proxy-bindings/{id}
  - delete binding

Important update behavior:

- real_addresses is an object keyed by email, not an array
- values are usually objects with is_enabled
- proxy_address and id must be included when changing real_addresses

### Received mail

- GET /api/v1/received-emails-links/{proxyBindingId}
  - list recent received email links for a binding
  - only meaningful when the binding is browsable
- GET /api/v1/received-emails/{receivedEmailId}
  - fetch full email payload, headers, HTML/plain text, attachments

Important constraint:

- The binding must have is_browsable = true for message retrieval to work

### Contacts

- GET /api/v1/proxy-bindings/{bindingId}/contacts
  - list contacts for a binding
- POST /api/v1/contacts
  - create a contact linked to a binding

### Callback webhooks

- POST /api/v1/callback
  - register callback URL
- GET /api/v1/callback/get/{hash}
  - retrieve callback payload by hash

### User/account

- POST /api/v1/users
  - register new user
- GET /api/v1/users/me
  - current profile and plan metadata
- POST /api/v1/resend-confirmation
  - resend confirmation email

## 4. Frontend helper endpoints (/gapi)

These are dashboard/account support endpoints and are especially important for the app UI.

### Domains

- GET /gapi/available-domains
  - list domains available for new proxy creation
- GET /gapi/custom-domains
  - list user custom domains

### Real emails and verification

- GET /gapi/real-emails
  - list real forwarding emails
- GET /gapi/verified-emails-list
  - list verified emails exposed to the frontend

### Password and site metadata

- GET /gapi/passwords
  - list saved proxy-binding passwords
- PATCH /gapi/passwords/proxy-binding
  - set a password for a proxy binding
- GET /gapi/used-on
  - list website/service labels associated with bindings
- PATCH /gapi/used-on
  - save website/service labels for a binding

### Settings

- GET /gapi/settings
  - read frontend settings as key/value pairs
- PATCH /gapi/settings/update
  - update frontend settings

### Reverse lookup

- GET /gapi/proxy-binding/reverse-lookup
  - resolve reverse proxy address back to binding info

## 5. Key request/response semantics

### Proxy binding payload shape

A binding is roughly:

- id
- type: proxy_bindings
- attributes:
  - proxy_address
  - real_addresses
  - is_browsable
  - received_emails
  - description
  - callback_url
  - wildcard_auto_create
  - created_at
  - updated_at

### real_addresses semantics

This is the critical field for enabling/disabling forwarding.

- It is a JSON object map
- Example conceptually:

  {
    "user@example.com": {
      "is_enabled": true
    }
  }

This is how the API expresses enabling or disabling a forwarding address.

### Bulk replacement

- POST /api/v1/emails/replace
  - replaces one real email address with another across the user’s bindings
- Body includes oldEmail and newEmail

### Contact payload

A contact includes:

- recipient_email
- reverse_proxy_address
- relationship to proxy binding

## 6. Important implementation notes

- Quota values come from response metadata, not from a hardcoded limit
- Search/filtering and list logic are mostly frontend behavior layered on top of the API
- The app must treat message HTML as untrusted and isolate/sanitize it before rendering
- Callback URLs and password metadata are advanced optional features
- The frontend settings API is generic and does not fully define every setting key up front

## 7. Best quick lookup map

If you need to answer a question quickly, these are the most likely targets:

- Need a proxy list or quota: /api/v1/proxy-bindings
- Need to create or update a proxy: /api/v1/proxy-bindings
- Need to toggle forwarding recipient: PATCH /api/v1/proxy-bindings/{id}
- Need contacts for a binding: /api/v1/proxy-bindings/{bindingId}/contacts
- Need message links: /api/v1/received-emails-links/{proxyBindingId}
- Need full message: /api/v1/received-emails/{receivedEmailId}
- Need callback registration: /api/v1/callback
- Need user profile: /api/v1/users/me
- Need domains: /gapi/available-domains and /gapi/custom-domains
- Need app settings: /gapi/settings and /gapi/settings/update
- Need replace forwarding target globally: /api/v1/emails/replace

## 8. Short version

The app revolves around one primary resource: proxy bindings.

Everything else is built around that resource:

- create and delete bindings
- update forwarding recipients
- view received mail for browsable bindings
- review contacts and callback data
- configure domains, password storage, and frontend settings

This is the main contract to keep in mind during targeted implementation work.
