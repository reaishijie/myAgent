import { BusinessException } from '../core/exceptions'

export type FetchLike = typeof fetch

export const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

export const requireConfig = (value: string | undefined, name: string) => {
  if (!value) {
    throw new BusinessException(`Missing required environment variable: ${name}`, 500, 'MODEL_CONFIG_MISSING')
  }

  return value
}

export const readJsonResponse = async <T>(response: Response, providerName: string): Promise<T> => {
  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new BusinessException(`${providerName} API request failed`, 502, 'MODEL_API_FAILED')
  }

  return body as T
}
