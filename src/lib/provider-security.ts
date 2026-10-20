export function validateProviderUrl(value: string) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error(
      'API 地址需使用 HTTP 或 HTTPS，且不能包含账号、查询参数或片段',
    )
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (
    hostname === 'localhost' ||
    !hostname.includes('.') ||
    /\.(localhost|local|internal|test|invalid)$/.test(hostname)
  )
    throw new Error('请使用可公开访问的 API 域名')
  if (hostname.startsWith('[')) throw new Error('请使用 API 域名而非 IPv6 地址')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const [first, second] = hostname.split('.').map(Number)
    if (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 198 && (second === 18 || second === 19))
    )
      throw new Error('API 地址不能指向内部或保留网络')
  }
  return url.toString().replace(/\/$/, '')
}

async function encryptionKey(secret: string) {
  const bytes = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0))
  if (bytes.length !== 32)
    throw new Error('APP_ENCRYPTION_KEY 必须是 Base64 编码的 32 字节密钥')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

export async function sealKey(value: string, secret: string, ownerId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ownerId) },
    await encryptionKey(secret),
    new TextEncoder().encode(value),
  )
  return `v1.${encode(iv)}.${encode(new Uint8Array(data))}`
}

export async function openKey(value: string, secret: string, ownerId: string) {
  const [version, iv, ciphertext] = value.split('.')
  if (version !== 'v1' || !iv || !ciphertext)
    throw new Error('不支持的密钥格式')
  const decode = (part: string) =>
    Uint8Array.from(atob(part), (char) => char.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decode(iv),
      additionalData: new TextEncoder().encode(ownerId),
    },
    await encryptionKey(secret),
    decode(ciphertext),
  )
  return new TextDecoder().decode(decrypted)
}
