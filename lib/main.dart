import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'navigation.dart';
import 'l10n/app_localizations.dart';

void main() => runApp(const ProxiedMailApp());

class ProxiedMailApp extends StatelessWidget {
  const ProxiedMailApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: const ColorScheme.light(
            primary: Color(0xff4169ef),
            onPrimary: Colors.white,
            primaryContainer: Color(0xffdce5ff),
            onPrimaryContainer: Color(0xff10245d),
            secondary: Color(0xff315fcf),
            onSecondary: Colors.white,
            secondaryContainer: Color(0xffdce5ff),
            onSecondaryContainer: Color(0xff10245d),
            surface: Color(0xfff8faff),
            onSurface: Color(0xff1b1b1f),
          ),
          scaffoldBackgroundColor: Color(0xfff8faff),
          appBarTheme: AppBarTheme(backgroundColor: Colors.white, foregroundColor: Color(0xff1b1b1f)),
        ),
        home: const AppEntry(),
      );
}

class AppEntry extends StatefulWidget {
  const AppEntry({super.key});

  @override
  State<AppEntry> createState() => _AppEntryState();
}

class _AppEntryState extends State<AppEntry> {
  final api = ProxiedMailApi();
  DashboardData? data;
  String? error;
  bool booting = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    await api.loadStoredTokens();
    if (api.apiToken != null && api.apiToken!.isNotEmpty) {
      try {
        data = await api.dashboard();
      } catch (_) {
        await api.clearStoredTokens();
        redirectToLogin();
      }
    } else {
      redirectToLogin();
    }
    if (mounted) setState(() => booting = false);
  }

  Future<void> signedIn() async {
    try {
      final result = await api.dashboard();
      if (mounted) setState(() => data = result);
    } catch (exception) {
      if (mounted) setState(() => error = exception.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> signedOut() async {
    await api.clearStoredTokens();
    redirectToLogin();
  }

  @override
  Widget build(BuildContext context) {
    if (booting) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (data == null) return const SizedBox.shrink();
    return DashboardScreen(api: api, data: data!, onRefresh: signedIn, onLogout: signedOut);
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({required this.api, required this.onSignedIn, required this.error, super.key});

  final ProxiedMailApi api;
  final Future<void> Function() onSignedIn;
  final String? error;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final formKey = GlobalKey<FormState>();
  final username = TextEditingController();
  final password = TextEditingController();
  bool registering = false;
  bool busy = false;
  String? message;

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      if (registering) {
        await widget.api.register(username.text, password.text);
        setState(() { registering = false; message = 'Account created. Sign in to continue.'; });
      } else {
        await widget.api.login(username.text, password.text);
        TextInput.finishAutofillContext(shouldSave: true);
        await widget.onSignedIn();
      }
    } catch (exception) {
      setState(() => message = exception.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Card(
              margin: const EdgeInsets.all(24),
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Form(
                  key: formKey,
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    const Icon(Icons.alternate_email, size: 42),
                    const SizedBox(height: 20),
                    Text(registering ? l10n.createAccountTitle : l10n.welcome, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    Text(registering ? l10n.startManaging : l10n.manageAliases),
                    const SizedBox(height: 24),
                    if (message != null || widget.error != null) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text(message ?? widget.error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
                    AutofillGroup(
                      child: Column(children: [
                        TextFormField(controller: username, autofillHints: registering ? const [AutofillHints.newUsername, AutofillHints.email] : const [AutofillHints.username, AutofillHints.email], keyboardType: TextInputType.emailAddress, textInputAction: TextInputAction.next, decoration: InputDecoration(labelText: l10n.email, prefixIcon: const Icon(Icons.email_outlined)), validator: (value) => value == null || value.isEmpty ? l10n.enterEmail : null),
                        const SizedBox(height: 16),
                        TextFormField(controller: password, autofillHints: registering ? const [AutofillHints.newPassword] : const [AutofillHints.password], obscureText: true, textInputAction: TextInputAction.done, onEditingComplete: submit, decoration: InputDecoration(labelText: l10n.password, prefixIcon: const Icon(Icons.lock_outline)), validator: (value) => value == null || value.length < 8 ? l10n.passwordLength : null),
                      ]),
                    ),
                    const SizedBox(height: 24),
                    FilledButton.icon(onPressed: busy ? null : submit, icon: busy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.arrow_forward), label: Text(registering ? l10n.createAccount : l10n.signIn)),
                    TextButton(onPressed: busy ? null : () => setState(() { registering = !registering; message = null; }), child: Text(registering ? l10n.alreadyAccount : l10n.needAccount)),
                  ]),
                ),
              ),
            ),
          ),
        ),
        );
      }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({required this.api, required this.data, required this.onRefresh, required this.onLogout, super.key});

  final ProxiedMailApi api;
  final DashboardData data;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final search = TextEditingController();
  final forwardingOverrides = <String, bool>{};
  final forwardingBusy = <String>{};
  int destination = 0;
  bool showHero = true;
  String get query => search.text.toLowerCase();

  @override
  void initState() {
    super.initState();
    _loadHeroPreference();
  }

  Future<void> _loadHeroPreference() async {
    final preferences = await SharedPreferences.getInstance();
    if (mounted) setState(() => showHero = !(preferences.getBool('proxiedmail.hideDashboardHero') ?? false));
  }

  Future<void> _dismissHero() async {
    setState(() => showHero = false);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('proxiedmail.hideDashboardHero', true);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final matches = widget.data.bindings.where((binding) => '${binding.address} ${binding.description}'.toLowerCase().contains(query)).toList();
    return LayoutBuilder(builder: (context, constraints) {
      final compact = constraints.maxWidth < 760;
      final narrow = constraints.maxWidth < 600;
      final navigation = NavigationRail(selectedIndex: destination, onDestinationSelected: (value) => setState(() => destination = value), labelType: NavigationRailLabelType.all, destinations: [NavigationRailDestination(icon: const Icon(Icons.inbox_outlined), selectedIcon: const Icon(Icons.inbox), label: Text(l10n.proxies)), NavigationRailDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: Text(l10n.settings))]);
      final content = destination == 0 ? _dashboard(context, matches, narrow) : Center(child: Text(l10n.settingsPlaceholder));
      return Scaffold(appBar: AppBar(backgroundColor: const Color(0xff4169ef), foregroundColor: Colors.white, title: Text(l10n.appTitle), actions: [IconButton(onPressed: widget.onRefresh, tooltip: l10n.refresh, icon: const Icon(Icons.refresh)), IconButton(onPressed: widget.onLogout, tooltip: l10n.signOut, icon: const Icon(Icons.logout)), const Padding(padding: EdgeInsets.only(right: 16), child: CircleAvatar(backgroundColor: Color(0xffdce5ff), child: Padding(padding: EdgeInsets.all(7), child: Image(image: NetworkImage('/images/v2/favicons/favicon-32x32.png'))))) ]), bottomNavigationBar: compact ? NavigationBar(selectedIndex: destination, onDestinationSelected: (value) => setState(() => destination = value), destinations: [NavigationDestination(icon: const Icon(Icons.inbox_outlined), selectedIcon: const Icon(Icons.inbox), label: l10n.proxies), NavigationDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: l10n.settings)]) : null, body: compact ? content : Row(children: [navigation, const VerticalDivider(width: 1), Expanded(child: content)]));
    });
  }

  Widget _dashboard(BuildContext context, List<ProxyBinding> matches, bool narrow) {
    final l10n = AppLocalizations.of(context);
    final hero = showHero ? Container(
      padding: EdgeInsets.all(narrow ? 22 : 32),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(colors: [Color(0xff4169ef), Color(0xff2947b8)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l10n.privateAddressBook, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: const Color(0xffdce5ff), letterSpacing: 1.2)),
          const SizedBox(height: 10),
          Text(l10n.keepInboxYours, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(l10n.heroDescription, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: const Color(0xffe7edff))),
        ])),
        const SizedBox(width: 16),
        Column(children: [IconButton(tooltip: 'Dismiss', color: Colors.white, onPressed: _dismissHero, icon: const Icon(Icons.close)), const Icon(Icons.mark_email_read_outlined, color: Color(0xffdce5ff), size: 48)]),
      ]),
    ) : null;

    return ListView(padding: EdgeInsets.all(narrow ? 16 : 32), children: [
      if (hero != null) ...[hero, const SizedBox(height: 24)],
      Wrap(spacing: 12, runSpacing: 12, children: [_metric(context, l10n.activeProxies, '${widget.data.activeProxies}', narrow), _metric(context, l10n.availableCapacity, '${widget.data.available}', narrow), _metric(context, l10n.twoFactorProtection, widget.data.twoFactor ? l10n.on : l10n.off, narrow)]),
        const SizedBox(height: 24),
        if (narrow) ...[
          TextField(controller: search, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: l10n.searchAliases, prefixIcon: const Icon(Icons.search))),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () => _create(context), icon: const Icon(Icons.add), label: Text(l10n.newProxy))),
        ] else Row(children: [Expanded(child: TextField(controller: search, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: l10n.searchAliases, prefixIcon: const Icon(Icons.search)))), const SizedBox(width: 12), FilledButton.icon(onPressed: () => _create(context), icon: const Icon(Icons.add), label: Text(l10n.newProxy))]),
        const SizedBox(height: 16),
          if (matches.isEmpty) Card(child: Padding(padding: const EdgeInsets.all(32), child: Center(child: Text(l10n.noProxies)))) else Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(l10n.yourProxies, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))), LayoutBuilder(builder: (context, constraints) => Wrap(spacing: 12, runSpacing: 12, children: matches.map((binding) => SizedBox(width: narrow ? constraints.maxWidth : (constraints.maxWidth - 12) / 2, child: _bindingCard(context, binding))).toList()))])
    ]);
  }

  Widget _metric(BuildContext context, String label, String value, bool narrow) {
    return SizedBox(
      width: narrow ? double.infinity : 220,
      child: Card(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: Color(0xffe2e8f2))),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: const Color(0xff65758b))),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: const Color(0xff183b8c), fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }

  Widget _bindingCard(BuildContext context, ProxyBinding binding) {
    final l10n = AppLocalizations.of(context);
    final forwardingEnabled = forwardingOverrides[binding.id] ?? binding.forwardingStates.values.any((enabled) => enabled);
    final isBusy = forwardingBusy.contains(binding.id);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: Color(0xffe2e8f2))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 32, height: 32, decoration: BoxDecoration(color: const Color(0xffe8eeff), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.alternate_email, color: Color(0xff4169ef), size: 18)),
            const SizedBox(width: 10),
            Expanded(child: Text(binding.address, softWrap: true, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: const Color(0xff183b8c)))),
            IconButton(tooltip: 'Copy address', onPressed: () => _copyAddress(context, binding.address), icon: const Icon(Icons.copy_all_outlined)),
          ]),
          SizedBox(height: 20, child: binding.description.isNotEmpty ? Padding(padding: const EdgeInsets.only(left: 42), child: Text(binding.description, maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: true)) : null),
          const SizedBox(height: 10),
          Wrap(spacing: 14, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [_compactDetail(context, Icons.forward_to_inbox_outlined, l10n.recipients(binding.forwarding.length)), _compactDetail(context, Icons.mark_email_read_outlined, l10n.forwarded(binding.forwarded)), Row(mainAxisSize: MainAxisSize.min, children: [Text(l10n.forwardingRecipients), if (isBusy) const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))) else Tooltip(message: l10n.enableOrDisableRecipients, child: Switch(value: forwardingEnabled, onChanged: (enabled) => _toggleForwarding(context, binding, enabled)))])]),
        ]),
      ),
    );
  }

  Widget _compactDetail(BuildContext context, IconData icon, String value) => Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16, color: const Color(0xff65758b)), const SizedBox(width: 4), Text(value, style: Theme.of(context).textTheme.bodySmall)]);

  Future<void> _toggleForwarding(BuildContext context, ProxyBinding binding, bool enabled) async {
    if (forwardingBusy.contains(binding.id)) return;
    setState(() {
      forwardingOverrides[binding.id] = enabled;
      forwardingBusy.add(binding.id);
    });
    try {
      final result = await widget.api.setForwarding(binding, enabled);
      await widget.onRefresh();
      if (mounted) {
        setState(() {
          forwardingOverrides.remove(binding.id);
          forwardingBusy.remove(binding.id);
        });
      }
      if (!context.mounted || result.failed == 0) return;
        final l10n = AppLocalizations.of(context);
        final message = enabled ? l10n.someCouldNotEnable(result.succeeded, result.firstError ?? '') : l10n.someCouldNotDisable(result.firstError ?? '');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } catch (exception) {
      if (mounted) {
        setState(() {
          forwardingOverrides.remove(binding.id);
          forwardingBusy.remove(binding.id);
        });
      }
      if (!context.mounted) return;
      final message = exception.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message == '403 Forbidden' || message.contains('403') ? 'The API refused changing forwarding recipients for this proxy.' : message)));
    }
  }

  Future<void> _copyAddress(BuildContext context, String address) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.only(left: 24, right: 24, bottom: 24),
        content: Text(AppLocalizations.of(context).copied(address)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _create(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    final alias = TextEditingController();
    final domain = TextEditingController(text: 'proxiedmail.com');
    final forwarding = TextEditingController();
    await showDialog<void>(context: context, builder: (context) => AlertDialog(title: Text(l10n.newProxyAddress), content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: alias, decoration: InputDecoration(labelText: l10n.alias)), TextField(controller: domain, decoration: InputDecoration(labelText: l10n.domain)), TextField(controller: forwarding, decoration: InputDecoration(labelText: l10n.forwardTo))]), actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancel)), FilledButton(onPressed: () async { await widget.api.createBinding(alias: alias.text, domain: domain.text, forwarding: forwarding.text); if (context.mounted) Navigator.pop(context); await widget.onRefresh(); }, child: Text(l10n.create))]));
  }
}
