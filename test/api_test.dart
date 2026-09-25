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
          return _json([{'domain': 'example.com'}, {'domain': 'custom.example'}]);
        case '/gapi/custom-domains':
          expect(request.url.queryParameters['ignoreProcessing'], '1');
          return _json([{'domain': 'custom.example'}]);
        case '/gapi/real-emails':
          return _json([{'email': 'inbox@example.com', 'is_verified': false}]);
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
    expect(data.domains, ['example.com', 'custom.example']);
    expect(data.customDomains, ['custom.example']);
    expect(data.defaultDomain, 'example.com');
    expect(data.passwordPreferences.length, 20);
    expect(data.passwordPreferences.symbols, isFalse);
    expect(data.bindings.single.callbackUrl, 'https://example.com/hook');
    expect(data.bindings.single.usedOn, ['shop.example']);
    expect(data.bindings.single.password, 'secret');
    expect(data.bindings.single.verificationStates['inbox@example.com'], isFalse);
    expect(data.realEmails.single.verified, isFalse);
  });

  test('dashboard reads recipient verification when real addresses are a list', () async {
    final client = MockClient((request) async {
      switch (request.url.path) {
        case '/api/v1/proxy-bindings':
          return _json({'data': [{'id': 'binding-1', 'attributes': {'proxy_address': 'alias@example.com', 'real_addresses': ['inbox@example.com']}}], 'meta': {}});
        case '/gapi/real-emails':
          return _json([{'email': 'inbox@example.com', 'is_verified': false}]);
        default:
          return _json([]);
      }
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    final data = await api.dashboard();

    expect(data.bindings.single.forwarding, ['inbox@example.com']);
    expect(data.bindings.single.forwardingStates['inbox@example.com'], isTrue);
    expect(data.bindings.single.verificationStates['inbox@example.com'], isFalse);
  });

  test('dashboard prefers binding verification over account email metadata', () async {
    final client = MockClient((request) async {
      switch (request.url.path) {
        case '/api/v1/proxy-bindings':
          return _json({'data': [{'id': 'binding-1', 'attributes': {'proxy_address': 'alias@example.com', 'real_addresses': {'inbox@example.com': {'is_enabled': true, 'is_verified': true}}}}], 'meta': {}});
        case '/gapi/real-emails':
          return _json([{'email': 'inbox@example.com'}]);
        default:
          return _json([]);
      }
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    final data = await api.dashboard();

    expect(data.bindings.single.verificationStates['inbox@example.com'], isTrue);
  });

  test('resends confirmation for a real email address', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return _json({});
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    await api.resendConfirmation('inbox@example.com');

    expect(captured.method, 'POST');
    expect(captured.url.toString(), '/api/v1/resend-confirmation');
    expect(jsonDecode(captured.body), {
      'data': {'type': 'confirmation', 'attributes': {'email': 'inbox@example.com'}},
    });
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
      if (request.url.path == '/gapi/custom-domains') return _json([{'attributes': {'domain': 'custom.example'}}]);
      if (request.url.path == '/gapi/real-emails') return _json([{'email': 'inbox@example.com'}]);
      if (request.url.path == '/gapi/settings') return _json([{'key': 'password_length', 'value': '18'}]);
      if (request.url.path == '/api/v1/proxy-bindings') return _json({'data': [{'id': 'settings-1', 'attributes': {'proxy_address': 'settings@example.com', 'description': 'hideIamRich: true; onlyCustomDomains: false', 'real_addresses': {'settings@proxiedmail.internal': {'is_enabled': false}}}}]});
      fail('Unexpected request: ${request.url}');
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    final data = await api.settingsData();

    expect(data.domains, ['example.com']);
    expect(data.customDomains, ['custom.example']);
    expect(data.targetAddresses, ['inbox@example.com']);
    expect(data.appSettings, {'hideIamRich': 'true', 'onlyCustomDomains': 'false'});
    expect(data.settings['password_length'], '18');
  });

  test('replaces a target address in bulk', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return _json({});
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';

    await api.replaceTargetAddress(oldEmail: 'old@example.com', newEmail: 'new@example.com');

    expect(captured.method, 'POST');
    expect(captured.url.toString(), '/api/v1/emails/replace');
    expect(jsonDecode(captured.body), {
      'data': {'type': 'replace-real-emails', 'attributes': {'oldEmail': 'old@example.com', 'newEmail': 'new@example.com'}},
    });
  });

  test('configuration export is portable and excludes authentication tokens', () async {
    final client = MockClient((request) async {
      switch (request.url.path) {
        case '/api/v1/proxy-bindings':
          return _json({'data': [{'id': 'binding-1', 'attributes': {'proxy_address': 'alias@example.com', 'description': 'Shopping', 'callback_url': 'https://example.com/hook', 'is_browsable': true, 'real_addresses': {'inbox@example.com': {'is_enabled': false}}}}, {'id': 'settings-1', 'attributes': {'proxy_address': 'settings@example.com', 'description': 'hideIamRich: true; onlyCustomDomains: false', 'real_addresses': {'settings@proxiedmail.internal': {'is_enabled': false}}}}], 'meta': {}});
        case '/api/v1/proxy-bindings/binding-1/contacts':
          return _json({'data': [{'id': 'contact-1', 'attributes': {'recipient_email': 'shop@example.net', 'reverse_proxy_address': 'reverse@example.com'}}]});
        case '/gapi/available-domains':
          return _json([{'domain': 'example.com'}]);
        case '/gapi/real-emails':
          return _json([{'email': 'inbox@example.com'}]);
        case '/gapi/used-on':
          return _json([{'proxy_binding_id': 'binding-1', 'list': ['shop.example']}]);
        case '/gapi/passwords':
          return _json([{'related_to_id': 'binding-1', 'password': 'site-secret'}]);
        case '/gapi/settings':
          return _json([{'key': 'random_alias_default_domain', 'value': 'example.com'}]);
        default:
          fail('Unexpected request: ${request.url}');
      }
    });
    final api = ProxiedMailApi(client: client)
      ..apiToken = 'authentication-secret'
      ..bearerToken = 'bearer-secret';

    final export = await api.exportConfiguration(exportedAt: DateTime.utc(2026, 9, 25));
    final proxy = (export['proxies'] as List).single as Map<String, dynamic>;

    expect(export['format'], 'proxiedmail-portable-config');
    expect(export['version'], 1);
    expect(export['exportedAt'], '2026-09-25T00:00:00.000Z');
    expect(export['appSettings'], {'hideIamRich': 'true', 'onlyCustomDomains': 'false'});
    expect(proxy['proxyAddress'], 'alias@example.com');
    expect(proxy['targets'], [{'address': 'inbox@example.com', 'enabled': false}]);
    expect(proxy['usedOn'], ['shop.example']);
    expect(proxy['sitePassword'], 'site-secret');
    expect(proxy['contacts'], [{'recipientAddress': 'shop@example.net', 'reverseProxyAddress': 'reverse@example.com'}]);
    expect(jsonEncode(export), isNot(contains('authentication-secret')));
    expect(jsonEncode(export), isNot(contains('bearer-secret')));
  });

  test('binding update sends all editable fields and recipient states', () async {
    late http.Request captured;
    final client = MockClient((request) async {
      captured = request;
      return _json({});
    });
    final api = ProxiedMailApi(client: client)..apiToken = 'api-token';
    const binding = ProxyBinding(id: 'binding-1', address: 'alias@example.com', description: '', browsable: false, forwarding: ['old@example.com'], forwardingStates: {'old@example.com': false}, verificationStates: {'old@example.com': true}, forwarded: 0);

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
