const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'))

const importAesKey = async (secret: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))

  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export const encryptSecret = async (plainText: string, secret = process.env.SECRET_ENCRYPTION_KEY || 'myagent-local-secret') => {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const key = await importAesKey(secret)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plainText))

  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`
}

export const decryptSecret = async (encryptedText: string, secret = process.env.SECRET_ENCRYPTION_KEY || 'myagent-local-secret') => {
  const [version, iv, encrypted] = encryptedText.split(':')
  if (version !== 'v1' || !iv || !encrypted) {
    throw new Error('Invalid encrypted secret')
  }

  const key = await importAesKey(secret)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(encrypted),
  )

  return decoder.decode(decrypted)
}
