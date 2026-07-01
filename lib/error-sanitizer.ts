const SENSITIVE_KEY_PATTERN =
  /(password|pass|pwd|secret|token|cookie|authorization|auth|api[_-]?key|private[_-]?key|database_url|smtp|line_channel|vapid|salary|payroll|signature|voice|audio|contract|id_number|薪資|薪水|獎金|身分證|銀行|帳號|信用卡|合約|契約|簽名|語音|音檔|個資|財務|請款|發票)/i;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization\s*[:=]\s*)bearer\s+[a-z0-9._\-~+/]+=*/gi, "$1Bearer [REDACTED]"],
  [/(cookie\s*[:=]\s*)[^\n\r]+/gi, "$1[REDACTED]"],
  [/(set-cookie\s*[:=]\s*)[^\n\r]+/gi, "$1[REDACTED]"],
  [/(next-auth\.[^=;\s]+)=([^;\s]+)/gi, "$1=[REDACTED]"],
  [/(csrfToken|csrf|sessionToken|accessToken|refreshToken|idToken)(["'\s:=]+)([^"',\s}]+)/gi, "$1$2[REDACTED]"],
  [/([A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASS|KEY|COOKIE|AUTH|DATABASE_URL|VAPID|SMTP|LINE)[A-Z0-9_]*\s*=\s*)[^\n\r]+/gi, "$1[REDACTED]"],
  [
    /(salary|payroll|wage|bonus|id_number|national_id|financial|finance|contract|signature|voice|audio|bank_account|credit_card)(\s*[::=]\s*)[^\n\r,，。;；]+/gi,
    "$1$2[REDACTED]"
  ],
  [
    /(薪資|薪水|獎金|身分證|銀行帳號|信用卡|合約|契約|簽名|語音|音檔|財務|請款|發票|個資)(\s*[:：=]\s*)[^\n\r,，。;；]+/g,
    "$1$2[REDACTED]"
  ],
  [/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[JWT_REDACTED]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]"],
  [/(\b09\d{2}[-\s]?\d{3}[-\s]?\d{3}\b)/g, "[PHONE_REDACTED]"],
  [/\b[A-Z][12]\d{8}\b/g, "[TW_ID_REDACTED]"]
];

export function sanitizeText(value: unknown, maxLength = 12000) {
  let text = value === null || value === undefined ? "" : String(value);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  if (text.length > maxLength) return `${text.slice(0, maxLength)}\n...[TRUNCATED]`;
  return text;
}

export function sanitizeJson(value: unknown, maxLength = 16000) {
  try {
    const json = JSON.stringify(
      value,
      (key, innerValue) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) return "[REDACTED]";
        if (typeof innerValue === "string") return sanitizeText(innerValue, 3000);
        if (innerValue instanceof Error) {
          return {
            name: innerValue.name,
            message: sanitizeText(innerValue.message),
            stack: sanitizeText(innerValue.stack)
          };
        }
        return innerValue;
      },
      2
    );
    return sanitizeText(json, maxLength);
  } catch {
    return sanitizeText(value, maxLength);
  }
}

export function normalizeErrorMessage(message: string) {
  return sanitizeText(message)
    .replace(/cm[a-z0-9]{20,}/gi, "[ID]")
    .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "[DATE]")
    .replace(/\b\d+\b/g, "[NUMBER]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function safeTitle(value: unknown, fallback = "未命名錯誤") {
  const title = sanitizeText(value || fallback, 160).replace(/\s+/g, " ").trim();
  return title || fallback;
}
