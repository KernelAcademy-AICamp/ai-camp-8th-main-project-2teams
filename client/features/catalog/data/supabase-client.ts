// 브라우저 Supabase 클라이언트(싱글턴). publishable 키 — RLS가 읽기만 허용하므로 브라우저 노출 OK.
// secret/service_role 키는 절대 여기 쓰지 않는다(전체 권한).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Supabase 환경변수 누락: client/.env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 설정하세요 (.env.example 참고).",
  );
}

export const supabase = createClient(url, publishableKey);
