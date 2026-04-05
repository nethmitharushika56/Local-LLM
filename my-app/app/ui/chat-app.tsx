"use client";

import { FormEvent, useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  answer: string;
  model: string;
  context: Array<{
    document: string;
    metadata: Record<string, string>;
    distance?: number;
  }>;
  error?: string;
  details?: string;
  hint?: string;
};

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Ask me how to set up Ollama, ChromaDB, or a local RAG workflow. I will answer from the local knowledge base and the model running on your machine.",
  },
];

export function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lastModel, setLastModel] = useState<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSubmitting, [input, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || isSubmitting) {
      return;
    }

    const nextMessages = [...messages, { role: "user", content: message } as ChatMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSubmitting(true);
    setStatus("Thinking with Ollama + ChromaDB...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: nextMessages.slice(-8),
        }),
      });

      const payload = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Request failed.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: payload.answer },
      ]);
      setLastModel(payload.model);
      setStatus(`Answered by ${payload.model}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: `Could not reach the local model stack. ${message}`,
        },
      ]);
      setStatus("Check Ollama and ChromaDB");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1c2b3b,_#08111f_52%,_#05080f_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid flex-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Local LLM</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Ollama + ChromaDB</h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This app sends your prompt to a local Ollama model, retrieves context from ChromaDB,
              and returns an answer without using a hosted LLM.
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-400">Status</p>
                <p className="mt-1 text-base font-medium text-white">{status}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-slate-400">Model</p>
                <p className="mt-1 text-base font-medium text-white">{lastModel ?? "llama3.2"}</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-50">
                <p className="font-medium">Required services</p>
                <p className="mt-1 text-sm leading-6 text-cyan-50/80">
                  Ollama: http://127.0.0.1:11434
                  <br />
                  ChromaDB: http://127.0.0.1:8000
                </p>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[70vh] flex-col rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Chat</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Ask a local model</h2>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>Context retrieved from ChromaDB</p>
                <p>Output generated by Ollama</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-6">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-lg ${
                      message.role === "user"
                        ? "bg-cyan-500 text-slate-950"
                        : "border border-white/10 bg-white/5 text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-white/10 p-4 sm:p-5">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-3 shadow-inner shadow-black/30">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  placeholder="Ask about local RAG, Ollama setup, or ChromaDB indexing..."
                  className="w-full resize-none rounded-2xl border border-transparent bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Use <span className="font-medium text-slate-200">OLLAMA_CHAT_MODEL</span> and <span className="font-medium text-slate-200">CHROMA_COLLECTION</span> to customize.
                  </p>
                  <button
                    type="submit"
                    disabled={!canSend}
                    className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isSubmitting ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
