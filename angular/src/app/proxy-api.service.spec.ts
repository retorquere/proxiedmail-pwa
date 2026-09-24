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
})
