// Sentry 알림 페이로드 → Slack 메시지 변환. 순수 함수(I/O 없음) — route.ts에서 사용하고 테스트한다.

export interface SentryIssue {
  title: string;
  level?: string;
  project?: string;
  culprit?: string;
  url?: string;
}

export interface SlackMessage {
  text: string;
  blocks: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Sentry가 보내는 두 형태를 모두 파싱:
//  - 내부 인테그레이션: { action, data: { event: {...} } }
//  - 레거시 웹훅: top-level { message, culprit, level, url, project_name }
export function parseSentryAlert(payload: unknown): SentryIssue | null {
  const root = asRecord(payload);
  if (!root) return null;

  const data = asRecord(root.data);
  const event = data ? asRecord(data.event) : null;
  const source = event ?? root;

  const title = asString(source.title) ?? asString(source.message);
  if (!title) return null;

  const project =
    asString(source.project_name) ??
    asString(source.project) ??
    (typeof source.project === "number" ? String(source.project) : undefined);

  return {
    title,
    level: asString(source.level),
    project,
    culprit: asString(source.culprit),
    url: asString(source.web_url) ?? asString(source.issue_url) ?? asString(source.url),
  };
}

// SentryIssue → Slack Incoming Webhook 페이로드. url이 있으면 이슈 링크 버튼을 붙인다.
export function buildSlackMessage(issue: SentryIssue): SlackMessage {
  const level = issue.level ?? "error";

  const fields: unknown[] = [{ type: "mrkdwn", text: `*Level:*\n${level}` }];
  if (issue.project) {
    fields.push({ type: "mrkdwn", text: `*Project:*\n${issue.project}` });
  }
  if (issue.culprit) {
    fields.push({ type: "mrkdwn", text: `*Culprit:*\n${issue.culprit}` });
  }

  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: `*🚨 ${issue.title}*` } },
    { type: "section", fields },
  ];

  if (issue.url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Sentry에서 보기" },
          url: issue.url,
        },
      ],
    });
  }

  return { text: `🚨 [${level}] ${issue.title}`, blocks };
}
