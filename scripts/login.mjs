// 네이버 로그인 세션 생성 — 사용자가 직접 로그인, 세션만 .pw-profile/에 저장.
// 실행: node scripts/login.mjs   (창이 뜨면 사람이 직접 로그인)
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const userDataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.pw-profile');

const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false, // 창을 띄워 사람이 직접 로그인
  viewport: null,
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://nid.naver.com/nidlogin.login?url=https://www.naver.com/', {
  waitUntil: 'domcontentloaded',
});
console.log('LOGIN_WINDOW_OPEN: 뜬 브라우저 창에서 직접 네이버에 로그인하세요. (최대 3분 대기)');

let loggedIn = false;
for (let i = 0; i < 90; i++) {
  const cookies = await ctx.cookies('https://www.naver.com');
  const hasAuth = cookies.some((c) => c.name === 'NID_AUT');
  const hasSes = cookies.some((c) => c.name === 'NID_SES');
  if (hasAuth && hasSes) {
    loggedIn = true;
    break;
  }
  await page.waitForTimeout(2000);
}

console.log(loggedIn ? 'LOGIN_OK: 세션 저장됨' : 'LOGIN_TIMEOUT: 로그인 감지 못함(다시 시도 필요)');
await ctx.close();
