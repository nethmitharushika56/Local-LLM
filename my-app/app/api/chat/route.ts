import { NextResponse } from "next/server";
import { streamAnswerWithLocalKnowledge } from "@/lib/local-llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequestBody = {
  message?: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const { stream } = await streamAnswerWithLocalKnowledge(message, body.history ?? []);

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      {
        error: "Unable to complete the local LLM request.",
        details: message,
        hint: "Make sure Ollama is running on port 11434 and ChromaDB is running on port 8001, or set CHROMA_BASE_URL to the port your container uses.",
      },
      { status: 500 },
    );
  }
}
