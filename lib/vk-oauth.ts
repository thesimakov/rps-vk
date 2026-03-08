"use client"

/**
 * VK OAuth для входа на своём сервере (вне мини-приложения ВК).
 * После входа оплата и действия с ВК по-прежнему через VK (в мини-приложении или при подключении).
 * См. https://dev.vk.com/api/access-token/implicit-flow-user
 */

import type { VKUser } from "./vk-bridge"

const VK_OAUTH_STORAGE_KEY = "rps_vk_oauth"
const VK_API_VERSION = "5.199"

export interface VKOAuthSession {
  access_token: string
  user_id: number
  expires_at: number
  user: VKUser
}

function getAppId(): string {
  return typeof process.env.NEXT_PUBLIC_VK_APP_ID === "string" ? process.env.NEXT_PUBLIC_VK_APP_ID : ""
}

/**
 * Строит URL для редиректа на авторизацию VK (Implicit Flow).
 * redirect_uri должен совпадать с указанным в настройках приложения ВК.
 */
export function getVKOAuthRedirectUrl(redirectUri?: string): string {
  const clientId = getAppId()
  if (!clientId) {
    console.warn("NEXT_PUBLIC_VK_APP_ID не задан — вход через ВК на своём сервере недоступен")
  }
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : ""
  const redirect = redirectUri ?? base
  const params = new URLSearchParams({
    client_id: clientId || "0",
    redirect_uri: redirect,
    response_type: "token",
    scope: "",
    v: VK_API_VERSION,
    revoke: "1",
  })
  return `https://oauth.vk.com/authorize?${params.toString()}`
}

/**
 * Парсит фрагмент URL после редиректа от VK (access_token, user_id, expires_in).
 */
export function parseVKHashFragment(hash: string): { access_token: string; user_id: number; expires_in: number } | null {
  if (!hash || !hash.startsWith("#")) return null
  const params = new URLSearchParams(hash.slice(1))
  const access_token = params.get("access_token")
  const user_id = params.get("user_id")
  const expires_in = params.get("expires_in")
  if (!access_token || !user_id) return null
  const uid = parseInt(user_id, 10)
  const exp = expires_in ? parseInt(expires_in, 10) : 0
  if (!Number.isFinite(uid)) return null
  return { access_token, user_id: uid, expires_in: exp }
}

/**
 * Запрашивает данные пользователя ВК по access_token (users.get).
 */
export async function fetchVKUserByToken(accessToken: string, userId: number): Promise<VKUser | null> {
  const url = new URL("https://api.vk.com/method/users.get")
  url.searchParams.set("user_ids", String(userId))
  url.searchParams.set("fields", "photo_100,photo_200")
  url.searchParams.set("access_token", accessToken)
  url.searchParams.set("v", VK_API_VERSION)
  try {
    const res = await fetch(url.toString())
    const data = (await res.json()) as { response?: Array<{ id: number; first_name: string; last_name: string; photo_100?: string; photo_200?: string }> }
    const user = data?.response?.[0]
    if (!user) return null
    return {
      id: user.id,
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      photo_100: user.photo_100 ?? "",
      photo_200: user.photo_200 ?? user.photo_100 ?? "",
    }
  } catch {
    return null
  }
}

const SESSION_KEY = "rps_vk_oauth_session"

/** Сохраняет сессию в localStorage (для входа после перезагрузки). */
export function saveVKOAuthSession(session: VKOAuthSession): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

/** Читает сессию из localStorage. Возвращает null если нет или истекла. */
export function getStoredVKOAuthSession(): VKOAuthSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as VKOAuthSession
    if (!session?.access_token || !session?.user || !session.expires_at) return null
    if (session.expires_at * 1000 < Date.now()) {
      clearVKOAuthSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

/** Удаляет сохранённую сессию. */
export function clearVKOAuthSession(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

/** Есть ли настроенный APP_ID для OAuth (вход на своём сервере). */
export function isVKOAuthConfigured(): boolean {
  return !!getAppId()
}
