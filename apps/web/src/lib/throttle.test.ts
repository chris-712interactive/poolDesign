import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNotThrottled,
  ThrottleError,
  throttleWindowStart,
} from "./throttle";

function memoryIncrement() {
  const map = new Map<string, number>();
  return async (key: string, windowStart: Date) => {
    const k = `${key}|${windowStart.toISOString()}`;
    const n = (map.get(k) ?? 0) + 1;
    map.set(k, n);
    return n;
  };
}

describe("assertNotThrottled", () => {
  it("allows traffic up to the limit, then throws 429", async () => {
    const increment = memoryIncrement();
    const now = new Date("2026-09-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) {
      await assertNotThrottled({
        key: "login:ip:1.1.1.1",
        limit: 10,
        windowSec: 15 * 60,
        now,
        increment,
      });
    }
    await assert.rejects(
      () =>
        assertNotThrottled({
          key: "login:ip:1.1.1.1",
          limit: 10,
          windowSec: 15 * 60,
          now,
          increment,
        }),
      (err: unknown) => err instanceof ThrottleError && err.status === 429,
    );
  });

  it("starts a new window independently", async () => {
    const increment = memoryIncrement();
    const first = new Date("2026-09-01T12:00:00.000Z");
    const nextWindow = new Date("2026-09-01T12:15:00.000Z");
    for (let i = 0; i < 10; i++) {
      await assertNotThrottled({
        key: "login:ip:1.1.1.1",
        limit: 10,
        windowSec: 15 * 60,
        now: first,
        increment,
      });
    }
    await assertNotThrottled({
      key: "login:ip:1.1.1.1",
      limit: 10,
      windowSec: 15 * 60,
      now: nextWindow,
      increment,
    });
  });

  it("fails closed when the counter cannot be written", async (t) => {
    t.mock.method(console, "error", () => {});
    await assert.rejects(
      () =>
        assertNotThrottled({
          key: "login:ip:1.1.1.1",
          limit: 10,
          windowSec: 15 * 60,
          increment: async () => {
            throw new Error("db down");
          },
        }),
      (err: unknown) => err instanceof ThrottleError,
    );
  });
});

describe("throttleWindowStart", () => {
  it("aligns to the window boundary", () => {
    const now = new Date("2026-09-01T12:07:33.000Z");
    const start = throttleWindowStart(now, 15 * 60);
    assert.equal(start.toISOString(), "2026-09-01T12:00:00.000Z");
  });
});
