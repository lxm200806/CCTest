export function crossOriginResponse(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("host");
  if (!host) return Response.json({ error: "请求来源不对" }, { status: 403 });
  try {
    if (new URL(origin).host !== host) return Response.json({ error: "请求来源不对" }, { status: 403 });
  } catch {
    return Response.json({ error: "请求来源不对" }, { status: 403 });
  }
  return null;
}
