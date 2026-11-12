const BLOCKED_PAIRED = /<(script|iframe|object|embed|link|meta|foreignObject|style|form|textarea|input|button|video|audio)\b[^>]*>[\s\S]*?<\/\1>/gi;
const BLOCKED_VOID = /<(script|iframe|object|embed|link|meta|foreignObject|style|form|textarea|input|button|video|audio)\b[^>]*\/?>/gi;

export function sanitizeRichHtml(value: string) {
  let html = value.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(BLOCKED_PAIRED, "");
  html = html.replace(BLOCKED_VOID, "");
  html = html.replace(/\s(on[a-z]+)\s*=\s*("[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi, "");
  html = html.replace(/\s(?:href|xlink:href|src)\s*=\s*("|\')\s*(?:javascript:|data:)[\s\S]*?\1/gi, "");
  html = html.replace(/\s(?:href|xlink:href|src)\s*=\s*(?:javascript:|data:)[^\s>]*/gi, "");
  return html;
}
