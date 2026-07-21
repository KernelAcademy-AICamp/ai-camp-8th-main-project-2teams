// 저장된 세션이 로그인 상태인지 확인 (읽기 전용, headless).
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const userDataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.pw-profile');
const ctx = await chromium.launchPersistentContext(userDataDir, { headless: true });
const page = ctx.pages()[0] || (await ctx.newPage());

try {
  await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  const cookies = await ctx.cookies('https://www.naver.com');
  const loggedIn = cookies.some((c) => c.name === 'NID_AUT');
  console.log('SESSION_LOGGED_IN:', loggedIn);

  // 로그인 사용자명 흔적이 있으면 표시 (없어도 무방)
  const nameHint = await page.evaluate(() => {
    const el =
      document.querySelector('.MyView-module__link_login___HpHMW') ||
      document.querySelector('[class*="MyView-module__nickname"]') ||
      document.querySelector('.link_login');
    return el ? el.innerText.trim().slice(0, 40) : null;
  });
  console.log('NAME_HINT:', nameHint);
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await ctx.close();
}
