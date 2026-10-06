# Functional Specification PWA for ProxiedMail

## 1. Product overview

The ProxiedMail PWA is a client for the ProxiedMail email-proxy service. Its core purpose is to help users protect their primary inbox by creating masked email proxies that can be used for signups, newsletters, online services, and other communication channels without exposing their real email address.

The app allows users to:

- create and manage disposable or reusable email proxies;
- route incoming messages to one or more mailboxes;
- manage verified mailboxes and view custom domains;
- configure proxy behavior and preferences;
- review proxy activity, contacts, and usage details;

## 2. Primary users

- People who want to avoid sharing their real email address online.
- Users who already maintain a ProxiedMail account and want a mobile interface for daily management.

## 3. Core functionality

### 3.1 Authentication and session management

The app supports the following authentication flows:

- Sign in with an API key

After login, the app stores the session and presents the user with the main proxy-management interface. The user can also sign out from the app when needed.

### 3.2 Proxy dashboard and overview

The home screen displays a list of proxies associated with the logged-in account. It supports:

- searching proxies by name or email pattern;
- filtering the list by proxy mode using the app’s filter menu (all, pinned, active, and inactive proxies);
- quick enable/disable toggling;
- pinning or unpinning proxies for prioritization;
- reviewing proxy metadata such as mailbox assignment and activity status;
- creating a new proxy from the home workflow.

The home interface is designed to let users browse and act on proxies rapidly without leaving the list view, and the filter menu makes it easy to focus on specific proxy groups rather than relying on tabbed navigation.

### 3.3 Proxy creation

Users can create new proxies from the app using a dedicated creation screen. Supported actions include:

- entering a custom proxy prefix (local part of the proxy email address);
- selecting a default/random proxy configuration;
- picking the mailboxes that should receive forwarded messages;
- entering an optional note associated with the proxy;
- validating prefix constraints before creation;
- creating the proxy and returning to the proxy list.

The creation flow supports both custom proxy patterns and random proxy generation. In device settings, users can configure default creation preferences such as:

- default prefix mode;
- random character count;
- whether to copy the proxy after creation;
- whether to prompt for a random proxy note.

### 3.4 Proxy detail management

Each proxy has a detail screen with deeper controls. Users can:

- view the full proxy email address;
- edit the proxy note;
- update the mailboxes assigned to the proxy;
- review recent proxy activity;
- view contacts associated with the proxy;
- perform specific proxy actions such as copying, editing, or related operations depending on the proxy workflow.

The app also supports refresh and state updates from the server, so proxy details remain current.

### 3.5 Contacts and activity tracking

For every proxy, the app supports:

- viewing a list of proxy contacts;
- copying reverse proxies in different formats;
- composing a new email to a contact by launching the default email client with the contact's reverse-proxy address prefilled in the To field;
- seeing actions such as message forwarding events or related proxy activity details.

This is useful for understanding how a proxy is being used and for quickly copying needed addresses in communication workflows.

### 3.6 Mailbox management

Users can manage their mailboxes from a dedicated Mailboxes screen. Supported functionality includes:

- listing all mailboxes;
- adding a new mailbox email address;
- verifying mailbox ownership when required;
- setting a mailbox as the default mailbox;
- deleting a mailbox when appropriate;
- handling mailbox transfer/removal logic when deleting a mailbox that is still connected to proxies.

The app clearly shows mailbox verification and default status so users know which addresses are valid and active.

### 3.7 Custom domain management

The app supports full custom-domain management for users who own their own domains. Features include:

- listing configured custom domains;
- checking how many proxies are attached to each domain;
- opening domain detail screens;

This allows users to manage personal email infrastructure from the mobile app without relying solely on the web client.

### 3.8 Account settings

The Account Settings screen allows users to manage profile and account-level preferences, including:

- toggling notifications;
- selecting random proxy generation mode;
- selecting the default usable domain for generated proxies;
- choosing sender format preferences;
- managing default proxy generation behavior for the account.

This area centralizes the account-level personalization settings that affect how proxies are created and used.

### 3.9 App behavior and user experience features

The app also includes several quality-of-life behaviors:

- adaptive layouts for phone/tablet screens;
- pull-to-refresh for data-heavy screens;
- dialogs for account settings, mailbox management, and proxy creation;
- loading and error states with retry actions;
- snackbars for confirmation messages and update notifications;
- different interaction modes for proxy options depending on device preference settings.

## 4. High-level user journeys

### 4.1 Create and use a protected proxy

1. Sign in to the app.
2. Open the proxy dashboard.
3. Create a new proxy with a chosen prefix and mailbox assignment.
4. Copy the generated proxy and use it where needed.
5. Receive forwarded mail in the configured mailbox.
6. Review activity and contacts for that proxy when needed.

### 4.2 Manage mailboxes and forwarding

1. Open Mailboxes.
2. Add a mailbox address.
3. Verify the mailbox if required.
4. Set the default mailbox.
5. Remove or update mailboxes as the user’s forwarding setup changes.

### 4.3 Personalize settings

1. Configure defaults for proxy generation and user experience.

## 5. Functional summary

In summary, the app provides a complete mobile workflow for managing a ProxiedMail account, including:

- proxy search, filtering, creation, and lifecycle management;
- mailbox and custom-domain administration;
- activity/contact monitoring;
- account and device personalization;
- strong privacy-focused email protection controls.

The product is fundamentally a privacy-preserving email relay manager delivered as a mobile client for ProxiedMail users.
