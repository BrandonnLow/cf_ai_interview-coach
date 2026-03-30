import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

/**
 * NOTE: Tests that make 2+ sequential Durable Object writes in a single test
 * body will fail locally. When the AI binding (env.AI) fails with a TLS error
 * in the miniflare runtime, it leaves the SQLite WAL file dirty, which prevents
 * the vitest-pool-workers isolated storage snapshot from restoring cleanly after
 * the test. Any multi-turn conversation test (editIndex, follow-up answers, etc.)
 * must be validated against the deployed worker instead.
 */

const BASE = "https://example.com";

async function postChat(body: Record<string, unknown>) {
  return SELF.fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("AI Interview Coach", () => {


  it("returns 404 for unknown routes", async () => {
    const res = await SELF.fetch(`${BASE}/unknown`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for GET requests to /api/chat", async () => {
    const res = await SELF.fetch(`${BASE}/api/chat`);
    expect(res.status).toBe(404);
  });


  it("returns 400 if sessionId is missing", async () => {
    const res = await postChat({ message: "hello" });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("Missing sessionId or message");
  });

  it("returns 400 if message is missing", async () => {
    const res = await postChat({ sessionId: "abc" });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("Missing sessionId or message");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await SELF.fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("Invalid JSON body");
  });


  it("returns a reply for a valid __START__ request", async () => {
    const res = await postChat({
      sessionId: crypto.randomUUID(),
      role: "Software Engineer",
      message: "__START__",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { reply: string; questionCount: number; userMessageIndex: number };
    expect(typeof data.reply).toBe("string");
    expect(data.reply.length).toBeGreaterThan(0);
    expect(data.questionCount).toBe(1);
    expect(typeof data.userMessageIndex).toBe("number");
  });

  it("accepts an optional company field on __START__", async () => {
    const res = await postChat({
      sessionId: crypto.randomUUID(),
      role: "Product Manager",
      company: "Acme Corp",
      difficulty: "Senior",
      message: "__START__",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { reply: string };
    expect(typeof data.reply).toBe("string");
    expect(data.reply.length).toBeGreaterThan(0);
  });

  it("starts without a company field (company is optional)", async () => {
    const res = await postChat({
      sessionId: crypto.randomUUID(),
      role: "Data Analyst",
      message: "__START__",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { reply: string };
    expect(typeof data.reply).toBe("string");
  });


  it("questionCount starts at 1 after __START__", async () => {
    const res = await postChat({
      sessionId: crypto.randomUUID(),
      role: "UX Designer",
      message: "__START__",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { questionCount: number };
    expect(data.questionCount).toBe(1);
  });


  it.each(["Junior", "Mid", "Senior"])("accepts difficulty level: %s", async (level) => {
    const res = await postChat({
      sessionId: crypto.randomUUID(),
      role: "Marketing Manager",
      difficulty: level,
      message: "__START__",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { reply: string };
    expect(data.reply.length).toBeGreaterThan(0);
  });

});