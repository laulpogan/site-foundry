import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { FoundryError } from "../core/errors.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ResolveHost = (hostname: string) => Promise<string[]>;

export interface PublicFetchOptions {
  fetchImpl?: FetchLike;
  resolveHost?: ResolveHost;
  headers?: HeadersInit;
  maxRedirects?: number;
  signal?: AbortSignal;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const [a = 0, b = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateIpv4(mapped) : false;
  }
  return normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local");
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

function publicHeaders(input?: HeadersInit): Headers {
  const headers = new Headers(input);
  for (const sensitive of ["authorization", "cookie", "proxy-authorization", "x-api-key"]) {
    headers.delete(sensitive);
  }
  headers.set("user-agent", "SiteFoundry/0.1 (+public-source-research)");
  return headers;
}

export async function safePublicFetch(url: string | URL, options: PublicFetchOptions = {}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const maxRedirects = options.maxRedirects ?? 5;
  let current = new URL(url);
  const headers = publicHeaders(options.headers);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    if (current.protocol !== "https:" || current.username || current.password || isPrivateAddress(current.hostname)) {
      throw new FoundryError("ACCESS_DENIED", `Blocked non-public URL: ${current.origin}`);
    }
    const addresses = await resolveHost(current.hostname);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      throw new FoundryError("ACCESS_DENIED", `Blocked private DNS target: ${current.hostname}`, { addresses });
    }
    const request: RequestInit = {
      redirect: "manual",
      headers,
    };
    if (options.signal) request.signal = options.signal;
    const response = await fetchImpl(current, request);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === maxRedirects) {
      throw new FoundryError("ACCESS_DENIED", `Redirect limit exceeded for ${current.href}`);
    }
    current = new URL(location, current);
  }
  throw new FoundryError("ACCESS_DENIED", `Redirect limit exceeded for ${current.href}`);
}

export class RateLimiter {
  private readonly lastRequest = new Map<string, number>();

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async wait(host: string): Promise<void> {
    const current = this.now();
    const previous = this.lastRequest.get(host);
    if (previous !== undefined) {
      const remaining = this.intervalMs - (current - previous);
      if (remaining > 0) await this.sleep(remaining);
    }
    this.lastRequest.set(host, this.now());
  }
}
