import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'binding_dialogs.dart';
import 'navigation.dart';
import 'l10n/app_localizations.dart';
import 'settings_screen.dart';

void main() => runApp(const ProxiedMailApp());

class ProxiedMailApp extends StatefulWidget {
  const ProxiedMailApp({super.key});

  @override
  State<ProxiedMailApp> createState() => _ProxiedMailAppState();
}

class _ProxiedMailAppState extends State<ProxiedMailApp> {
  Locale locale = const Locale('en');

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((preferences) {
      final saved = preferences.getString('proxiedmail.locale');
      if (mounted && saved != null) setState(() => locale = Locale(saved));
    });
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
        locale: locale,
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
          home: AppEntry(onLocaleChanged: (value) => setState(() => locale = value)),
      );
}

class AppEntry extends StatefulWidget {
        const AppEntry({required this.onLocaleChanged, super.key});

        final ValueChanged<Locale> onLocaleChanged;

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
    return DashboardScreen(api: api, data: data!, onRefresh: signedIn, onLogout: signedOut, onLocaleChanged: widget.onLocaleChanged);
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
  final token = TextEditingController();
  bool busy = false;
  String? message;

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      await widget.api.login(token.text);
      await widget.onSignedIn();
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
                    Text(l10n.welcome, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    Text(l10n.manageAliases),
                    const SizedBox(height: 24),
                    if (message != null || widget.error != null) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text(message ?? widget.error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
                    TextFormField(controller: token, obscureText: true, textInputAction: TextInputAction.done, onEditingComplete: submit, decoration: InputDecoration(labelText: l10n.token, prefixIcon: const Icon(Icons.key_outlined)), validator: (value) => value == null || value.trim().isEmpty ? l10n.enterToken : null),
                    const SizedBox(height: 24),
                    FilledButton.icon(onPressed: busy ? null : submit, icon: busy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.arrow_forward), label: Text(l10n.signIn)),
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
  const DashboardScreen({required this.api, required this.data, required this.onRefresh, required this.onLogout, required this.onLocaleChanged, super.key});

  final ProxiedMailApi api;
  final DashboardData data;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;
  final ValueChanged<Locale> onLocaleChanged;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final search = TextEditingController();
  final createAlias = TextEditingController();
  final createForwarding = TextEditingController();
  final forwardingOverrides = <String, bool>{};
  final forwardingBusy = <String>{};
  final verificationBusy = <String>{};
  int destination = 0;
  bool showHero = true;
  bool hideIamRich = false;
  bool onlyCustomDomains = false;
  bool creatingProxy = false;
  String createDomain = '';
  String get query => search.text.toLowerCase();

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final preferences = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        showHero = !(preferences.getBool('proxiedmail.hideDashboardHero') ?? false);
        hideIamRich = preferences.getBool('proxiedmail.hideIamRich') ?? false;
        onlyCustomDomains = preferences.getBool('proxiedmail.onlyCustomDomains') ?? false;
      });
    }
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
      final content = destination == 0 ? _dashboard(context, matches, narrow) : SettingsScreen(api: widget.api, locale: Localizations.localeOf(context), onLocaleChanged: widget.onLocaleChanged, onLocalPreferencesChanged: _loadPreferences);
      return Scaffold(appBar: AppBar(backgroundColor: const Color(0xff4169ef), foregroundColor: Colors.white, title: Text(l10n.appTitle), actions: [IconButton(onPressed: widget.onRefresh, tooltip: l10n.refresh, icon: const Icon(Icons.refresh)), IconButton(onPressed: widget.onLogout, tooltip: l10n.signOut, icon: const Icon(Icons.logout)), const Padding(padding: EdgeInsets.only(right: 16), child: CircleAvatar(backgroundColor: Color(0xffdce5ff), child: Padding(padding: EdgeInsets.all(7), child: Image(image: NetworkImage('/images/v2/favicons/favicon-32x32.png'))))) ]), bottomNavigationBar: compact ? NavigationBar(selectedIndex: destination, onDestinationSelected: (value) => setState(() => destination = value), destinations: [NavigationDestination(icon: const Icon(Icons.inbox_outlined), selectedIcon: const Icon(Icons.inbox), label: l10n.proxies), NavigationDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: l10n.settings)]) : null, body: compact ? content : Row(children: [navigation, const VerticalDivider(width: 1), Expanded(child: content)]));
    });
  }

  Widget _dashboard(BuildContext context, List<ProxyBinding> matches, bool narrow) {
    final l10n = AppLocalizations.of(context);
    final domains = _createDomains();
    final selectedDomain = domains.contains(createDomain) ? createDomain : (domains.contains(widget.data.defaultDomain) ? widget.data.defaultDomain : domains.first);
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
      _metrics(context, l10n, narrow),
        const SizedBox(height: 24),
        _createProxyRow(context, l10n, domains, selectedDomain, narrow),
        const SizedBox(height: 18),
        TextField(controller: search, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: l10n.searchAliases, prefixIcon: const Icon(Icons.search))),
        const SizedBox(height: 16),
          if (matches.isEmpty) Card(child: Padding(padding: const EdgeInsets.all(32), child: Center(child: Text(l10n.noProxies)))) else Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(l10n.yourProxies, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))), LayoutBuilder(builder: (context, constraints) => Wrap(spacing: 12, runSpacing: 12, children: matches.map((binding) => SizedBox(width: narrow ? constraints.maxWidth : (constraints.maxWidth - 12) / 2, child: _bindingCard(context, binding))).toList()))])
    ]);
  }

  List<String> _createDomains() {
    final visibleDomains = widget.data.domains.where((domain) => !hideIamRich || domain != 'iam-rich.net').toList();
    if (onlyCustomDomains && widget.data.customDomains.isNotEmpty) {
      final customDomainSet = widget.data.customDomains.toSet();
      final customDomains = visibleDomains.where(customDomainSet.contains).toList();
      if (customDomains.isNotEmpty) return customDomains;
    }
    return visibleDomains.isEmpty ? ['proxiedmail.com'] : visibleDomains;
  }

  Widget _metrics(BuildContext context, AppLocalizations l10n, bool narrow) {
    final metrics = [_metric(context, l10n.activeProxies, '${widget.data.activeProxies}', narrow), _metric(context, l10n.availableCapacity, '${widget.data.available}', narrow)];
    if (narrow) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: metrics.expand((metric) => [metric, const SizedBox(height: 12)]).toList()..removeLast());
    return Wrap(spacing: 12, runSpacing: 12, children: metrics);
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
    final verifiedCount = binding.forwarding.where((address) => binding.verificationStates[address] == true).length;
    final verificationLabel = binding.forwarding.isEmpty ? l10n.noRecipients : l10n.verifiedRecipients(binding.forwarding.length, verifiedCount);
    final triggerLabel = binding.callbackUrl.trim().isEmpty ? l10n.noTrigger : l10n.trigger;
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
            IconButton(tooltip: 'Open contacts', onPressed: () => _openContacts(context, binding), icon: const Icon(Icons.contacts_outlined)),
            IconButton(tooltip: l10n.editProxy, onPressed: () => _edit(context, binding), icon: const Icon(Icons.edit_outlined)),
            IconButton(tooltip: 'Copy address', onPressed: () => _copyAddress(context, binding.address), icon: const Icon(Icons.copy_all_outlined)),
          ]),
          SizedBox(height: 20, child: binding.description.isNotEmpty ? Padding(padding: const EdgeInsets.only(left: 42), child: Text(binding.description, maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: true)) : null),
          const SizedBox(height: 10),
          Wrap(spacing: 14, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [_compactDetail(context, Icons.forward_to_inbox_outlined, l10n.recipients(binding.forwarding.length)), _compactDetail(context, Icons.mark_email_read_outlined, l10n.forwarded(binding.forwarded)), _compactDetail(context, Icons.verified_user_outlined, verificationLabel), _compactDetail(context, binding.callbackUrl.trim().isEmpty ? Icons.webhook_outlined : Icons.bolt_outlined, triggerLabel), _forwardingControl(context, binding, l10n, forwardingEnabled, isBusy)]),
          if (binding.forwarding.isNotEmpty) ...[
            const SizedBox(height: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: binding.forwarding.map((address) => _recipientStatus(context, binding, address)).toList()),
          ],
        ]),
      ),
    );
  }

  Widget _recipientStatus(BuildContext context, ProxyBinding binding, String address) {
    final l10n = AppLocalizations.of(context);
    final verified = binding.verificationStates[address] == true;
    final busy = verificationBusy.contains(address);
    final color = verified ? const Color(0xff247a4b) : const Color(0xff9a5b00);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 4, children: [
        Icon(verified ? Icons.verified_outlined : Icons.warning_amber_rounded, size: 16, color: color),
        Text(address, style: Theme.of(context).textTheme.bodySmall),
        Chip(label: Text(verified ? l10n.verified : l10n.verificationRequired), labelStyle: TextStyle(color: color), side: BorderSide(color: color.withValues(alpha: 0.35)), backgroundColor: color.withValues(alpha: 0.08), visualDensity: VisualDensity.compact),
        if (!verified) TextButton.icon(onPressed: busy ? null : () => _resendVerification(context, address), icon: busy ? const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.mark_email_read_outlined, size: 16), label: Text(l10n.sendVerification)),
      ]),
    );
  }

  Future<void> _resendVerification(BuildContext context, String address) async {
    setState(() => verificationBusy.add(address));
    try {
      await widget.api.resendConfirmation(address);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).verificationSent(address))));
    } catch (exception) {
      if (!context.mounted) return;
      final detail = exception.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).verificationFailed(detail))));
    } finally {
      if (mounted) setState(() => verificationBusy.remove(address));
    }
  }

  Widget _compactDetail(BuildContext context, IconData icon, String value) => Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16, color: const Color(0xff65758b)), const SizedBox(width: 4), Text(value, style: Theme.of(context).textTheme.bodySmall)]);

  Widget _forwardingControl(BuildContext context, ProxyBinding binding, AppLocalizations l10n, bool forwardingEnabled, bool isBusy) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Text(l10n.forwardingRecipients),
      Tooltip(
        message: l10n.enableOrDisableRecipients,
        child: SizedBox(
          width: 52,
          height: 32,
          child: Stack(alignment: Alignment.center, children: [
            Opacity(
              opacity: isBusy ? 0.35 : 1,
              child: Transform.scale(
                scale: 0.78,
                child: Switch(materialTapTargetSize: MaterialTapTargetSize.shrinkWrap, value: forwardingEnabled, onChanged: isBusy ? null : (enabled) => _toggleForwarding(context, binding, enabled)),
              ),
            ),
            if (isBusy) const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2)),
          ]),
        ),
      ),
    ]);
  }

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

  Widget _createProxyRow(BuildContext context, AppLocalizations l10n, List<String> domains, String selectedDomain, bool narrow) {
    final fields = [
      TextField(controller: createAlias, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: l10n.alias, suffixIcon: IconButton(onPressed: _generateAlias, tooltip: 'Generate alias', icon: const Icon(Icons.autorenew)))),
      DropdownButtonFormField<String>(initialValue: selectedDomain, decoration: InputDecoration(labelText: l10n.domain), items: domains.map((item) => DropdownMenuItem(value: item, child: Text(item))).toList(), onChanged: (value) => setState(() => createDomain = value ?? selectedDomain)),
      Autocomplete<String>(optionsBuilder: (value) => widget.data.realEmails.map((email) => email.address).where((email) => email.toLowerCase().contains(value.text.toLowerCase())), onSelected: (value) => setState(() => createForwarding.text = value), fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) { controller.value = createForwarding.value; return TextField(controller: controller, focusNode: focusNode, onChanged: (_) { createForwarding.value = controller.value; setState(() {}); }, decoration: InputDecoration(labelText: l10n.forwardTo)); }),
    ];
    final canCreate = createAlias.text.trim().isNotEmpty && createForwarding.text.trim().isNotEmpty && !creatingProxy;
    final button = FilledButton(onPressed: canCreate ? _createProxy : null, child: creatingProxy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l10n.create));
    final desktopFields = [Expanded(flex: 2, child: fields[0]), Expanded(flex: 2, child: fields[1]), Expanded(flex: 3, child: fields[2])];
    return Card(color: const Color(0xffeef3ff), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), child: Padding(padding: const EdgeInsets.all(14), child: narrow ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [...fields.map((field) => Padding(padding: const EdgeInsets.only(bottom: 10), child: field)), button]) : Row(children: [...desktopFields.expand((field) => [field, const SizedBox(width: 10)]).toList()..removeLast(), button])));
  }

  Future<void> _createProxy() async {
    final domains = _createDomains();
    final domain = domains.contains(createDomain) ? createDomain : (domains.contains(widget.data.defaultDomain) ? widget.data.defaultDomain : domains.first);
    setState(() => creatingProxy = true);
    try {
      await widget.api.createBinding(alias: createAlias.text.trim(), domain: domain, forwarding: createForwarding.text.trim());
      createAlias.clear();
      createForwarding.clear();
      await widget.onRefresh();
    } catch (exception) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(exception.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => creatingProxy = false);
    }
  }

  void _generateAlias() {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    createAlias.text = List.generate(10, (_) => characters[random.nextInt(characters.length)]).join();
    setState(() {});
  }

  Future<void> _edit(BuildContext context, ProxyBinding binding) async {
    final changed = await showDialog<bool>(context: context, builder: (context) => BindingEditorDialog(api: widget.api, binding: binding, passwordPreferences: widget.data.passwordPreferences));
    if (changed == true) await widget.onRefresh();
  }

  Future<void> _openContacts(BuildContext context, ProxyBinding binding) => showDialog<void>(context: context, builder: (context) => ContactsDialog(api: widget.api, binding: binding));
}
