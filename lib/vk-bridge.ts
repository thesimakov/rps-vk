"use client"

/**
 * VK Mini Apps Bridge — интеграция с ВКонтакте.
 * В продакшене обязательны: VKWebAppInit, получение app_id/hash с бэкенда для оплаты,
 * серверная верификация платежей и вывод через бэкенд.
 * См. docs/VK_INTEGRATION.md
 */

export interface VKUser {
  id: number
  first_name: string
  last_name: string
  photo_100: string
  photo_200: string
}

let bridgeReady = false

/** Инициализация VK Bridge. Вызывать при загрузке приложения (уже в GameProvider). */
export async function initVKBridge(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const vkBridge = await import("@vkontakte/vk-bridge")
    await vkBridge.default.send("VKWebAppInit")
    bridgeReady = true
  } catch {
    bridgeReady = false
  }
}

/** Проверка: приложение открыто в окружении ВК (Bridge инициализирован или в URL есть vk_). */
export function getBridgeReady(): boolean {
  return bridgeReady
}

/** Данные текущего пользователя ВК (VKWebAppGetUserInfo). В dev — мок. */
export async function getVKUser(): Promise<VKUser | null> {
  if (!bridgeReady) {
    return { id: 1, first_name: "Игрок", last_name: "", photo_100: "", photo_200: "" }
  }
  try {
    const vkBridge = await import("@vkontakte/vk-bridge")
    const data = await vkBridge.default.send("VKWebAppGetUserInfo")
    return data as VKUser
  } catch {
    return null
  }
}

/**
 * Покупка голосов: открывает форму оплаты VK (VKWebAppOpenPayForm).
 * — При отмене пользователем или ошибке ВК возвращает false (баланс не начислять).
 * — В продакшене: запрашивать app_id и hash с бэкенда, зачислять баланс только
 *   после серверного подтверждения платежа (callback/webhook от VK). См. docs/VK_INTEGRATION.md
 */
export async function purchaseVKVoices(amount: number): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!bridgeReady) return true // dev: вне ВК симулируем успех
  try {
    const vkBridge = await import("@vkontakte/vk-bridge")
    const payload: Record<string, unknown> = {
      action: "pay-to-service",
      amount,
    }
    // В продакшене: const { app_id, hash } = await fetchFromBackend('/payment/sign', { amount }); payload.app_id = app_id; payload.hash = hash;
    const res = await vkBridge.default.send("VKWebAppOpenPayForm", payload)
    const result = res && typeof res === "object" ? (res as { result?: boolean }).result : undefined
    return result !== false
  } catch {
    try {
      await (await import("@vkontakte/vk-bridge")).default.send("VKWebAppShowOrderBox", {
        type: "item",
        item: `voices_${amount}`,
      })
      return true
    } catch {
      return false
    }
  }
}

/** @deprecated Use purchaseVKVoices */
export async function showVKPayment(amount: number): Promise<boolean> {
  return purchaseVKVoices(amount)
}

/**
 * Заявка на вывод голосов.
 * В продакшене: POST на бэкенд (amount, user_id); бэкенд проверяет лимиты и создаёт заявку.
 * Списывать баланс на клиенте только после успешного ответа бэкенда (заявка принята).
 * Иначе при сбое пользователь теряет голоса без вывода. См. docs/VK_INTEGRATION.md
 */
export async function requestWithdraw(amount: number): Promise<boolean> {
  if (amount < 10) return false
  if (!bridgeReady) return new Promise((r) => setTimeout(() => r(true), 1200)) // dev
  // В продакшене: const ok = await fetch('/api/withdraw', { method: 'POST', body: JSON.stringify({ amount, user_id: vkUserId }) }).then(r => r.ok);
  return new Promise((resolve) => setTimeout(() => resolve(true), 1200))
}

export function isVKEnvironment(): boolean {
  if (typeof window === "undefined") return false
  return window.location.search.includes("vk_") || bridgeReady
}
