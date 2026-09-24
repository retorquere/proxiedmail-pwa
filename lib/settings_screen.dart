import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'navigation.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({required this.api, required this.locale, required this.onLocaleChanged, required this.onLocalPreferencesChanged, super.key});

  final ProxiedMailApi api;
  final Locale locale;
  final ValueChanged<Locale> onLocaleChanged;
  final VoidCallback onLocalPreferencesChanged;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final passwordLength = TextEditingController(text: '13');
  bool loading = true;
  bool saving = false;
  bool hideIamRich = false;
  bool hideBanner = false;
  bool useLetters = true;
  bool useNumbers = true;
  bool useSymbols = true;
  bool bitwardenExpanded = false;
  bool exporting = false;
  String retention = 'never';
  String selectedDomain = '';
  List<String> domains = const [];
  String? message;
  String? error;

  List<String> get availableDomains => domains.where((domain) => !hideIamRich || domain != 'iam-rich.net').toList();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    passwordLength.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final results = await Future.wait([widget.api.settingsData(), SharedPreferences.getInstance()]);
      final data = results[0] as SettingsData;
      final preferences = results[1] as SharedPreferences;
      final settings = data.settings;
      if (!mounted) return;
      setState(() {
        domains = data.domains;
        hideIamRich = preferences.getBool('proxiedmail.hideIamRich') ?? false;
        retention = settings['received_messages_retention'] ?? 'never';
        hideBanner = settings['hide_banner'] == 'hide';
        passwordLength.text = settings['password_length'] ?? '13';
        useLetters = settings['use_letters'] != 'false';
        useNumbers = settings['use_numbers'] != 'false';
        useSymbols = settings['use_symbols'] != 'false';
        final preferredDomain = settings['random_alias_default_domain'] ?? '';
        selectedDomain = availableDomains.contains(preferredDomain) ? preferredDomain : (availableDomains.firstOrNull ?? '');
        loading = false;
      });
    } catch (exception) {
      if (mounted) setState(() { loading = false; error = _message(exception); });
    }
  }

  Future<void> save(Map<String, String> settings, {String success = 'Settings saved.'}) async {
    setState(() { saving = true; message = null; error = null; });
    try {
      await widget.api.updateSettings(settings);
      if (mounted) setState(() => message = success);
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> setHideIamRich(bool value) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('proxiedmail.hideIamRich', value);
    if (!mounted) return;
    setState(() {
      hideIamRich = value;
      if (!availableDomains.contains(selectedDomain)) selectedDomain = availableDomains.firstOrNull ?? '';
    });
    widget.onLocalPreferencesChanged();
  }

  Future<void> changeLocale(String? value) async {
    if (value == null) return;
    final locale = Locale(value);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString('proxiedmail.locale', value);
    widget.onLocaleChanged(locale);
  }

  Future<void> copyApiToken() async {
    await Clipboard.setData(ClipboardData(text: widget.api.apiToken ?? ''));
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('API key copied.')));
  }

  Future<void> exportConfiguration() async {
    setState(() { exporting = true; message = null; error = null; });
    try {
      final configuration = await widget.api.exportConfiguration();
      final date = DateTime.now().toUtc().toIso8601String().substring(0, 10);
      downloadTextFile('proxiedmail-config-$date.json', const JsonEncoder.withIndent('  ').convert(configuration));
      if (mounted) setState(() => message = 'Configuration downloaded.');
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text('Settings', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text('Control account preferences and integrations.', style: Theme.of(context).textTheme.bodyLarge),
      if (error != null) _notice(context, error!, error: true),
      if (message != null) _notice(context, message!),
      const SizedBox(height: 18),
      _section(context, title: 'Your account', subtitle: 'These choices are saved to your ProxiedMail account.', children: [
        DropdownButtonFormField<String>(initialValue: retention, decoration: const InputDecoration(labelText: 'Received-message retention'), items: const [DropdownMenuItem(value: '1-day', child: Text('1 day')), DropdownMenuItem(value: '3-days', child: Text('3 days')), DropdownMenuItem(value: 'never', child: Text('Never'))], onChanged: saving ? null : (value) { if (value == null) return; setState(() => retention = value); save({'received_messages_retention': value}); }),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(initialValue: availableDomains.contains(selectedDomain) ? selectedDomain : null, decoration: const InputDecoration(labelText: 'Default proxy domain'), items: availableDomains.map((domain) => DropdownMenuItem(value: domain, child: Text(domain))).toList(), onChanged: saving ? null : (value) { if (value == null) return; setState(() => selectedDomain = value); save({'random_alias_default_domain': value}); }),
        const SizedBox(height: 8),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Remove ProxiedMail mail-info banner in forwarded emails'), value: hideBanner, onChanged: saving ? null : (value) { setState(() => hideBanner = value); save({'hide_banner': value ? 'hide' : 'keep'}); }),
        const Divider(),
        TextField(controller: passwordLength, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: const InputDecoration(labelText: 'Password length', helperText: '6 to 128 characters'), onSubmitted: (_) => savePasswordPreferences()),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Use letters'), value: useLetters, onChanged: saving ? null : (value) { setState(() => useLetters = value); savePasswordPreferences(); }),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Use numbers'), value: useNumbers, onChanged: saving ? null : (value) { setState(() => useNumbers = value); savePasswordPreferences(); }),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Use symbols'), value: useSymbols, onChanged: saving ? null : (value) { setState(() => useSymbols = value); savePasswordPreferences(); }),
      ]),
      const SizedBox(height: 16),
      _section(context, title: 'This browser', subtitle: 'These choices are saved only in this browser.', children: [
        DropdownButtonFormField<String>(initialValue: widget.locale.languageCode, decoration: const InputDecoration(labelText: 'Language'), items: const [DropdownMenuItem(value: 'en', child: Text('English')), DropdownMenuItem(value: 'es', child: Text('Español'))], onChanged: changeLocale),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Hide iam-rich.net from the proxy domain list'), value: hideIamRich, onChanged: setHideIamRich),
      ]),
      const SizedBox(height: 16),
      _section(context, title: 'Export configuration', subtitle: 'Download a portable JSON backup of proxy addresses, targets, contacts, callbacks, site associations, passwords, and account settings. Authentication tokens are never included.', children: [
        OutlinedButton.icon(onPressed: exporting ? null : exportConfiguration, icon: exporting ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.download_outlined), label: const Text('Download JSON')),
        const SizedBox(height: 10),
        const Text('The exported file may contain site passwords and private email addresses. Store it securely.'),
      ]),
      const SizedBox(height: 16),
      _section(context, title: 'Bitwarden setup', subtitle: 'Use ProxiedMail as an Addy.io-compatible forwarded email alias service.', children: [
        ExpansionTile(tilePadding: EdgeInsets.zero, title: const Text('Integration details'), initiallyExpanded: bitwardenExpanded, onExpansionChanged: (value) => setState(() => bitwardenExpanded = value), children: [
          ListTile(contentPadding: EdgeInsets.zero, title: const Text('API key'), subtitle: Text(widget.api.apiToken ?? ''), trailing: IconButton(onPressed: copyApiToken, tooltip: 'Copy API key', icon: const Icon(Icons.copy_outlined))),
          ListTile(contentPadding: EdgeInsets.zero, title: const Text('Self-host server URL'), subtitle: const Text('https://proxiedmail.com')),
          ListTile(contentPadding: EdgeInsets.zero, title: const Text('Email domain'), subtitle: Text(selectedDomain.isEmpty ? 'Choose a default domain above' : selectedDomain)),
          const Text('In Bitwarden Generator, choose Username, then Forwarded email alias, select Addy.io, and enter these values.'),
          const SizedBox(height: 12),
        ]),
      ]),
      const SizedBox(height: 24),
    ]);
  }

  Future<void> savePasswordPreferences() {
    final parsed = int.tryParse(passwordLength.text) ?? 13;
    final length = parsed.clamp(6, 128);
    passwordLength.text = '$length';
    return save({'password_length': '$length', 'use_letters': '$useLetters', 'use_numbers': '$useNumbers', 'use_symbols': '$useSymbols'});
  }

  Widget _notice(BuildContext context, String text, {bool error = false}) => Container(margin: const EdgeInsets.only(top: 16), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: error ? Theme.of(context).colorScheme.errorContainer : const Color(0xffe5f5e9), borderRadius: BorderRadius.circular(6)), child: Text(text));

  Widget _section(BuildContext context, {required String title, required String subtitle, required List<Widget> children}) => Card(elevation: 0, child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(title, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 4), Text(subtitle, style: Theme.of(context).textTheme.bodyMedium), const SizedBox(height: 18), ...children])));
}

String _message(Object exception) => exception.toString().replaceFirst('Exception: ', '');
