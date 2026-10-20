import { getNeonAuth } from "@/lib/auth";

type RouteContext = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

async function proxy(method: Method, request: Request, context: RouteContext) {
  const auth = getNeonAuth();
  if (!auth) return Response.json({ error: "Neon Auth er ikke konfigurert." }, { status: 503 });
  return auth.handler()[method](request, context);
}

export function GET(request: Request, context: RouteContext) { return proxy("GET", request, context); }
export function POST(request: Request, context: RouteContext) { return proxy("POST", request, context); }
export function PUT(request: Request, context: RouteContext) { return proxy("PUT", request, context); }
export function DELETE(request: Request, context: RouteContext) { return proxy("DELETE", request, context); }
export function PATCH(request: Request, context: RouteContext) { return proxy("PATCH", request, context); }
