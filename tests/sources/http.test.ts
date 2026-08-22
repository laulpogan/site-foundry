import { describe, expect, it, vi } from "vitest";
import { RateLimiter, safePublicFetch } from "../../src/sources/http.js";

describe("safePublicFetch", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1/private",
    "http://10.1.2.3/private",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/private",
    "https://user:pass@example.com/file",
  ])("rejects private or credentialed target %s", async (url) => {
    await expect(safePublicFetch(url, { fetchImpl: vi.fn() })).rejects.toMatchObject({
      code: "ACCESS_DENIED",
    });
  });

  it("rejects a public hostname that resolves to a private address", async () => {
    await expect(
      safePublicFetch("https://public.example/file", {
        fetchImpl: vi.fn(),
        resolveHost: async () => ["192.168.1.20"],
      }),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("follows bounded public redirects without forwarding credentials", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cdn.example/item.json" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const response = await safePublicFetch("https://registry.example/item", {
      fetchImpl,
      resolveHost: async () => ["93.184.216.34"],
      headers: { authorization: "Bearer secret", cookie: "session=secret", accept: "application/json" },
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.mock.calls) {
      const headers = new Headers(call[1]?.headers);
      expect(headers.has("authorization")).toBe(false);
      expect(headers.has("cookie")).toBe(false);
      expect(headers.get("accept")).toBe("application/json");
    }
  });

  it("enforces a redirect limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://loop.example/again" } }),
    );
    await expect(
      safePublicFetch("https://loop.example/start", {
        fetchImpl,
        resolveHost: async () => ["93.184.216.34"],
        maxRedirects: 2,
      }),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("RateLimiter", () => {
  it("waits until a host's conservative interval expires", async () => {
    let now = 1000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const limiter = new RateLimiter(500, () => now, sleep);

    await limiter.wait("registry.example");
    await limiter.wait("registry.example");
    await limiter.wait("other.example");

    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(500);
  });
});
