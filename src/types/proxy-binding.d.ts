export interface RealAddress {
  is_enabled: boolean
  is_verification_needed: boolean
  is_verified: boolean
}

export interface ProxyBinding {
  id: string
  proxy_address: string
  description?: string
  is_browsable?: boolean
  callback_url?: string
  received_emails?: number
  real_addresses?: Record<string, RealAddress>
}

export interface ProxyBindingContact {
  id: string
  recipient_email: string
  reverse_proxy_address: string
  description: string
  status: number
}
