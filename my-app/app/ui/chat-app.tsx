"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

const quickPrompts = [
  "How do I start Ollama and ChromaDB?",
  "What models are configured in this app?",
  "Explain the local RAG flow here.",
];

export function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [lastContextCount, setLastContextCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSubmitting, [input, isSubmitting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

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

      setLastContextCount(payload.context.length);
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: payload.answer },
      ]);
      setLastModel(payload.model);
      setStatus(`Answered by ${payload.model} with ${payload.context.length} context matches`);
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

  function sendPrompt(prompt: string) {
    setInput(prompt);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#22374f,_#08111f_48%,_#04070d_100%)] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="mb-4 flex flex-col gap-3 rounded-[2rem] border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/25 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-cyan-300">Local LLM</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Private chat with Ollama and ChromaDB
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              A local-first assistant that retrieves context from ChromaDB and answers with a model running on your machine.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Status</p>
              <p className="mt-1 text-sm font-medium text-white">{status}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Model</p>
              <p className="mt-1 text-sm font-medium text-white">{lastModel ?? "gemma3:4b"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Context hits</p>
              <p className="mt-1 text-sm font-medium text-white">{lastContextCount}</p>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/35 backdrop-blur">
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Live stack</p>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Ollama</span>
                  <span className="font-medium text-cyan-200">127.0.0.1:11434</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>ChromaDB</span>
                  <span className="font-medium text-cyan-200">127.0.0.1:8000</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Collection</span>
                  <span className="font-medium text-cyan-200">local_llm_knowledge</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Quick prompts</p>
              <div className="mt-4 flex flex-col gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendPrompt(prompt)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm leading-6 text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">How it works</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <li>1. Your prompt is embedded locally through Ollama.</li>
                <li>2. ChromaDB returns matching context from the knowledge collection.</li>
                <li>3. The app assembles the context and asks Ollama for the final answer.</li>
              </ul>
            </div>
          </aside>

          <section className="flex min-h-[72vh] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Conversation</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Ask the local model</h2>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 sm:block">
                Responses are generated locally, no hosted API.
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {messages.map((message, index) => {
                const isUser = message.role === "user";

                return (
                  <div key={`${message.role}-${index}`} className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/15 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                        AI
                      </div>
                    ) : null}

                    <div
                      className={`max-w-[min(42rem,85%)] rounded-[1.5rem] px-4 py-3 text-sm leading-6 shadow-lg ${
                        isUser
                          ? "border border-cyan-300/30 bg-cyan-400 text-slate-950"
                          : "border border-white/10 bg-white/6 text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {isUser ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/90">
                        You
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="rounded-[1.75rem] border border-white/10 bg-black/35 p-3 shadow-inner shadow-black/30">
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={`chip-${prompt}`}
                      type="button"
                      onClick={() => sendPrompt(prompt)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  placeholder="Ask about local RAG, Ollama setup, or ChromaDB indexing..."
                  className="w-full resize-none rounded-[1.35rem] border border-transparent bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-white/[0.03]"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-slate-400">
                    Use <span className="font-medium text-slate-200">OLLAMA_CHAT_MODEL</span> and <span className="font-medium text-slate-200">CHROMA_COLLECTION</span> to customize the stack.
                  </p>
                  <button
                    type="submit"
                    disabled={!canSend}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isSubmitting ? "Sending..." : "Send message"}
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
