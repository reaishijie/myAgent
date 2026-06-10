export const maskSecret = (secret?: string | null) => {
  if (!secret) {
    return ''
  }

  if (secret.length <= 8) {
    return '****'
  }

  return `${secret.slice(0, 3)}****${secret.slice(-4)}`
}
