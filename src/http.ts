import type { IncomingMessage, ServerResponse } from "node:http";
import { PLUGIN_NAME, PLUGIN_ROUTE_BASE } from "./constants.js";
import { renderRunObserverHtml } from "./html.js";
import type { RunObserverRuntime } from "./observer.js";
import { isLoopbackRemoteAddress } from "./utils.js";

type RunObserverHttpHandlerOptions = {
  observer: RunObserverRuntime;
};

export function createRunObserverHttpHandler(options: RunObserverHttpHandlerOptions) {
  return async function handleRunObserverHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith(PLUGIN_ROUTE_BASE)) {
      return false;
    }

    if (!isLoopbackRemoteAddress(req.socket.remoteAddress)) {
      sendJson(res, 403, {
        ok: false,
        error: {
          type: "forbidden",
          message: "Run Observer is only available from loopback.",
        },
      });
      return true;
    }

    const accessState = await options.observer.getAccessState();
    const providedToken = resolveProvidedToken(req, url);
    if (providedToken !== accessState.token) {
      sendJson(res, 401, {
        ok: false,
        error: {
          type: "unauthorized",
          message: "Missing or invalid run-observer token.",
        },
      });
      return true;
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendText(res, 405, "Method Not Allowed");
      return true;
    }

    const normalizedPath = normalizeRoutePath(url.pathname);
    if (normalizedPath === normalizeRoutePath(PLUGIN_ROUTE_BASE)) {
      sendHtml(
        res,
        renderRunObserverHtml({
          basePath: PLUGIN_ROUTE_BASE,
          pluginName: PLUGIN_NAME,
        }),
      );
      return true;
    }

    if (normalizedPath === `${normalizeRoutePath(PLUGIN_ROUTE_BASE)}/api/recent`) {
      sendJson(res, 200, {
        ok: true,
        runs: await options.observer.getRecentRuns(),
      });
      return true;
    }

    if (normalizedPath.startsWith(`${normalizeRoutePath(PLUGIN_ROUTE_BASE)}/api/run-attempt/`)) {
      const runAttemptId = decodeURIComponent(
        normalizedPath.slice(`${normalizeRoutePath(PLUGIN_ROUTE_BASE)}/api/run-attempt/`.length),
      );
      const run = await options.observer.getRunAttempt(runAttemptId);
      if (!run) {
        sendJson(res, 404, {
          ok: false,
          error: {
            type: "not_found",
            message: `Unknown run-observer run attempt: ${runAttemptId}`,
          },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, run });
      return true;
    }

    if (normalizedPath === `${normalizeRoutePath(PLUGIN_ROUTE_BASE)}/api/events`) {
      await options.observer.subscribe(res);
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: {
        type: "not_found",
        message: `Unknown run-observer route: ${normalizedPath}`,
      },
    });
    return true;
  };
}

function normalizeRoutePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function resolveProvidedToken(req: IncomingMessage, url: URL): string | undefined {
  const header =
    headerValue(req.headers["x-run-observer-token"]) ?? resolveBearerToken(req.headers.authorization);
  if (header?.trim()) {
    return header.trim();
  }
  const fromQuery = url.searchParams.get("token")?.trim();
  return fromQuery ? fromQuery : undefined;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveBearerToken(authorization: string | string[] | undefined): string | undefined {
  const raw = headerValue(authorization)?.trim() ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }
  const token = raw.slice(7).trim();
  return token || undefined;
}

function applyCommonHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  applyCommonHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string): void {
  applyCommonHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}

function sendHtml(res: ServerResponse, body: string): void {
  applyCommonHeaders(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(body);
}
