import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'

import { ProxyApiService } from './proxy-api.service'

describe('ProxyApiService', () => {
  let api: ProxyApiService
  let http: HttpTestingController

  beforeEach(() => {
    localStorage.clear()
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] })
    api = TestBed.inject(ProxyApiService)
    http = TestBed.inject(HttpTestingController)
  })

  afterEach(() => {
    http.verify()
    localStorage.clear()
  })

  it('exchanges a rejected supplied token as bearer and retries dashboard loading', async () => {
    localStorage.setItem('proxiedmail.apiToken', 'bearer-candidate')

    const result = api.dashboard()

    const initial = http.expectOne('/api/v1/proxy-bindings?sort=desc')
    expect(initial.request.headers.get('Token')).toBe('bearer-candidate')
    initial.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' })
    await Promise.resolve()

    const exchange = http.expectOne('/api/v1/api-token')
    expect(exchange.request.headers.get('Authorization')).toBe('Bearer bearer-candidate')
    exchange.flush({ token: 'api-token' })
    await Promise.resolve()

    const retry = http.expectOne('/api/v1/proxy-bindings?sort=desc')
    expect(retry.request.headers.get('Token')).toBe('api-token')
    retry.flush({ data: [], meta: { availableProxyBindings: 4 } })
    await Promise.resolve()
    await Promise.resolve()

    http.expectOne('/gapi/available-domains').flush([])
    http.expectOne('/gapi/real-emails').flush([])
    http.expectOne('/gapi/used-on').flush([])
    http.expectOne('/gapi/passwords').flush([])
    http.expectOne('/gapi/settings').flush([])

    expect((await result).available).toBe(4)
    expect(localStorage.getItem('proxiedmail.apiToken')).toBe('api-token')
    expect(localStorage.getItem('proxiedmail.bearerToken')).toBe('bearer-candidate')
  })

  it('exports portable proxy configuration without authentication tokens', async () => {
    localStorage.setItem('proxiedmail.apiToken', 'authentication-secret')
    localStorage.setItem('proxiedmail.bearerToken', 'bearer-secret')

    const result = api.exportConfiguration()

    http.expectOne('/api/v1/proxy-bindings?sort=desc').flush({
      data: [{ id: 'binding-1', attributes: { proxy_address: 'alias@example.com', description: 'Shopping', callback_url: 'https://example.com/hook', is_browsable: true, real_addresses: { 'inbox@example.com': { is_enabled: false } } } }],
      meta: {},
    })
    await Promise.resolve()
    await Promise.resolve()

    http.expectOne('/gapi/available-domains').flush([{ domain: 'example.com' }])
    http.expectOne('/gapi/real-emails').flush([{ email: 'inbox@example.com' }])
    http.expectOne('/gapi/used-on').flush([{ proxy_binding_id: 'binding-1', list: ['shop.example'] }])
    http.expectOne('/gapi/passwords').flush([{ related_to_id: 'binding-1', password: 'site-secret' }])
    http.expectOne('/gapi/settings').flush([{ key: 'random_alias_default_domain', value: 'example.com' }])
    await new Promise(resolve => setTimeout(resolve, 0))

    http.expectOne('/gapi/settings').flush([{ key: 'random_alias_default_domain', value: 'example.com' }])
    await new Promise(resolve => setTimeout(resolve, 0))

    http.expectOne('/api/v1/proxy-bindings/binding-1/contacts').flush({ data: [{ id: 'contact-1', attributes: { recipient_email: 'shop@example.net', reverse_proxy_address: 'reverse@example.com' } }] })

    const exported = await result
    expect(exported.format).toBe('proxiedmail-portable-config')
    expect(exported.version).toBe(1)
    expect(exported.settings).toEqual({ random_alias_default_domain: 'example.com' })
    expect(exported.proxies[0]).toEqual({
      proxyAddress: 'alias@example.com',
      description: 'Shopping',
      callbackUrl: 'https://example.com/hook',
      browsable: true,
      targets: [{ address: 'inbox@example.com', enabled: false }],
      usedOn: ['shop.example'],
      sitePassword: 'site-secret',
      contacts: [{ recipientAddress: 'shop@example.net', reverseProxyAddress: 'reverse@example.com' }],
    })
    expect(JSON.stringify(exported)).not.toContain('authentication-secret')
    expect(JSON.stringify(exported)).not.toContain('bearer-secret')
  })
})
