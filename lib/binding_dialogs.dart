import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'navigation.dart';

class BindingEditorDialog extends StatefulWidget {
  const BindingEditorDialog({required this.api, required this.binding, required this.passwordPreferences, super.key});

  final ProxiedMailApi api;
  final ProxyBinding binding;
  final PasswordPreferences passwordPreferences;

  @override
  State<BindingEditorDialog> createState() => _BindingEditorDialogState();
}

class _BindingEditorDialogState extends State<BindingEditorDialog> {
  late final TextEditingController description = TextEditingController(text: widget.binding.description);
  late final TextEditingController recipients = TextEditingController(text: widget.binding.forwarding.join(', '));
  late final TextEditingController callbackUrl = TextEditingController(text: widget.binding.callbackUrl);
  late final TextEditingController usedOn = TextEditingController(text: widget.binding.usedOn.join(', '));
  late final TextEditingController password = TextEditingController(text: widget.binding.password);
  bool advanced = false;
  bool busy = false;
  String? error;

  @override
  void dispose() {
    description.dispose();
    recipients.dispose();
    callbackUrl.dispose();
    usedOn.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> save() async {
    setState(() { busy = true; error = null; });
    try {
      await widget.api.updateBinding(binding: widget.binding, forwarding: recipients.text, description: description.text.trim(), callbackUrl: callbackUrl.text.trim());
      await Future.wait([
        widget.api.updateUsedOn(widget.binding, _commaList(usedOn.text)),
        widget.api.setBindingPassword(widget.binding, password.text),
      ]);
      if (mounted) Navigator.pop(context, true);
    } catch (exception) {
      if (mounted) setState(() { busy = false; error = _message(exception); });
    }
  }

  Future<void> deleteBinding() async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Delete proxy?'),
      content: const Text('Deleted proxy addresses still count toward usage. Turn off forwarding instead if you only want to stop receiving email.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(context, true), style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error), child: const Text('Delete proxy')),
      ],
    ));
    if (confirmed != true || !mounted) return;
    setState(() { busy = true; error = null; });
    try {
      await widget.api.deleteBinding(widget.binding);
      if (mounted) Navigator.pop(context, true);
    } catch (exception) {
      if (mounted) setState(() { busy = false; error = _message(exception); });
    }
  }

  void generatePassword() {
    final preferences = widget.passwordPreferences;
    final characters = '${preferences.letters ? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' : ''}${preferences.numbers ? '0123456789' : ''}${preferences.symbols ? '!@#\$%^&*' : ''}';
    final source = characters.isEmpty ? 'abcdefghijklmnopqrstuvwxyz' : characters;
    final random = Random.secure();
    password.text = List.generate(preferences.length, (_) => source[random.nextInt(source.length)]).join();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Edit proxy'), Text(widget.binding.address, style: Theme.of(context).textTheme.bodyMedium)]),
    content: SizedBox(width: 560, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      if (error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      TextField(controller: description, maxLines: 2, decoration: const InputDecoration(labelText: 'Description')),
      const SizedBox(height: 12),
      TextField(controller: recipients, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Forward to', helperText: 'Separate multiple addresses with commas')),
      const SizedBox(height: 12),
      ExpansionTile(title: const Text('Advanced settings'), tilePadding: EdgeInsets.zero, initiallyExpanded: advanced, onExpansionChanged: (value) => advanced = value, children: [
        TextField(controller: callbackUrl, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'Callback URL')),
        const SizedBox(height: 12),
        TextField(controller: usedOn, decoration: const InputDecoration(labelText: 'Used on site(s)', hintText: 'example.com, shop.example')),
        const SizedBox(height: 12),
        TextField(controller: password, obscureText: true, decoration: InputDecoration(labelText: 'Site password', suffixIcon: IconButton(onPressed: generatePassword, tooltip: 'Generate password', icon: const Icon(Icons.autorenew)))),
      ]),
    ]))),
    actions: [
      TextButton(onPressed: busy ? null : deleteBinding, style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error), child: const Text('Delete')),
      TextButton(onPressed: busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
      FilledButton(onPressed: busy ? null : save, child: busy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save changes')),
    ],
  );
}

class ContactsDialog extends StatefulWidget {
  const ContactsDialog({required this.api, required this.binding, super.key});

  final ProxiedMailApi api;
  final ProxyBinding binding;

  @override
  State<ContactsDialog> createState() => _ContactsDialogState();
}

class _ContactsDialogState extends State<ContactsDialog> {
  final recipient = TextEditingController();
  List<ProxyContact>? contacts;
  bool creating = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    recipient.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await widget.api.contacts(widget.binding);
      if (mounted) setState(() => contacts = result);
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    }
  }

  Future<void> create() async {
    final target = recipient.text.trim();
    if (target.isEmpty) return;
    setState(() { creating = true; error = null; });
    try {
      await widget.api.createContact(widget.binding, target);
      recipient.clear();
      await load();
    } catch (exception) {
      if (mounted) setState(() => error = _message(exception));
    } finally {
      if (mounted) setState(() => creating = false);
    }
  }

  Future<void> copy(String address) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Contact address copied.')));
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Create contact'),
    content: SizedBox(width: 520, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Proxy address: ${widget.binding.address}'),
      const SizedBox(height: 16),
      TextField(controller: recipient, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Where do you want to send the email?'), onSubmitted: (_) => create()),
      const SizedBox(height: 12),
      Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: creating ? null : create, child: creating ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create'))),
      const Divider(height: 32),
      Text('Created contacts', style: Theme.of(context).textTheme.titleMedium),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      if (contacts == null && error == null) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
      if (contacts?.isEmpty == true) const Padding(padding: EdgeInsets.only(top: 12), child: Text('No contacts created yet.')),
      for (final contact in contacts ?? <ProxyContact>[]) ListTile(contentPadding: EdgeInsets.zero, title: Text(contact.reverseProxyAddress), subtitle: Text(contact.recipientEmail), trailing: Row(mainAxisSize: MainAxisSize.min, children: [IconButton(onPressed: () => openExternalUrl('mailto:${Uri.encodeComponent(contact.reverseProxyAddress)}'), tooltip: 'Open in email app', icon: const Icon(Icons.email_outlined)), IconButton(onPressed: () => copy(contact.reverseProxyAddress), tooltip: 'Copy contact address', icon: const Icon(Icons.copy_outlined))])),
    ]))),
    actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
  );
}

List<String> _commaList(String value) => value.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty).toList();
String _message(Object exception) => exception.toString().replaceFirst('Exception: ', '');
