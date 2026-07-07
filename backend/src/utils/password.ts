const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

const hashWithWebCrypto = async (password: string) => {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 210000,
    },
    key,
    256,
  )

  return `$pbkdf2-sha256$210000$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`
}

export const hashPassword = async (password: string) => {
  if ('Bun' in globalThis) {
    return Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 10,
    })
  }

  return hashWithWebCrypto(password)
}
