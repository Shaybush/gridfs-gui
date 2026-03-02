export interface Connection {
  id: string
  name: string
  uri_masked: string
  tls: boolean
  created_at: string
  updated_at: string
}

export interface ConnectionCreate {
  name: string
  uri: string
  tls?: boolean
  tls_ca_file?: string
}

export interface ConnectionUpdate {
  name?: string
  uri?: string
  tls?: boolean
  tls_ca_file?: string
}

export interface TestConnectionResult {
  ok: boolean
  latency_ms?: number
  error?: string
}
