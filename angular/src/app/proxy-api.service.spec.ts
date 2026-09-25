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
    http.expectOne('/gapi/custom-domains?ignoreProcessing=1').flush([])
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
      data: [{ id: 'binding-1', attributes: { proxy_address: 'alias@example.com', description: 'Shopping', callback_url: 'https://example.com/hook', is_browsable: true, real_addresses: { 'inbox@example.com': { is_enabled: false } } } }, { id: 'settings-1', attributes: { proxy_address: 'settings@example.com', description: 'hideIamRich: true; onlyCustomDomains: false', real_addresses: { 'settings@proxiedmail.internal': { is_enabled: false } } } }],
      meta: {},
    })
    await Promise.resolve()
    await Promise.resolve()

    http.expectOne('/gapi/available-domains').flush([{ domain: 'example.com' }])
    http.expectOne('/gapi/custom-domains?ignoreProcessing=1').flush([{ domain: 'custom.example' }])
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
    expect(exported.appSettings).toEqual({ hideIamRich: 'true', onlyCustomDomains: 'false' })
    expect(exported.proxies).toHaveLength(1)
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

  it('keeps recipient verification states from proxy bindings', async () => {
    localStorage.setItem('proxiedmail.apiToken', 'api-token')

    const result = api.dashboard()

    http.expectOne('/api/v1/proxy-bindings?sort=desc').flush({
      data: [{ id: 'binding-1', attributes: { proxy_address: 'alias@example.com', real_addresses: { 'inbox@example.com': { is_enabled: true, is_verified: false } } } }],
      meta: {},
    })
    await Promise.resolve()
    await Promise.resolve()

    http.expectOne('/gapi/available-domains').flush([])
    http.expectOne('/gapi/custom-domains?ignoreProcessing=1').flush([])
    http.expectOne('/gapi/real-emails').flush([{ email: 'inbox@example.com' }])
    http.expectOne('/gapi/used-on').flush([])
    http.expectOne('/gapi/passwords').flush([])
    http.expectOne('/gapi/settings').flush([])

    expect((await result).bindings[0].verificationStates['inbox@example.com']).toBe(false)
  })

  it('loads custom domains for dashboard domain filtering', async () => {
    localStorage.setItem('proxiedmail.apiToken', 'api-token')

    const result = api.dashboard()

    http.expectOne('/api/v1/proxy-bindings?sort=desc').flush({ data: [], meta: {} })
    await Promise.resolve()
    await Promise.resolve()

    http.expectOne('/gapi/available-domains').flush([{ domain: 'example.com' }, { domain: 'custom.example' }])
    http.expectOne('/gapi/custom-domains?ignoreProcessing=1').flush([{ attributes: { domain: 'custom.example' } }])
    http.expectOne('/gapi/real-emails').flush([])
    http.expectOne('/gapi/used-on').flush([])
    http.expectOne('/gapi/passwords').flush([])
    http.expectOne('/gapi/settings').flush([])

    expect((await result).customDomains).toEqual(['custom.example'])
  })

  it('replaces a target address in bulk', async () => {
    localStorage.setItem('proxiedmail.apiToken', 'api-token')

    api.replaceTargetAddress('old@example.com', 'new@example.com').subscribe()

    const request = http.expectOne('/api/v1/emails/replace')
    expect(request.request.method).toBe('POST')
    expect(request.request.body).toEqual({ data: { type: 'replace-real-emails', attributes: { oldEmail: 'old@example.com', newEmail: 'new@example.com' } } })
    request.flush({})
  })
})
