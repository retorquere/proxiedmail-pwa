import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ProxyBinding {
  const ProxyBinding({required this.id, required this.address, required this.description, required this.browsable, required this.forwarding, required this.forwardingStates, required this.forwarded});

  final String id;
  final String address;
  final String description;
  final bool browsable;
  final List<String> forwarding;
  final Map<String, bool> forwardingStates;
  final int forwarded;

  factory ProxyBinding.fromJson(Map<String, dynamic> json) {
    final attributes = (json['attributes'] as Map?)?.cast<String, dynamic>() ?? {};
    final realAddressMap = (attributes['real_addresses'] as Map?)?.cast<String, dynamic>() ?? {};
    final realAddresses = realAddressMap.keys.toList();
    final forwardingStates = {for (final entry in realAddressMap.entries) entry.key: (entry.value is Map ? (entry.value['is_enabled'] != false) : true)};
    return ProxyBinding(id: '${json['id'] ?? ''}', address: '${attributes['proxy_address'] ?? 'Unnamed address'}', description: '${attributes['description'] ?? ''}', browsable: attributes['is_browsable'] == true, forwarding: realAddresses, forwardingStates: forwardingStates, forwarded: (attributes['received_emails'] as num?)?.toInt() ?? 0);
  }
}

class DashboardData {
  const DashboardData({required this.bindings, required this.available, required this.twoFactor, required this.domains, required this.realEmails});

  final List<ProxyBinding> bindings;
  final int available;
  final bool twoFactor;
  final List<String> domains;
  final List<String> realEmails;

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
    if (apiToken != null) await preferences.setString('proxiedmail.apiToken', apiToken!);
    if (bearerToken != null) await preferences.setString('proxiedmail.bearerToken', bearerToken!);
  }

  Future<void> clearStoredTokens() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove('proxiedmail.apiToken');
    await preferences.remove('proxiedmail.bearerToken');
    apiToken = null;
    bearerToken = null;
  }

  Map<String, String> _headers({bool bearer = false}) => {'Accept': 'application/json', 'Content-Type': 'application/json', if (bearer && bearerToken != null) 'Authorization': 'Bearer $bearerToken', if (!bearer && apiToken != null) 'Token': apiToken!};

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

  Future<void> login(String username, String password) async {
    final auth = await _request('/api/v1/auth', method: 'POST', body: {'data': {'type': 'auth-request', 'attributes': {'username': username, 'password': password}}});
    bearerToken = auth['data']?['attributes']?['token'] as String?;
    if (bearerToken == null) throw Exception('Login did not return a bearer token.');
    final token = await _request('/api/v1/api-token', bearer: true);
    apiToken = token['token'] as String? ?? token['data']?['attributes']?['token'] as String?;
    if (apiToken == null) throw Exception('API token response was incomplete.');
    await _storeTokens();
  }

  Future<void> register(String username, String password) => _request('/api/v1/users', method: 'POST', body: {'data': {'type': 'users', 'attributes': {'username': username, 'password': password}}});

  Future<DashboardData> dashboard() async {
    final results = await Future.wait([_request('/api/v1/proxy-bindings?sort=desc'), _request('/api/v1/users/me'), _request('/gapi/available-domains', bearer: true), _request('/gapi/real-emails', bearer: true)]);
    final bindingsPayload = results[0] as Map;
    final profile = results[1] as Map;
    final list = ((bindingsPayload['data'] as List?) ?? []).map((item) => ProxyBinding.fromJson((item as Map).cast<String, dynamic>())).toList();
    final meta = (bindingsPayload['meta'] as Map?) ?? {};
    final attributes = (profile['data']?['attributes'] as Map?) ?? {};
    final domainPayload = results[2];
    final emailPayload = results[3];
    final domainList = (domainPayload is List ? domainPayload : (domainPayload is Map ? domainPayload['data'] : null)) as List?;
    final emailList = (emailPayload is List ? emailPayload : (emailPayload is Map ? emailPayload['data'] : null)) as List?;
    final domains = (domainList ?? []).map((item) => item is Map ? '${item['domain'] ?? item['name'] ?? ''}' : '$item').where((item) => item.isNotEmpty).toList();
    final realEmails = (emailList ?? []).map((item) => item is Map ? '${item['email'] ?? ''}' : '$item').where((item) => item.isNotEmpty).toList();
    return DashboardData(bindings: list, available: (meta['availableProxyBindings'] as num?)?.toInt() ?? 0, twoFactor: attributes['two_factor_enabled'] == true || attributes['twoFactorEnabled'] == true, domains: domains, realEmails: realEmails);
  }

  Future<void> createBinding({required String alias, required String domain, required String forwarding}) => _request('/api/v1/proxy-bindings', method: 'POST', body: {'data': {'type': 'proxy_bindings', 'attributes': {'proxy_address': '$alias@$domain', 'real_addresses': forwarding.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty).toList(), 'is_browsable': false}}});

  Future<void> updateBinding({required ProxyBinding binding, required String forwarding}) => _request('/api/v1/proxy-bindings/${binding.id}', method: 'PATCH', body: {'data': {'id': binding.id, 'type': 'proxy_bindings', 'attributes': {'proxy_address': binding.address, 'real_addresses': {for (final address in forwarding.split(',').map((item) => item.trim()).where((item) => item.isNotEmpty)) address: binding.forwardingStates[address] ?? true}}}});

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
