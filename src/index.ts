import { DurableObject } from "cloudflare:workers";

export interface Env {
  AI: Ai;
  INTERVIEW_SESSION: DurableObjectNamespace;
}

type Message = { role: "user" | "assistant"; content: string };

export class InterviewSession extends DurableObject {

  async fetch(request: Request): Promise<Response> {
    const env = this.env as Env;
    const body = await request.json() as {
      message: string;
      role?: string;
      company?: string | null;
      difficulty?: string;
      interviewType?: string[];
      editIndex?: number;
    };
    const { message, role, company, difficulty, interviewType, editIndex } = body;

    let history      = (await this.ctx.storage.get<Message[]>("history"))      ?? [];
    let jobRole      = (await this.ctx.storage.get<string>("jobRole"))         ?? "";
    let jobDiff      = (await this.ctx.storage.get<string>("difficulty"))      ?? "Mid";
    let jobCo        = (await this.ctx.storage.get<string>("company"))         ?? "";
    let jobTypes     = (await this.ctx.storage.get<string[]>("interviewType")) ?? ["Technical", "Behavioural"];

    const isStart = message === "__START__";

    if (isStart) {
      history = [];
      if (role)          jobRole  = role;
      if (difficulty)    jobDiff  = difficulty;
      if (interviewType) jobTypes = interviewType;
      if (company)       jobCo    = company;
      else               jobCo    = "";
    } else if (editIndex !== undefined) {
      history = history.slice(0, editIndex);
    }

    const diffGuide: Record<string, string> = {
      Junior: "Ask beginner-friendly questions focusing on fundamentals, basic concepts, and learning attitude.",
      Mid:    "Ask intermediate questions covering practical experience, problem-solving, and solid fundamentals.",
      Senior: "Ask advanced questions focusing on system design, leadership, trade-offs, and deep expertise.",
    };

    const typeGuide: Record<string, string> = {
      Technical:   "technical questions that assess hard skills, coding ability, system design, or domain knowledge",
      Behavioural: "behavioural questions using the STAR method (Situation, Task, Action, Result) that assess soft skills, teamwork, and past experiences",
    };
    const typeDesc = jobTypes.length === 2
      ? `Alternate between ${typeGuide["Technical"]} and ${typeGuide["Behavioural"]}.`
      : `Focus exclusively on ${typeGuide[jobTypes[0]]}.`;

    const companyContext = jobCo
      ? `The candidate is interviewing at ${jobCo}. Tailor your questions to be relevant to the type of work and culture at ${jobCo} where appropriate.\n`
      : "";

    const systemPrompt =
      `You are a professional interviewer conducting a ${jobDiff}-level job interview for the role of ${jobRole}.\n` +
      companyContext +
      `${diffGuide[jobDiff] ?? diffGuide["Mid"]}\n` +
      `Interview type: ${jobTypes.join(" & ")}. ${typeDesc}\n` +
      `Your job is to:\n` +
      `1. Ask one thoughtful interview question at a time.\n` +
      `2. After each answer, give brief constructive feedback (1-2 sentences), then ask the next question.\n` +
      `Be encouraging but honest. Keep responses concise.`;

    const userMessage = isStart
      ? "Start the interview. Introduce yourself briefly and ask the first question."
      : message;

    history.push({ role: "user", content: userMessage });

    let reply: string;
    try {
      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
        max_tokens: 512,
      } as any);
      reply = (response as any).response ?? "No response generated.";
    } catch (e: any) {
      console.error("AI error:", e?.message ?? e);
      reply = "The AI service is temporarily unavailable. Please try again in a moment.";
    }

    history.push({ role: "assistant", content: reply });

    const questionCount = history.filter(m => m.role === "assistant").length;

    await this.ctx.storage.put("history",       history);
    await this.ctx.storage.put("jobRole",       jobRole);
    await this.ctx.storage.put("difficulty",    jobDiff);
    await this.ctx.storage.put("company",       jobCo);
    await this.ctx.storage.put("interviewType", jobTypes);

    return Response.json({
      reply,
      questionCount,
      userMessageIndex: history.length - 2,
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body: {
        sessionId?: string;
        message?: string;
        role?: string;
        company?: string | null;
        difficulty?: string;
        interviewType?: string[];
        editIndex?: number;
      };
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { sessionId, message, role, company, difficulty, interviewType, editIndex } = body;

      if (!sessionId || !message) {
        return Response.json({ error: "Missing sessionId or message" }, { status: 400 });
      }

      const id   = env.INTERVIEW_SESSION.idFromName(sessionId);
      const stub = env.INTERVIEW_SESSION.get(id);

      return stub.fetch(new Request("https://do/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message, role, company, difficulty, interviewType, editIndex }),
      }));
    }

    return new Response("Not found", { status: 404 });
  },
};