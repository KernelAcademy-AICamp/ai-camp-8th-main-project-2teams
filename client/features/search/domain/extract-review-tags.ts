// 유스케이스: 자연어 쿼리 → 리뷰 정보태그(긍정/제외/기능)를 결정적으로 추출. 순수 함수.
// LLM(8B)이 88개 닫힌집합 매핑에 비결정적·프롬프트 민감이라, 정확 키워드는 코드로 확정한다.
// 정본 어휘: backend/review_analysis/정보태그_사전.md · tee.ts의 REVIEW_TAGS_*와 동기화.

export interface ExtractedTags {
  reviewTags: string[]; // 긍정 태그(가점)
  excludeTags: string[]; // 결함/기피 태그(제외 필터)
  functional: string[]; // 냉감·통풍 (기능성 필드)
}

// 긍정 품질태그 → 짝 결함태그. 긍정을 원하면 결함은 자동 제외한다.
const DEFECT_COUNTERPART: Record<string, string> = {
  비침없음: "비침있음",
  보풀안생김: "보풀생김",
  목안늘어남: "목늘어남",
  세탁후변형없음: "세탁후줄어듦",
  프린팅튼튼: "프린팅벗겨짐",
  화면색상일치: "화면과색상다름",
  구김적음: "구김생김",
  안달라붙음: "땀나면달라붙음",
};

type Bucket = "review" | "exclude" | "functional";
interface Rule {
  re: RegExp;
  tag: string;
  bucket: Bucket;
  // 이 태그가 이미 잡혔으면 이 규칙은 건너뛴다(구체어 우선 처리용).
  unless?: string[];
}

// ⚠️ 순서 중요: 더 구체적인 규칙을 위에 둔다(프린팅튼튼 → 탄탄함, 넥라인넉넉 → 넉넉핏 등).
const RULES: Rule[] = [
  // ── 프린팅/원단 "튼튼" 구분 ──
  {
    re: /(프린팅|인쇄|프린트|그래픽|나염|프린)\s*(이|은|는|가)?.{0,5}(안\s*벗겨|벗겨지지\s*않|튼튼|안\s*갈라|갈라지지\s*않|오래|안\s*지워|지워지지\s*않|안\s*떨어|변하지\s*않|안\s*변하|변형\s*없|안\s*변색|그대로|색\s*안\s*빠)|(안\s*벗겨|벗겨지지\s*않|안\s*갈라|변하지\s*않).{0,5}(프린팅|인쇄|프린트|그래픽|나염)/,
    tag: "프린팅튼튼",
    bucket: "review",
  },
  {
    re: /탄탄|쫀쫀|쫀득|(원단|옷|재질|소재|티|기장).{0,3}튼튼|튼튼한\s*(원단|옷|티|재질|소재)|튼튼/,
    tag: "탄탄함",
    bucket: "review",
    unless: ["프린팅튼튼"],
  },
  // ── 넥라인 vs 전체 핏 ──
  {
    // 넉넉/넓 직접어 + "조이지 않는/안 좁은" 같은 좁음의 부정도 넉넉으로.
    re: /(목|넥라인|넥)(이|라인)?\s*(넉넉|넓|파인|여유)|(목|넥라인|넥).{0,4}(안\s*조이|조이지\s*않|안\s*조여|조여지지\s*않|안\s*좁|좁지\s*않)/,
    tag: "넥라인넉넉",
    bucket: "review",
  },
  {
    // 좁음의 부정("조이지 않는")이 이미 넥라인넉넉으로 잡혔으면 건너뛴다.
    re: /(목|넥라인|넥)(이|라인)?\s*(좁|타이트|조여|조이)/,
    tag: "넥라인좁음",
    bucket: "review",
    unless: ["넥라인넉넉"],
  },
  // "안 넉넉한/넉넉하지 않은" = 슬림쪽 → 슬림핏(넉넉핏 아님).
  { re: /넉넉하지\s*않|안\s*넉넉/, tag: "슬림핏", bucket: "review" },
  {
    re: /넉넉/,
    tag: "넉넉핏",
    bucket: "review",
    unless: ["넥라인넉넉", "슬림핏"],
  },
  { re: /오버핏|오버\s*핏|오버사이즈/, tag: "오버핏", bucket: "review" },
  { re: /박시|박스핏|큼직/, tag: "박시핏", bucket: "review" },
  { re: /루즈|헐렁/, tag: "루즈핏", bucket: "review" },
  {
    re: /슬림|몸에\s*붙|딱\s*맞|타이트핏|핏하게/,
    tag: "슬림핏",
    bucket: "review",
  },
  // ── 체형/활동/기장 ──
  {
    re: /체형\s*(보정|커버)|살\s*가려|배\s*가려|군살\s*커버/,
    tag: "체형보정",
    bucket: "review",
  },
  {
    re: /활동성|움직임\s*편|잘\s*움직|활동적|편하게\s*움직/,
    tag: "활동성좋음",
    bucket: "review",
  },
  {
    re: /엉덩이\s*(덮|커버|가려)|힙\s*(커버|가려)|긴\s*기장|기장\s*긴|롱기장/,
    tag: "엉덩이커버기장",
    bucket: "review",
  },
  // ── 소재 느낌 ──
  {
    // 의태어 포함: 보들보들·부들부들·부드부드·보드라운·말랑말랑
    re: /부드러|부드럽|부드부드|보드라|말랑말랑|소프트|보들|부들/,
    tag: "부드러움",
    bucket: "review",
  },
  {
    re: /재질\s*좋|퀄리티\s*좋|고급|질\s*좋|소재\s*좋|원단\s*좋/,
    tag: "재질좋음",
    bucket: "review",
  },
  {
    re: /면\s*느낌|면티|코튼\s*느낌|순면\s*느낌|면\s*100/,
    tag: "면느낌",
    bucket: "review",
  },
  {
    re: /안\s*달라붙|안\s*들러붙|달라붙지\s*않|땀.{0,4}안\s*붙/,
    tag: "안달라붙음",
    bucket: "review",
  },
  {
    re: /구김\s*(안|없|적|덜)|안\s*구겨|구겨지지\s*않|주름\s*안|주름\s*없/,
    tag: "구김적음",
    bucket: "review",
  },
  {
    re: /털\s*안\s*붙|보푸라기\s*안\s*붙|털\s*안\s*타/,
    tag: "털안붙음",
    bucket: "review",
  },
  {
    re: /두께\s*적당|적당한\s*두께|적당히\s*두꺼|너무\s*얇지\s*않|너무\s*두껍지\s*않/,
    tag: "두께적당",
    bucket: "review",
  },
  // 부정 처리: "안 얇은/얇지 않은"=두꺼움→도톰함, "안 두꺼운/도톰하지 않은"=얇음
  {
    re: /얇지\s*않|안\s*얇/,
    tag: "도톰함",
    bucket: "review",
    unless: ["두께적당"],
  },
  {
    re: /도톰하지\s*않|두껍지\s*않|안\s*두꺼|안\s*도톰|두툼하지\s*않/,
    tag: "얇음",
    bucket: "review",
    unless: ["두께적당"],
  },
  {
    re: /도톰|톡톡|두툼|두꺼운|두꺼워/,
    tag: "도톰함",
    bucket: "review",
    unless: ["두께적당", "얇음"],
  },
  {
    re: /하늘하늘|얇/,
    tag: "얇음",
    bucket: "review",
    unless: ["도톰함", "두께적당"],
  },
  {
    re: /신축|스판\s*좋|잘\s*늘어|스트레치|탄력|늘어나서\s*편/,
    tag: "신축성좋음",
    bucket: "review",
  },
  // ── 계절/온도 (functional: 냉감·통풍만) ──
  {
    re: /시원|냉감|쿨(?!러|톤)|아이스(?!크림)|시원하게/,
    tag: "냉감",
    bucket: "functional",
  },
  {
    re: /통풍|바람\s*(잘\s*)?통|통기|산들|메쉬|매쉬|바람\s*드나/,
    tag: "통풍",
    bucket: "functional",
  },
  {
    re: /흡습|속건|땀\s*(빨리|금방|잘|바로)\s*마르|빨리\s*마르|쿨드라이|땀\s*배출/,
    tag: "흡습속건",
    bucket: "review",
  },
  { re: /여름/, tag: "여름용", bucket: "review" },
  { re: /간절기|봄가을|봄\s*가을/, tag: "간절기용", bucket: "review" },
  { re: /겨울\s*이너|기모\s*이너|겨울용\s*이너/, tag: "겨울이너", bucket: "review" },
  {
    re: /따뜻(?!한?\s*(색|컬러|톤))|기모|보온|웜하게|안\s*춥/,
    tag: "따뜻함",
    bucket: "review",
  },
  // ── 색/발색 ──
  {
    re: /화면.{0,8}(그대로|똑같|같|일치|동일|안\s*다르|다르지\s*않)|색.{0,5}화면.{0,5}(똑같|같|다르지\s*않)|실물.{0,4}(같|동일)|화면색\s*그대로|색\s*(안\s*다르|똑같)/,
    tag: "화면색상일치",
    bucket: "review",
  },
  {
    re: /쨍|선명|발색\s*좋|비비드|색\s*진하|채도\s*높/,
    tag: "선명한발색",
    bucket: "review",
  },
  {
    re: /컬러\s*다양|색상\s*다양|색\s*다양|다양한\s*색|색상\s*많/,
    tag: "컬러다양",
    bucket: "review",
  },
  {
    re: /색\s*(예쁘|예쁜|이쁘|이쁜|이뻐)|색상\s*(예쁘|예쁜|이쁘)|예쁜\s*색|색감\s*좋|색깔\s*(예쁘|예쁜|이쁘)/,
    tag: "색상예쁨",
    bucket: "review",
  },
  // ── 관리/내구 ──
  {
    re: /목.{0,4}(안\s*늘어|늘어나지\s*않|안늘어|늘어남\s*없)|넥라인.{0,4}안\s*늘어/,
    tag: "목안늘어남",
    bucket: "review",
  },
  {
    re: /세탁.{0,5}(변형\s*없|그대로|줄지\s*않|안\s*줄|안\s*변|틀어지지\s*않)|안\s*줄어들|줄어들지\s*않|줄지\s*않/,
    tag: "세탁후변형없음",
    bucket: "review",
  },
  {
    re: /건조기\s*(돌려도|가능|사용|써도|돼|된다|ok)|건조기.{0,3}(돌|사용)|건조기\s*문제\s*없/i,
    tag: "건조기OK",
    bucket: "review",
  },
  {
    re: /마감\s*(깔끔|좋|꼼꼼)|봉제\s*(깔끔|좋|꼼꼼|튼튼)|바느질\s*좋|마감\s*처리\s*좋/,
    tag: "마감깔끔",
    bucket: "review",
  },
  {
    re: /보풀\s*(안|없|덜|잘\s*안|생기지\s*않|안\s*생)|보푸라기\s*(안|없|생기지\s*않)/,
    tag: "보풀안생김",
    bucket: "review",
  },
  {
    re: /안\s*비치|비치지\s*않|비쳐지지\s*않|비침\s*(없|적|없이)|안\s*비쳐|비쳐\s*보이지\s*않/,
    tag: "비침없음",
    bucket: "review",
  },
  { re: /이염\s*(안|없|되지\s*않)/, tag: "이염없음", bucket: "review" },
  {
    re: /초크\s*(안|잘\s*안|묻지\s*않)\s*묻|초크\s*안\s*묻|초크\s*안\s*타/,
    tag: "초크안묻음",
    bucket: "review",
  },
  // ── 특수 ──
  { re: /시스루|비침\s*디자인|속\s*비치는\s*디자인/, tag: "시스루", bucket: "review" },
  { re: /피그먼트|가먼트\s*워싱|워싱\s*가공/, tag: "피그먼트워싱", bucket: "review" },
  {
    re: /옆선\s*(무봉제|봉제\s*없|무봉)|무봉제|사이드\s*심\s*없/,
    tag: "옆선무봉제",
    bucket: "review",
  },
  {
    re: /귀여|귀엽|큐트|깜찍|아기자기|그림\s*예쁜|캐릭터\s*(이쁜|귀)/,
    tag: "디자인귀여움",
    bucket: "review",
  },
  // ── 용도/TPO ──
  { re: /클라이밍|볼더링|암장|등반|클라임/, tag: "클라이밍", bucket: "review" },
  { re: /러닝|달리기|조깅|런닝/, tag: "러닝", bucket: "review" },
  { re: /운동|헬스|짐웨어|트레이닝|워크아웃/, tag: "운동복", bucket: "review" },
  { re: /데일리|일상|평상시|매일\s*입/, tag: "데일리", bucket: "review" },
  {
    re: /레이어드|이너로|받쳐\s*입|겹쳐\s*입|속에\s*입|안에\s*받쳐/,
    tag: "이너·레이어드",
    bucket: "review",
  },
  { re: /잠옷|홈웨어|파자마|집에서\s*입|실내복/, tag: "홈웨어·잠옷", bucket: "review" },
  { re: /작업복|워크웨어|현장\s*용/, tag: "작업복", bucket: "review" },
  { re: /단체|유니폼|과잠|단체복|맞춤\s*티/, tag: "단체티·유니폼", bucket: "review" },
  { re: /크루\s*티|크루티|크루\s*용/, tag: "크루티", bucket: "review" },
  { re: /선물/, tag: "선물용", bucket: "review" },
  { re: /커플/, tag: "커플티", bucket: "review" },
  { re: /가족|패밀리\s*룩|가족\s*티/, tag: "가족티", bucket: "review" },
  { re: /여행|휴가|바캉스|리조트/, tag: "여행·휴가", bucket: "review" },
  { re: /골프/, tag: "골프", bucket: "review" },
  { re: /등산|산책|하이킹|트레킹/, tag: "등산·산책", bucket: "review" },
  { re: /복싱|권투/, tag: "복싱", bucket: "review" },
  { re: /테니스/, tag: "테니스", bucket: "review" },
  { re: /필라테스|요가|필테/, tag: "필라테스", bucket: "review" },
  {
    re: /아동|아이들|아이\s*옷|아이\s*용|우리\s*아이|애기|베이비|어린이|키즈|학생|주니어/,
    tag: "아동·학생용",
    bucket: "review",
  },
  { re: /행사|공연|이벤트|축제|무대\s*의상/, tag: "행사·공연", bucket: "review" },
  { re: /각인|이니셜|이름\s*새|네임\s*프린팅/, tag: "각인서비스", bucket: "review" },
  {
    re: /가벼운|가볍|가뿐|깃털|경량|무게감?\s*(이|가)?\s*(적|없|덜)|무게\s*안\s*나가|안\s*무겁|안\s*무거|무겁지\s*않/,
    tag: "가벼움",
    bucket: "review",
  },
  // ── 순수 결함 회피(제외 전용) ──
  { re: /안\s*무겁|안\s*무거|무겁지\s*않/, tag: "무거움", bucket: "exclude" },
  { re: /안\s*까슬|까슬하지\s*않|까끌.{0,3}않/, tag: "까슬함", bucket: "exclude" },
  {
    re: /택\s*(안|없)\s*따가|택\s*안\s*걸리|택\s*따갑지\s*않|무택/,
    tag: "택따가움",
    bucket: "exclude",
  },
  {
    re: /먼지\s*(안|잘\s*안)\s*묻|먼지\s*안\s*타/,
    tag: "먼지잘묻음",
    bucket: "exclude",
  },
  {
    re: /물\s*안\s*빠지|물\s*빠지지\s*않|물빠짐\s*없|색\s*안\s*빠지|색\s*빠지지\s*않/,
    tag: "물빠짐",
    bucket: "exclude",
  },
  {
    re: /밑단\s*안\s*말리|밑단\s*말림\s*없|말리지\s*않/,
    tag: "밑단말림",
    bucket: "exclude",
  },
  { re: /땀\s*안\s*마르|땀\s*잘\s*안\s*마르/, tag: "땀안마름", bucket: "exclude" },
  { re: /스판\s*없/, tag: "스판없음", bucket: "exclude" },
];

export function extractReviewTags(query: string): ExtractedTags {
  const text = query.toLowerCase();
  const review = new Set<string>();
  const exclude = new Set<string>();
  const functional = new Set<string>();
  const bucketOf = (b: Bucket) =>
    b === "review" ? review : b === "exclude" ? exclude : functional;

  for (const rule of RULES) {
    if (rule.unless?.some((t) => review.has(t) || exclude.has(t) || functional.has(t)))
      continue;
    if (rule.re.test(text)) bucketOf(rule.bucket).add(rule.tag);
  }

  // 긍정 품질태그의 짝 결함태그를 자동 제외.
  for (const t of review) {
    const neg = DEFECT_COUNTERPART[t];
    if (neg) exclude.add(neg);
  }

  return {
    reviewTags: [...review],
    excludeTags: [...exclude],
    functional: [...functional],
  };
}
