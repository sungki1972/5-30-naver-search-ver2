import { env } from "./config";
import { fetch as undiciFetch, Agent } from "undici";

// Next.js는 global fetch를 패치해 dispatcher 옵션을 무시하므로 undici fetch를 직접 사용.
// WSL2 등 IPv6 끊김 환경에서 api.telegram.org ETIMEDOUT 회피 — IPv4 강제. Vercel에서도 무해.
const ipv4Agent = new Agent({ connect: { family: 4 } });

export async function sendTelegram(text: string): Promise<boolean> {
  const token = env.telegramToken();
  const chatId = env.telegramChatId();
  if (!token || !chatId) {
    console.warn("[telegram] 토큰/챗ID 미설정 — 발송 생략");
    return false;
  }
  try {
    const res = await undiciFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      dispatcher: ipv4Agent,
    });
    if (!res.ok) {
      console.error("[telegram] 발송 실패:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] 발송 예외:", e instanceof Error ? e.message : e);
    return false;
  }
}
