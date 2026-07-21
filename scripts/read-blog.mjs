// 네이버 블로그 공개 글 읽기 (읽기 전용). 실행: node scripts/read-blog.mjs
import { chromium } from 'playwright';

const BLOG_ID = 'minerva_pm';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

try {
  // 모바일 뷰가 iframe 없이 DOM이 단순함
  await page.goto(`https://m.blog.naver.com/${BLOG_ID}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  const title = await page.title();
  console.log('PAGE_TITLE:', title);

  // 최근 글 목록 추출 (여러 셀렉터를 관대하게 시도)
  const posts = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const anchors = document.querySelectorAll('a[href*="/PostView"], a[href*="logNo="]');
    for (const a of anchors) {
      const text = (a.innerText || '').trim().replace(/\s+/g, ' ');
      const href = a.href;
      if (text && href && !seen.has(href) && text.length > 3) {
        seen.add(href);
        out.push({ text: text.slice(0, 80), href });
      }
    }
    return out.slice(0, 20);
  });

  console.log('POST_COUNT:', posts.length);
  console.log(JSON.stringify(posts, null, 2));

  // 아무 것도 못 찾으면 본문 텍스트 일부라도 덤프
  if (posts.length === 0) {
    const bodyText = await page.evaluate(() =>
      (document.body.innerText || '').slice(0, 1500)
    );
    console.log('BODY_TEXT_FALLBACK:\n', bodyText);
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await browser.close();
}
