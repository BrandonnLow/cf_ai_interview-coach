import { DurableObject } from "cloudflare:workers";

export interface Env {
  AI: Ai;
  INTERVIEW_SESSION: DurableObjectNamespace;
}

export class InterviewSession extends DurableObject {
  private history: { role: "user" | "assistant"; content: string }[] = [];
  private jobRole: string = "";

  async fetch(request: Request): Promise<Response> {
    const { message, role } = await request.json() as { message: string; role?: string };
    const env = this.env as Env;

    if (role) this.jobRole = role;

    const isStart = message === "__START__";
    if (isStart) this.history = [];

    const systemPrompt = `You are a professional interviewer conducting a job interview for the role of ${this.jobRole}.
Your job is to:
1. Ask one thoughtful interview question at a time.
2. After each answer, give brief constructive feedback (1-2 sentences), then ask the next question.
3. After 5 questions, summarize the candidate's performance and give an overall rating out of 10.
Be encouraging but honest. Keep responses concise.`;

    const userMessage = isStart
      ? `Start the interview. Introduce yourself briefly and ask the first question.`
      : message;

    this.history.push({ role: "user", content: userMessage });

    let reply: string;
    try {
      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
        messages: [
          { role: "system", content: systemPrompt },
          ...this.history,
        ],
        max_tokens: 512,
      } as any);
      reply = (response as any).response ?? "No response generated.";
    } catch (e: any) {
      console.error("AI error:", e?.message ?? e);
      reply = "The AI service is temporarily unavailable. Please try again in a moment.";
    }

    this.history.push({ role: "assistant", content: reply });

    return Response.json({ reply });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body: { sessionId?: string; message?: string; role?: string };
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { sessionId, message, role } = body;

      if (!sessionId || !message) {
        return Response.json({ error: "Missing sessionId or message" }, { status: 400 });
      }

      const id = env.INTERVIEW_SESSION.idFromName(sessionId);
      const stub = env.INTERVIEW_SESSION.get(id);

      return stub.fetch(new Request("https://do/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, role }),
      }));
    }

    return new Response("Not found", { status: 404 });
  },
};