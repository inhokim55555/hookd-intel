import type { ExploreFilters, ExploreResponse, CloneAdResponse } from './types'

const BASE_URL = 'https://app.gethookd.ai'

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${process.env.GETHOOKD_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export class GethookdError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'GethookdError'
  }
}

export async function exploreAds(filters: ExploreFilters): Promise<ExploreResponse> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })

  const res = await fetch(`${BASE_URL}/api/v1/explore?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  })

  const data = await res.json()
  if (!res.ok) throw new GethookdError(data.message ?? 'Gethookd API error', res.status)
  return data
}

export async function checkAuth() {
  const res = await fetch(`${BASE_URL}/api/v1/authcheck`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  })
  return res.json()
}

export async function createCloneAd(payload: {
  ad_id: number
  prompt?: string
  aspect_ratio?: string
  variations_count?: number
}): Promise<CloneAdResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/clone-ads`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const data = await res.json()
  if (!res.ok) throw new GethookdError(data.message ?? 'Failed to create clone', res.status)
  return data
}

export async function getCloneAd(cloneId: number): Promise<CloneAdResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/clone-ads/${cloneId}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  })

  const data = await res.json()
  if (!res.ok) throw new GethookdError(data.message ?? 'Failed to get clone', res.status)
  return data
}
