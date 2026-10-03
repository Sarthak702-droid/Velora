import { NextRequest, NextResponse } from "next/server";

const upstream = () =>
  (process.env.API_UPSTREAM_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/v1",
  maxAge: 7 * 86400,
};

async function forward(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const expectedOrigin =
      process.env.WEB_ORIGIN ||
      `${req.nextUrl.protocol}//${req.headers.get("host")}`;
    if (
      origin !== expectedOrigin ||
      req.headers.get("sec-fetch-site") === "cross-site"
    )
      return NextResponse.json(
        { message: "Same-origin request required" },
        { status: 403 },
      );
  }
  if (route === "auth/logout" && req.method === "POST") {
    const res = NextResponse.json({ success: true, data: { success: true } });
    res.cookies.set("velora_session", "", { ...cookieOptions, maxAge: 0 });
    return res;
  }
  // A fixed upstream prevents arbitrary URL forwarding. Never forward browser-supplied bearer tokens.
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const key of ["x-tenant-id", "x-branch-id", "x-idempotency-key"]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const session = req.cookies.get("velora_session")?.value;
  const customerSession = req.cookies.get("velora_customer_session")?.value;
  // Staff sessions apply only to operations, avoiding accidental staff identity on public customer visits.
  const operational =
    /^(desk|flow|analytics|customers|notifications|branches|subscriptions)(\/|$)/.test(
      route,
    ) ||
    route === "auth/me" ||
    /^queue\/(branch|[^/]+\/(status|reorder))/.test(route) ||
    (route === "bookings" && req.method === "GET");
  if (session && (operational || req.headers.get("x-staff-session") === "1"))
    headers.set("Authorization", `Bearer ${session}`);
  if (
    customerSession &&
    !operational &&
    req.headers.get("x-staff-session") !== "1"
  )
    headers.set("Authorization", `Bearer ${customerSession}`);
  const booking = route.match(
    /^bookings\/([^/]+)(?:\/(?:cancel|reschedule|availability))?$/,
  );
  const queue = route.match(/^queue\/(?:track\/([^/]+)|([^/]+)\/leave)$/);
  const payment = route.match(
    /^payments\/([^/]+)\/(?:verify|status|passport|concierge|checkout)$/,
  );
  const kind = payment ? "payment" : booking ? "booking" : queue ? "queue" : "";
  const id = payment?.[1] || booking?.[1] || queue?.[1] || queue?.[2];
  if (id) {
    const receipt = req.cookies.get(`velora_${kind}_${id}`)?.value;
    if (receipt) headers.set("x-private-receipt", receipt);
  }
  const requestBody = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.text();
  if (route === "payments/deposit-order" && requestBody) {
    try {
      const body = JSON.parse(requestBody);
      if (typeof body.appointmentId === "string") {
        const receipt = req.cookies.get(
          `velora_booking_${body.appointmentId}`,
        )?.value;
        if (receipt) headers.set("x-private-receipt", receipt);
      }
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
  }
  try {
    const response = await fetch(
      `${upstream()}/api/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`,
      {
        method: req.method,
        headers,
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    const payload = await response.json();
    const data = payload.data;
    let token: string | undefined;
    let receipt: string | undefined;
    if (
      response.ok &&
      (route === "auth/login" || route === "auth/customer/otp/verify") &&
      data?.accessToken
    ) {
      token = data.accessToken;
      delete data.accessToken;
    }
    if (response.ok && data?.managementReceipt) {
      receipt = data.managementReceipt;
      delete data.managementReceipt;
    }
    const res = NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
    if (token)
      res.cookies.set(
        route === "auth/login" ? "velora_session" : "velora_customer_session",
        token,
        cookieOptions,
      );
    if (receipt && data.id)
      res.cookies.set(
        `velora_${route.startsWith("payments/") ? "payment" : route === "queue/join" ? "queue" : "booking"}_${data.id}`,
        receipt,
        {
          ...cookieOptions,
          maxAge: route.startsWith("payments/")
            ? 30 * 86400
            : cookieOptions.maxAge,
        },
      );
    if (response.status === 401 && operational)
      res.cookies.set("velora_session", "", { ...cookieOptions, maxAge: 0 });
    return res;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "The salon API is unavailable. Please retry shortly.",
      },
      { status: 503 },
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;

export const PUT = forward;
