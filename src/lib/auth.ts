import { env } from "./config";

// cron/job 엔드포인트 인증.
// - Vercel Cron: Authorization: Bearer <CRON_SECRET>
// - self-chain: x-cron-secret 헤더
// - QStash: (운영 시 verifySignature 권장; 여기선 토큰 헤더 폴백)
export function authorize(req: Request): boolean {
  const secret = env.cronSecret();
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}
