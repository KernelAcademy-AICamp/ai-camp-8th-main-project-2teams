// 장기 실행 드라이버: 헤드풀 브라우저를 띄워 로그인 대기 후 계속 살려둠(CDP 9222).
// 이후 step 스크립트가 connectOverCDP로 붙어 조작한다. 세션 유지가 목적.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const profile = join(dirname(fileURLToPath(import.meta.url)), '..', '.pw-profile');

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: null,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--remote-debugging-port=9222',
  ],
});

const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://nid.naver.com/nidlogin.login?url=https://blog.naver.com/', {
  waitUntil: 'domcontentloaded',
});
console.log('WAITING_LOGIN: 뜬 창에서 직접 네이버에 로그인하세요.');

let ok = false;
for (let i = 0; i < 150; i++) {
  const cookies = await ctx.cookies('https://naver.com');
  if (cookies.some((c) => c.name === 'NID_AUT')) {
    ok = true;
    break;
  }
  await page.waitForTimeout(2000);
}
console.log(ok ? 'LOGIN_OK: 세션 활성. 브라우저 유지 중(CDP 9222).' : 'LOGIN_TIMEOUT');

// 브라우저를 닫지 않고 계속 유지 (세션 유지). step 스크립트가 CDP로 붙는다.
await new Promise(() => {});
