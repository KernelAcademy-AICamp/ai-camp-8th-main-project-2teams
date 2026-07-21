# 데이터 확보 현실성 조사 (Data Feasibility)
> 유형: foundation · 2026-07-21 · 방법: 웹 리서치(집중 조사)
> ⚠️ 네이버 개발자 문서(developers.naver.com) 직접 fetch 차단 → 공식 swagger 스펙 + 다수 구현사례로 교차검증. 약관 원문·판례는 추가 deep-research 필요.

## 1. 네이버 쇼핑 검색 오픈API
**결론:** 상품명·가격·판매몰·브랜드·제조사·카테고리·이미지는 안정적으로 주지만 **소재·리뷰·상세설명은 응답에 없음.**
- 응답 필드: `title, link, image, lprice, hprice, mallName, productId, productType, brand, maker, category1~4`
- 한도: 일 25,000회 / `display`≤100 / `start`≤1000 → **키워드 1개당 최대 1,000개까지만 페이징** (2000개 채우려면 키워드 다양화 필수)
- 정렬: `sim`(유사도)/`date`/`asc`/`dsc`(가격)
- 리스크: 상업적 이용·재배포 약관 **원문 미확인**(차단). 상용화 전 확인 필요.
- 근거: [응답필드 velog](https://velog.io/@pjh5365/Naver-검색-API를-이용한-쇼핑몰-검색서비스-만들기) · [swagger 스펙](https://github.com/naver/naver-openapi-guide/blob/master/ko/naver-openapi-swagger.yaml) · [일 25,000회](https://choonghyunryu.github.io/posts/2022-03-01-open-api/)
- 주의: 일부 블로그가 reviewCount·score 필드를 언급하나 이는 **비공식 내부 엔드포인트**이며 공식 오픈API엔 없음.

## 2. 스마트스토어 소재(성분) 정보
**결론:** 소재/혼용률은 **판매자 본인만** 커머스API로 정형 조회 가능. 제3자는 상세페이지 이미지·HTML(고시정보 표)에 파묻힌 걸 **파싱/OCR**해야 하고 포맷이 제각각 → 정확도 편차 큼.
- 커머스API 토큰은 `SELF`/`SELLER`만 → 남의 상품 상세 정형 조회 불가. 근거: [SELF/SELLER 토큰](https://github.com/commerce-api-naver/commerce-api/discussions/780) · [필드 추가 요청](https://github.com/commerce-api-naver/commerce-api/discussions/2127)

## 3. 리뷰
**결론:** **공식 수집 API 없음.** 크롤링은 기술적으로 가능하나 캡챠·JS동적렌더·레이트리밋·로그인 다층 차단 + 약관/법적 리스크(민법 750조). **6주 1인 규모에서 핵심 의존축으로 두는 것 비권장.**
- 근거: [네이버 크롤링 차단 다층방어](https://blog.hashscraper.com/posts/reasons-why-naver-crawling-is-blocked-and-solutions?locale=ko) · [리뷰 크롤링 구현사례](https://velog.io/@kimjk4031/파이썬-네이버-스마트스토어-리뷰-크롤링) · [크롤링 법적 리스크](https://velog.io/@nnijgnus/크롤링-해도-될까)
- → **결정 D5: 리뷰는 v1에서 소규모 샘플 실험만** (수십 개, LLM 리뷰요약→느낌태그 가능성만 검증).

## 4. 대안 소스
소재+리뷰를 정형 API로 주는 국내 소스 사실상 없음. 쿠팡 파트너스 API는 검색 **시간당 10회·최대 10개** 제한(데이터 수집 부적합). 무신사 공개 API 없음(크롤링만). 29CM API 확인 안 됨.
- 근거: [쿠팡 파트너스 제한](https://yourtime.kr/entry/쿠팡파트너스-deeplink딥링크-API-활용하는-법) · [무신사 크롤링](https://blog.hashscraper.com/musinsa-category-crawling-bot?locale=ko)

## 5. 이미지 속성 추출 스택 (6주/1인 현실)
- **색상**: OpenCV + KMeans / `imagedominantcolor` — 저비용·고신뢰. 근거: [imagedominantcolor](https://github.com/akamhy/imagedominantcolor)
- **프린팅 문구 OCR**: EasyOCR/Tesseract(한글) — 티셔츠 프린팅은 폰트·왜곡 심해 정확도 낮음 → **비전 LLM이 더 강함**. 근거: [한글 멀티모달 OCR](https://velog.io/@cathx618/한글이-포함된-사진에서-Multimodal-model으로-Object-Detection을-잘-하는-방법)
- **스타일/핏/모티프**: 비전 LLM(멀티모달)에 이미지+프롬프트→JSON. 별도 학습 불필요.
- **비용 주의**: 비전 LLM은 상품 수에 비례해 비용 선형↑ → 색상 등 저난도는 OpenCV, 프린팅·스타일 등 고난도만 LLM에 태우는 **하이브리드**.

## 종합 — 개발자 1명 6주 최현실 경로
1. **뼈대 = 네이버 쇼핑 API**로 카탈로그(제목·가격·몰·브랜드·카테고리·이미지). 키워드 다양화로 커버리지.
2. **색·프린팅문구·스타일 = 이미지에서 추출**(OpenCV + 비전 LLM 하이브리드). 소재는 상세 파싱으로 **추정(플래그)** — 보조.
3. **리뷰 = 핵심축 제외, 소규모 샘플 실험만.**
4. **약관 원문(상업적 이용)·리뷰 크롤링 합법성 = 상용화 판단 전 deep-research로 원문 대조.**

## 미해결 질문
- 네이버 오픈API 상업적 이용 약관 원문 (재배포·캐싱 제한 여부)
- 스마트스토어 상세페이지 소재 추출 실제 정확도 (샘플 테스트 필요)
- 이미지→색상 추출이 "흰 바탕 + 노란 프린팅"처럼 **바탕색/프린팅색 분리**까지 되는지 (단일 dominant color로는 부족 → 세그멘테이션 필요할 수 있음)
