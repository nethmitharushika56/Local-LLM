# Local LLM

Local LLM is a Next.js app for private, local-first chat. It connects to Ollama for generation and embeddings, then uses ChromaDB to retrieve relevant context for lightweight retrieval-augmented responses.

## Features

- Chat UI built with Next.js and React
- Local model inference through Ollama
- Retrieval from a local ChromaDB collection
- Simple API route for chat orchestration

## Requirements

- Node.js 20 or newer
- Ollama running locally
- ChromaDB running locally

## Setup

1. Install dependencies:

   cd App/my-app
   npm install

2. Start Ollama and pull the models used by the app:

   ollama pull llama3.2
   ollama pull nomic-embed-text

3. Start ChromaDB on port 8000. One option is Docker:

   docker run -p 8000:8000 chromadb/chroma

## Configuration

Create a `.env.local` file in `App/my-app` to override the defaults:

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=gemma3:4b
OLLAMA_EMBED_MODEL=nomic-embed-text
CHROMA_BASE_URL=http://127.0.0.1:8000
CHROMA_COLLECTION=local_llm_knowledge

## Run

From `App/my-app`, start the development server:

npm run dev

Then open http://localhost:3000.

## How It Works

1. The browser sends a prompt to `/api/chat`.
2. The API route creates an embedding with Ollama.
3. ChromaDB returns the most relevant context.
4. The route sends the context and chat history back to Ollama for the final answer.

## Project Files

- [App/my-app/app/ui/chat-app.tsx](App/my-app/app/ui/chat-app.tsx)
- [App/my-app/app/api/chat/route.ts](App/my-app/app/api/chat/route.ts)
- [App/my-app/lib/local-llm.ts](App/my-app/lib/local-llm.ts)
