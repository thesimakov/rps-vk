"use client"

import { useEffect, useState } from "react"
import { parseVKHashFragment, VK_OAUTH_MESSAGE_TYPE } from "@/lib/vk-oauth"

/**
 * Страница, открываемая в попапе после редиректа из VK OAuth.
 * Парсит hash, отправляет токен в основное окно через postMessage и закрывает попап.
 */
export default function VKCallbackPage() {
  const [status, setStatus] = useState<"sending" | "done" | "no_data">("sending")

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    const parsed = parseVKHashFragment(hash)
    if (parsed && window.opener) {
      try {
        window.opener.postMessage(
          {
            type: VK_OAUTH_MESSAGE_TYPE,
            access_token: parsed.access_token,
            user_id: parsed.user_id,
            expires_in: parsed.expires_in,
          },
          window.location.origin
        )
        setStatus("done")
        window.close()
      } catch {
        setStatus("no_data")
      }
    } else {
      setStatus("no_data")
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
      {status === "sending" && <p className="text-sm">Вход выполнен. Окно закроется…</p>}
      {status === "done" && <p className="text-sm">Готово. Можно закрыть это окно.</p>}
      {status === "no_data" && (
        <p className="text-sm text-white/80">
          Окно авторизации. Если вы уже вошли в игру, можно закрыть эту вкладку.
        </p>
      )}
    </div>
  )
}
