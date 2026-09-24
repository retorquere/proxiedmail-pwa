import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:proxiedmail_dashboard/api.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('login stores a long-lived API token without a network exchange', () async {
    SharedPreferences.setMockInitialValues({'proxiedmail.bearerToken': 'stale'});
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      fail('Unexpected request: ${request.url}');
    });
    final api = ProxiedMailApi(client: client);

    await api.login('api-token');

    expect(requests, isEmpty);
    expect(api.apiToken, 'api-token');
    expect(api.bearerToken, isNull);
    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getString('proxiedmail.apiToken'), 'api-token');
    expect(preferences.getString('proxiedmail.bearerToken'), isNull);
  });

  test('dashboard merges binding metadata and account settings', () async {
    final client = MockClient((request) async {
      switch (request.url.path) {
        case '/api/v1/proxy-bindings':
          expect(request.headers['Token'], 'api-token');
          return _json({'data': [{'id': 'binding-1', 'attributes': {'proxy_address': 'alias@example.com', 'description': 'Shopping', 'callback_url': 'https://example.com/hook', 'received_emails': 7, 'real_addresses': {'inbox@example.com': {'is_enabled': true}}}}], 'meta': {'availableProxyBindings': 12}});
        case '/gapi/available-domains':
          expect(request.headers['Authorization'], 'Bearer bearer-token');
          return _json([{'domain': 'example.com'}]);
        case '/gapi/real-emails':
          return _json([{'email': 'inbox@example.com'}]);
        case '/gapi/used-on':
          return _json([{'proxy_binding_id': 'binding-1', 'list': ['shop.example']}]);
        case '/gapi/passwords':
          return _json([{'related_to_id': 'binding-1', 'password': 'secret'}]);
        case '/gapi/settings':
          return _json([{'key': 'random_alias_default_domain', 'value': 'example.com'}, {'key': 'password_length', 'value': '20'}, {'key': 'use_symbols', 'value': 'false'}]);
        default:
          fail('Unexpected request: ${request.url}');
      }
    });
    final api = ProxiedMailApi(client: client)
      ..apiToken = 'api-token'
      ..bearerToken = 'bearer-token';

    final data = await api.dashboard();

    expect(data.available, 12);
    expect(data.defaultDomain, 'example.com');
    expect(data.passwordPreferences.length, 20);
    expect(data.passwordPreferences.symbols, isFalse);
    expect(data.bindings.single.callbackUrl, 'https://example.com/hook');
    expect(data.bindings.single.usedOn, ['shop.example']);
    expect(data.bindings.single.password, 'secret');
  });

  test('dashboard loads core bindings when optional metadata requests fail', () async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/proxy-bindings') {
        return _json({'data': [{'id': 'binding-1', 'attributes': {'proxy_address': 'alias@example.com', 'real_addresses': {}}}], 'meta': {'availableProxyBindings': 3}});
      }
      return http.Response(jsonEncode({'message': 'Forbidden'}), 403);
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    final data = await api.dashboard();

    expect(data.bindings.single.address, 'alias@example.com');
    expect(data.available, 3);
    expect(data.domains, isEmpty);
  });

  test('settings use the supplied token as Bearer when no separate bearer is stored', () async {
    final client = MockClient((request) async {
      expect(request.headers['Authorization'], 'Bearer api-token');
      if (request.url.path == '/gapi/available-domains') return _json([{'domain': 'example.com'}]);
      if (request.url.path == '/gapi/settings') return _json([{'key': 'password_length', 'value': '18'}]);
      fail('Unexpected request: ${request.url}');
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    final data = await api.settingsData();

    expect(data.domains, ['example.com']);
    expect(data.settings['password_length'], '18');
  });

  test('binding update sends all editable fields and recipient states', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return _json({});
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';
    const binding = ProxyBinding(id: 'binding-1', address: 'alias@example.com', description: '', browsable: false, forwarding: ['old@example.com'], forwardingStates: {'old@example.com': false}, forwarded: 0);

    await api.updateBinding(binding: binding, forwarding: 'old@example.com, new@example.com', description: 'Accounts', callbackUrl: 'https://example.com/callback');

    expect(captured.method, 'PATCH');
    expect(captured.url.toString(), '/api/v1/proxy-bindings/binding-1');
    final attributes = (jsonDecode(captured.body)['data']['attributes'] as Map).cast<String, dynamic>();
    expect(attributes['description'], 'Accounts');
    expect(attributes['callback_url'], 'https://example.com/callback');
    expect(attributes['real_addresses'], {'old@example.com': false, 'new@example.com': true});
  });
}

http.Response _json(Object body) => http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json'});
