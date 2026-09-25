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
  final replacementTarget = TextEditingController();
  final senderCustomName = TextEditingController();
  bool loading = true;
  bool saving = false;
  bool hideIamRich = false;
  bool onlyCustomDomains = false;
  bool hideBanner = false;
  bool useLetters = true;
  bool useNumbers = true;
  bool useSymbols = true;
  bool bitwardenExpanded = false;
  bool exporting = false;
  bool replacingTarget = false;
  bool savingDisplayPreferences = false;
  String retention = 'never';
  String senderNameMode = '1';
  String selectedDomain = '';
  String selectedTargetAddress = '';
  List<String> domains = const [];
  List<String> customDomains = const [];
  List<String> targetAddresses = const [];
  String? message;
  String? error;

  List<String> get availableDomains => domains.where((domain) => !hideIamRich || domain != 'iam-rich.net').toList();
  bool get hasCustomDomains => customDomains.isNotEmpty;
  List<String> get availableCustomDomains => customDomains.where(availableDomains.contains).toList();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    passwordLength.dispose();
    replacementTarget.dispose();
    senderCustomName.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final data = await widget.api.settingsData();
      final settings = data.settings;
      final appSettings = data.appSettings;
      if (!mounted) return;
      setState(() {
        domains = data.domains;
        customDomains = data.customDomains;
        targetAddresses = data.targetAddresses;
        selectedTargetAddress = data.targetAddresses.firstOrNull ?? '';
        hideIamRich = appSettings['hideIamRich'] == 'true';
        onlyCustomDomains = appSettings['onlyCustomDomains'] == 'true' && data.customDomains.isNotEmpty;
        final senderNameSetting = settings['sender_name_mode'] ?? '1';
        senderNameMode = senderNameSetting == '0' || senderNameSetting == '1' ? senderNameSetting : 'custom';
        senderCustomName.text = senderNameMode == 'custom' ? senderNameSetting : '';
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
    setState(() { savingDisplayPreferences = true; error = null; });
    try {
      await widget.api.saveAppSettings({'hideIamRich': '$value'}, domains: domains, customDomains: customDomains);
      if (!mounted) return;
      setState(() {
        hideIamRich = value;
        if (!availableDomains.contains(selectedDomain)) selectedDomain = availableDomains.firstOrNull ?? '';
      });
      widget.onLocalPreferencesChanged();
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => savingDisplayPreferences = false);
    }
  }

  Future<void> setOnlyCustomDomains(bool value) async {
    if (!hasCustomDomains) return;
    if (!mounted) return;
    String? newDefaultDomain;
    if (value && !customDomains.contains(selectedDomain) && availableCustomDomains.isNotEmpty) {
      newDefaultDomain = availableCustomDomains.first;
    }
    setState(() { savingDisplayPreferences = true; error = null; });
    try {
      await widget.api.saveAppSettings({'onlyCustomDomains': '$value'}, domains: domains, customDomains: customDomains);
      if (!mounted) return;
      setState(() {
        onlyCustomDomains = value;
        if (newDefaultDomain != null) selectedDomain = newDefaultDomain;
      });
      if (newDefaultDomain != null) await save({'random_alias_default_domain': newDefaultDomain}, success: 'Default proxy domain changed to $newDefaultDomain.');
      widget.onLocalPreferencesChanged();
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => savingDisplayPreferences = false);
    }
  }

  Future<void> saveSenderName() async {
    setState(() { savingDisplayPreferences = true; error = null; });
    try {
      final value = senderNameMode == 'custom' ? senderCustomName.text.trim() : senderNameMode;
      await widget.api.updateSettings({'sender_name_mode': value.isEmpty ? '1' : value});
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => savingDisplayPreferences = false);
    }
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

  Future<void> replaceTargetAddress() async {
    final oldEmail = selectedTargetAddress.trim();
    final newEmail = replacementTarget.text.trim();
    if (oldEmail.isEmpty || newEmail.isEmpty) return;
    setState(() { replacingTarget = true; message = null; error = null; });
    try {
      await widget.api.replaceTargetAddress(oldEmail: oldEmail, newEmail: newEmail);
      replacementTarget.clear();
      if (mounted) setState(() => message = 'Target address replacement started.');
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => replacingTarget = false);
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
      _section(context, title: 'Account settings', subtitle: 'These choices apply to your ProxiedMail account.', children: [
        DropdownButtonFormField<String>(initialValue: retention, decoration: const InputDecoration(labelText: 'Received-message retention'), items: const [DropdownMenuItem(value: '1-day', child: Text('1 day')), DropdownMenuItem(value: '3-days', child: Text('3 days')), DropdownMenuItem(value: 'never', child: Text('Never'))], onChanged: saving ? null : (value) { if (value == null) return; setState(() => retention = value); save({'received_messages_retention': value}); }),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(initialValue: availableDomains.contains(selectedDomain) ? selectedDomain : null, decoration: const InputDecoration(labelText: 'Default proxy domain'), items: availableDomains.map((domain) => DropdownMenuItem(value: domain, child: Text(domain))).toList(), onChanged: saving ? null : (value) { if (value == null) return; setState(() => selectedDomain = value); save({'random_alias_default_domain': value}); }),
        const SizedBox(height: 8),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Remove ProxiedMail mail-info banner in forwarded emails'), value: hideBanner, onChanged: saving ? null : (value) { setState(() => hideBanner = value); save({'hide_banner': value ? 'hide' : 'keep'}); }),
        const Divider(),
        _targetReplacement(context),
        const SizedBox(height: 14),
        _passwordSettings(context),
      ]),
      const SizedBox(height: 16),
      _section(context, title: 'Display preferences', subtitle: 'Choose how this dashboard is shown.', children: [
        DropdownButtonFormField<String>(initialValue: widget.locale.languageCode, decoration: const InputDecoration(labelText: 'Language'), items: const [DropdownMenuItem(value: 'en', child: Text('English')), DropdownMenuItem(value: 'es', child: Text('Español'))], onChanged: changeLocale),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Hide iam-rich.net from the proxy domain list'), value: hideIamRich, onChanged: savingDisplayPreferences ? null : setHideIamRich),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Only use custom domains'), subtitle: Text(hasCustomDomains ? 'New proxies will only offer your custom domains.' : 'Add a custom domain to enable this setting.'), value: onlyCustomDomains && hasCustomDomains, onChanged: savingDisplayPreferences || !hasCustomDomains ? null : setOnlyCustomDomains),
        const Divider(),
        _senderNameSettings(context),
        if (savingDisplayPreferences) const Padding(padding: EdgeInsets.only(top: 8), child: Row(children: [SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 10), Text('Saving display preferences...')]))
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

  Widget _targetReplacement(BuildContext context) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(border: Border.all(color: const Color(0xffe2e8f2)), borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text('Replace target address', style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 12), DropdownButtonFormField<String>(initialValue: targetAddresses.contains(selectedTargetAddress) ? selectedTargetAddress : null, decoration: const InputDecoration(labelText: 'Target address'), items: targetAddresses.map((address) => DropdownMenuItem(value: address, child: Text(address))).toList(), onChanged: replacingTarget ? null : (value) => setState(() => selectedTargetAddress = value ?? '')), const SizedBox(height: 12), TextField(controller: replacementTarget, keyboardType: TextInputType.emailAddress, enabled: !replacingTarget, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Replacement address')), const SizedBox(height: 12), Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: replacingTarget || selectedTargetAddress.isEmpty || replacementTarget.text.trim().isEmpty ? null : replaceTargetAddress, icon: replacingTarget ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.swap_horiz), label: const Text('Replace target')))]));

  Widget _senderNameSettings(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text('Sender name', style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 4), const Text('Choose how you want your name to appear in emails.'), const SizedBox(height: 12), DropdownButtonFormField<String>(initialValue: senderNameMode, decoration: const InputDecoration(labelText: 'Sender name mode'), items: const [DropdownMenuItem(value: '1', child: Text('Default')), DropdownMenuItem(value: '0', child: Text('Hide name')), DropdownMenuItem(value: 'custom', child: Text('Custom name'))], onChanged: savingDisplayPreferences ? null : (value) { setState(() => senderNameMode = value ?? '1'); if (senderNameMode != 'custom') saveSenderName(); }), if (senderNameMode == 'custom') ...[const SizedBox(height: 12), TextField(controller: senderCustomName, enabled: !savingDisplayPreferences, textInputAction: TextInputAction.done, decoration: const InputDecoration(labelText: 'Custom sender name'), onSubmitted: (_) => saveSenderName(), onChanged: (_) => setState(() {}))]]);

  Widget _passwordSettings(BuildContext context) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(border: Border.all(color: const Color(0xffe2e8f2)), borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text('Password generator', style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 12), TextField(controller: passwordLength, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: const InputDecoration(labelText: 'Password length', helperText: '6 to 128 characters'), onSubmitted: (_) => savePasswordPreferences()), SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Use letters'), value: useLetters, onChanged: saving ? null : (value) { setState(() => useLetters = value); savePasswordPreferences(); }), SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Use numbers'), value: useNumbers, onChanged: saving ? null : (value) { setState(() => useNumbers = value); savePasswordPreferences(); }), SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Use symbols'), value: useSymbols, onChanged: saving ? null : (value) { setState(() => useSymbols = value); savePasswordPreferences(); })]));

  Widget _section(BuildContext context, {required String title, required String subtitle, required List<Widget> children}) => Card(elevation: 0, child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(title, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 4), Text(subtitle, style: Theme.of(context).textTheme.bodyMedium), const SizedBox(height: 18), ...children])));
}

String _message(Object exception) => exception.toString().replaceFirst('Exception: ', '');
