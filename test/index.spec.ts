import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("AI Interview Coach", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await SELF.fetch("https://example.com/unknown");
    expect(res.status).toBe(404);
  });

  it("returns 400 if sessionId or message is missing", async () => {
    const res = await SELF.fetch("https://example.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }), // missing sessionId
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("Missing sessionId or message");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await SELF.fetch("https://example.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns a reply for a valid chat request", async () => {
    const res = await SELF.fetch("https://example.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-session-123",
        role: "Software Engineer",
        message: "__START__",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { reply: string };
    // Reply is either a real AI response or the fallback error message
    expect(typeof data.reply).toBe("string");
    expect(data.reply.length).toBeGreaterThan(0);
  });
});