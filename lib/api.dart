import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ProxyBinding {
  const ProxyBinding({required this.id, required this.address, required this.description, required this.browsable, required this.forwarding, required this.forwardingStates, required this.verificationStates, required this.forwarded, this.callbackUrl = '', this.usedOn = const [], this.password = ''});

  final String id;
  final String address;
  final String description;
  final bool browsable;
  final List<String> forwarding;
  final Map<String, bool> forwardingStates;
  final Map<String, bool> verificationStates;
  final int forwarded;
  final String callbackUrl;
  final List<String> usedOn;
  final String password;

  factory ProxyBinding.fromJson(Map<String, dynamic> json, {List<String> usedOn = const [], String password = '', Map<String, bool> verificationStates = const {}}) {
    final attributes = (json['attributes'] as Map?)?.cast<String, dynamic>() ?? {};
    final realAddressMap = (attributes['real_addresses'] as Map?)?.cast<String, dynamic>() ?? {};
    final realAddresses = realAddressMap.keys.toList();
    final forwardingStates = {for (final entry in realAddressMap.entries) entry.key: (entry.value is Map ? (entry.value['is_enabled'] != false) : true)};
    final bindingVerificationStates = <String, bool>{};
    for (final entry in realAddressMap.entries) {
      if (entry.value is Map && (entry.value as Map).containsKey('is_verified')) {
        bindingVerificationStates[entry.key] = entry.value['is_verified'] == true;
      }
    }
    return ProxyBinding(id: '${json['id'] ?? ''}', address: '${attributes['proxy_address'] ?? 'Unnamed address'}', description: '${attributes['description'] ?? ''}', browsable: attributes['is_browsable'] == true, forwarding: realAddresses, forwardingStates: forwardingStates, verificationStates: {...bindingVerificationStates, ...verificationStates}, forwarded: (attributes['received_emails'] as num?)?.toInt() ?? 0, callbackUrl: '${attributes['callback_url'] ?? ''}', usedOn: usedOn, password: password);
  }
}

class RealEmail {
  const RealEmail({required this.address, required this.verified});

  final String address;
  final bool verified;
}

class PasswordPreferences {
  const PasswordPreferences({required this.length, required this.symbols, required this.numbers, required this.letters});

  final int length;
  final bool symbols;
  final bool numbers;
  final bool letters;
}

class ProxyContact {
  const ProxyContact({required this.id, required this.recipientEmail, required this.reverseProxyAddress});

  final String id;
  final String recipientEmail;
  final String reverseProxyAddress;
}

class SettingsData {
  const SettingsData({required this.domains, required this.settings});

  final List<String> domains;
  final Map<String, String> settings;
}

class DashboardData {
  const DashboardData({required this.bindings, required this.available, required this.domains, required this.realEmails, required this.defaultDomain, required this.passwordPreferences});

  final List<ProxyBinding> bindings;
  final int available;
  final List<String> domains;
  final List<RealEmail> realEmails;
  final String defaultDomain;
  final PasswordPreferences passwordPreferences;

  int get activeProxies => bindings.length;
}

class ForwardingUpdateResult {
  const ForwardingUpdateResult({required this.succeeded, required this.failed, this.firstError});

  final int succeeded;
  final int failed;
  final String? firstError;
}

class ProxiedMailApi {
  ProxiedMailApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  String? apiToken;
  String? bearerToken;

  Future<void> loadStoredTokens() async {
    final preferences = await SharedPreferences.getInstance();
    apiToken = preferences.getString('proxiedmail.apiToken');
    bearerToken = preferences.getString('proxiedmail.bearerToken');
  }

  Future<void> _storeTokens() async {
    final preferences = await SharedPreferences.getInstance();
    if (apiToken != null) {
      await preferences.setString('proxiedmail.apiToken', apiToken!);
    } else {
      await preferences.remove('proxiedmail.apiToken');
    }
    if (bearerToken != null) {
      await preferences.setString('proxiedmail.bearerToken', bearerToken!);
    } else {
      await preferences.remove('proxiedmail.bearerToken');
    }
  }

  Future<void> clearStoredTokens() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove('proxiedmail.apiToken');
    await preferences.remove('proxiedmail.bearerToken');
    apiToken = null;
    bearerToken = null;
  }

  Map<String, String> _headers({bool bearer = false}) => {'Accept': 'application/json', 'Content-Type': 'application/json', if (bearer && (bearerToken ?? apiToken) != null) 'Authorization': 'Bearer ${bearerToken ?? apiToken}', if (!bearer && apiToken != null) 'Token': apiToken!};

  Future<dynamic> _request(String path, {String method = 'GET', Object? body, bool bearer = false}) async {
    final request = http.Request(method, Uri.parse(path))..headers.addAll(_headers(bearer: bearer));
    if (body != null) request.body = jsonEncode(body);
    final response = await _client.send(request);
    final text = await response.stream.bytesToString();
    final payload = text.isEmpty ? null : jsonDecode(text);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final record = payload is Map ? payload : <dynamic, dynamic>{};
      throw Exception('${record['message'] ?? record['detail'] ?? '${response.statusCode} ${response.reasonPhrase}'}');
    }
    return payload;
  }

  Future<void> login(String token) async {
    apiToken = token.trim().replaceFirst(RegExp(r'^Token\s+', caseSensitive: false), '');
    if (apiToken!.isEmpty) throw Exception('Enter an API token.');
    if (RegExp(r'[\s()]').hasMatch(apiToken!)) throw Exception('Paste only the API token, without a label or surrounding text.');
    bearerToken = null;
    await _storeTokens();
  }

  Future<void> register(String username, String password) => _request('/api/v1/users', method: 'POST', body: {'data': {'type': 'users', 'attributes': {'username': username, 'password': password}}});

  Future<DashboardData> dashboard() async {
    final bindingsPayload = await _request('/api/v1/proxy-bindings?sort=desc') as Map;
    final results = await Future.wait([_optional('/gapi/available-domains', []), _optional('/gapi/real-emails', []), _optional('/gapi/used-on', []), _optional('/gapi/passwords', []), _optional('/gapi/settings', [])]);
    final realEmailEntries = _responseList(results[1]);
    final realEmails = realEmailEntries.map((item) => RealEmail(address: '${item['email'] ?? ''}', verified: item['is_verified'] == true)).where((item) => item.address.isNotEmpty).toList();
    final verificationStates = {for (final email in realEmails) email.address: email.verified};
    final usedOnEntries = _responseList(results[2]);
    final passwordEntries = _responseList(results[3]);
    final settings = _settingsMap(results[4]);
    final list = ((bindingsPayload['data'] as List?) ?? []).map((item) {
      final json = (item as Map).cast<String, dynamic>();
      final id = '${json['id'] ?? ''}';
      final usedOn = usedOnEntries.where((entry) => '${entry['proxy_binding_id'] ?? entry['related_to_id'] ?? ''}' == id).map((entry) => entry['list']).whereType<List>().expand((items) => items).map((item) => '$item').toList();
      final password = passwordEntries.where((entry) => '${entry['proxy_binding_id'] ?? entry['related_to_id'] ?? ''}' == id).map((entry) => '${entry['password'] ?? ''}').firstOrNull ?? '';
      return ProxyBinding.fromJson(json, usedOn: usedOn, password: password, verificationStates: verificationStates);
    }).toList();
    final meta = (bindingsPayload['meta'] as Map?) ?? {};
    final domainPayload = results[0];
    final domainList = (domainPayload is List ? domainPayload : (domainPayload is Map ? domainPayload['data'] : null)) as List?;
    final domains = (domainList ?? []).map((item) => item is Map ? '${item['domain'] ?? item['name'] ?? ''}' : '$item').where((item) => item.isNotEmpty).toList();
    return DashboardData(bindings: list, available: (meta['availableProxyBindings'] as num?)?.toInt() ?? 0, domains: domains, realEmails: realEmails, defaultDomain: settings['random_alias_default_domain'] ?? '', passwordPreferences: PasswordPreferences(length: int.tryParse(settings['password_length'] ?? '') ?? 13, symbols: settings['use_symbols'] != 'false', numbers: settings['use_numbers'] != 'false', letters: settings['use_letters'] != 'false'));
  }

  Future<dynamic> _optional(String path, dynamic fallback) async {
    try {
      return await _request(path, bearer: true);
    } catch (_) {
      return fallback;
    }
  }

  Future<void> createBinding({required String alias, required String domain, required String forwarding}) => _request('/api/v1/proxy-bindings', method: 'POST', body: {'data': {'type': 'proxy_bindings', 'attributes': {'proxy_address': '$alias@$domain', 'real_addresses': forwarding.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty).toList(), 'is_browsable': false}}});

  Future<void> updateBinding({required ProxyBinding binding, required String forwarding, String? description, String? callbackUrl}) => _request('/api/v1/proxy-bindings/${binding.id}', method: 'PATCH', body: {'data': {'id': binding.id, 'type': 'proxy_bindings', 'attributes': {'proxy_address': binding.address, 'description': description ?? binding.description, 'callback_url': callbackUrl ?? binding.callbackUrl, 'real_addresses': {for (final address in forwarding.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty)) address: binding.forwardingStates[address] ?? true}}}});

  Future<void> deleteBinding(ProxyBinding binding) => _request('/api/v1/proxy-bindings/${binding.id}', method: 'DELETE');

  Future<List<ProxyContact>> contacts(ProxyBinding binding) async {
    final response = await _request('/api/v1/proxy-bindings/${binding.id}/contacts');
    return _responseList(response).map((entry) {
      final attributes = (entry['attributes'] as Map?) ?? {};
      return ProxyContact(id: '${entry['id'] ?? ''}', recipientEmail: '${attributes['recipient_email'] ?? ''}', reverseProxyAddress: '${attributes['reverse_proxy_address'] ?? ''}');
    }).toList();
  }

  Future<void> createContact(ProxyBinding binding, String recipientEmail) => _request('/api/v1/contacts', method: 'POST', body: {'data': {'type': 'proxy_binding_contacts', 'attributes': {'recipient_email': recipientEmail}, 'relationships': {'proxy_binding': {'data': {'type': 'proxy_bindings', 'id': binding.id}}}}});

  Future<void> resendConfirmation(String address) => _request('/api/v1/resend-confirmation', method: 'POST', body: {'data': {'type': 'confirmation', 'attributes': {'email': address}}});

  Future<void> updateUsedOn(ProxyBinding binding, List<String> list) => _request('/gapi/used-on', method: 'PATCH', bearer: true, body: {'proxy_binding_id': binding.id, 'list': list});

  Future<void> setBindingPassword(ProxyBinding binding, String password) => _request('/gapi/passwords/proxy-binding', method: 'PATCH', bearer: true, body: {'proxy_binding_id': binding.id, 'password': password});

  Future<void> setRecipient(ProxyBinding binding, String address, bool enabled) => _request('/api/v1/proxy-bindings/${binding.id}', method: 'PATCH', body: {'data': {'id': binding.id, 'type': 'proxy_bindings', 'attributes': {'proxy_address': binding.address, 'real_addresses': {address: enabled}}}});

  Future<SettingsData> settingsData() async {
    final results = await Future.wait([_request('/gapi/available-domains', bearer: true), _request('/gapi/settings', bearer: true)]);
    final domains = _responseList(results[0]).map((item) => '${item['domain'] ?? item['name'] ?? ''}').where((item) => item.isNotEmpty).toList();
    return SettingsData(domains: domains, settings: _settingsMap(results[1]));
  }

  Future<Map<String, dynamic>> exportConfiguration({DateTime? exportedAt}) async {
    final dashboardData = await dashboard();
    SettingsData settingsDataResult;
    try {
      settingsDataResult = await settingsData();
    } catch (_) {
      settingsDataResult = const SettingsData(domains: [], settings: {});
    }
    final proxies = await Future.wait(dashboardData.bindings.map((binding) async {
      List<ProxyContact> bindingContacts;
      try {
        bindingContacts = await contacts(binding);
      } catch (_) {
        bindingContacts = const [];
      }
      return <String, dynamic>{
        'proxyAddress': binding.address,
        'description': binding.description,
        'callbackUrl': binding.callbackUrl,
        'browsable': binding.browsable,
        'targets': binding.forwarding.map((address) => {'address': address, 'enabled': binding.forwardingStates[address] != false}).toList(),
        'usedOn': binding.usedOn,
        'sitePassword': binding.password,
        'contacts': bindingContacts.map((contact) => {'recipientAddress': contact.recipientEmail, 'reverseProxyAddress': contact.reverseProxyAddress}).toList(),
      };
    }));
    return {
      'format': 'proxiedmail-portable-config',
      'version': 1,
      'exportedAt': (exportedAt ?? DateTime.now()).toUtc().toIso8601String(),
      'settings': settingsDataResult.settings,
      'proxies': proxies,
    };
  }

  Future<void> updateSettings(Map<String, String> settings) => _request('/gapi/settings/update', method: 'PATCH', bearer: true, body: {'settings': settings.entries.map((entry) => {'key': entry.key, 'value': entry.value}).toList()});

  List<Map<String, dynamic>> _responseList(dynamic response) {
    final entries = response is List ? response : response is Map ? response['data'] : null;
    return (entries as List? ?? []).map((entry) => (entry as Map).cast<String, dynamic>()).toList();
  }

  Map<String, String> _settingsMap(dynamic response) => {for (final entry in _responseList(response)) '${entry['key'] ?? ''}': '${entry['value'] ?? ''}'};

  Future<ForwardingUpdateResult> setForwarding(ProxyBinding binding, bool enabled) async {
    var succeeded = 0;
    var failed = 0;
    String? firstError;
    for (final address in binding.forwarding) {
      try {
        await _request('/api/v1/proxy-bindings/${binding.id}', method: 'PATCH', body: {'data': {'id': binding.id, 'type': 'proxy_bindings', 'attributes': {'proxy_address': binding.address, 'real_addresses': {address: enabled}}}});
        succeeded++;
      } catch (exception) {
        failed++;
        firstError ??= exception.toString().replaceFirst('Exception: ', '');
      }
    }
    return ForwardingUpdateResult(succeeded: succeeded, failed: failed, firstError: firstError);
  }
}
