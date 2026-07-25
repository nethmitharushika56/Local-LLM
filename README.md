# Local LLM

Local LLM is a Next.js app for private, local-first chat. It connects to Ollama for generation and embeddings, then uses ChromaDB to retrieve relevant context for lightweight retrieval-augmented responses.

## Features

- Chat UI built with Next.js and React
- Streaming answers from a local Ollama model
- Retrieval from a local ChromaDB collection
- One-time knowledge-base seeding for faster follow-up messages
- Plain-text output with markdown symbols stripped in the UI

## Requirements

- Node.js 20 or newer
- [Ollama](https://ollama.com/) running locally
- [ChromaDB](https://docs.trychroma.com/) running locally

## Setup

1. Install dependencies:

   ```bash
   cd my-app
   npm install
   ```

2. Start Ollama and pull the models used by the app:

   ```bash
   ollama pull gemma3:4b
   ollama pull nomic-embed-text
   ```

   You can swap the chat model for another local model, such as `llama3.2`, `mistral`, or `phi3:mini`.

3. Start ChromaDB. The app defaults to port `8001`. One option is Docker:

   ```bash
   docker run -p 8001:8000 chromadb/chroma
   ```

   If your Chroma container uses a different host port, set `CHROMA_BASE_URL` in `.env.local`.

## Configuration

Create a `.env.local` file in `my-app` to override the defaults:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=gemma3:4b
OLLAMA_EMBED_MODEL=nomic-embed-text
CHROMA_BASE_URL=http://127.0.0.1:8001
CHROMA_COLLECTION=local_llm_knowledge
```

## Run

From `my-app`, start the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How It Works

1. The browser sends a prompt to `/api/chat`.
2. On first use, the app seeds a small built-in knowledge base into ChromaDB once.
3. The API route creates an embedding for the user's question with Ollama.
4. ChromaDB returns the most relevant context.
5. The route streams the context and chat history back to Ollama.
6. Tokens are returned to the browser as they are generated and displayed as plain text.

## Project Files

- [my-app/app/ui/chat-app.tsx](my-app/app/ui/chat-app.tsx) — chat UI and streaming client
- [my-app/app/api/chat/route.ts](my-app/app/api/chat/route.ts) — chat API route
- [my-app/lib/local-llm.ts](my-app/lib/local-llm.ts) — Ollama + Chroma orchestration
- [my-app/lib/format-message.ts](my-app/lib/format-message.ts) — plain-text formatting for assistant replies

## Troubleshooting

- **Slow first answer:** the first request may seed the Chroma collection and load the Ollama model. Later messages should be faster.
- **Connection errors:** make sure Ollama is reachable at `http://127.0.0.1:11434` and ChromaDB at the URL in `CHROMA_BASE_URL`.
- **Wrong Chroma port:** if Docker maps Chroma to a different port, update `CHROMA_BASE_URL` to match it.
- **Faster replies:** try a smaller chat model such as `phi3:mini` and set `OLLAMA_CHAT_MODEL=phi3:mini`.
