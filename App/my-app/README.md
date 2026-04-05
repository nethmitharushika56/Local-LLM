# Local LLM

A Next.js app that talks to a local Ollama model and retrieves context from ChromaDB for lightweight local RAG.

## What it uses

- Ollama for chat completions and embeddings
- ChromaDB for local vector search
- Next.js route handlers for the API layer

## Requirements

- Node.js 20 or newer
- Ollama running locally
- ChromaDB running locally

## Start the local services

1. Install and start Ollama.
2. Pull the models used by the app:

   ollama pull llama3.2
   ollama pull nomic-embed-text

3. Start ChromaDB on port 8000. One option is Docker:

   docker run -p 8000:8000 chromadb/chroma

## Configure the app

Create a file named .env.local in this folder if you want to override the defaults:

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=gemma3:4b
OLLAMA_EMBED_MODEL=nomic-embed-text
CHROMA_BASE_URL=http://127.0.0.1:8000
CHROMA_COLLECTION=local_llm_knowledge

## Run the app

npm run dev

Open http://localhost:3000 in your browser.

## How it works

- The browser submits your message to /api/chat.
- The API route gets an embedding from Ollama.
- The message embedding is queried against ChromaDB.
- The retrieved context and chat history are sent back to Ollama for the final answer.

## Files to look at

- [app/ui/chat-app.tsx](app/ui/chat-app.tsx)
- [app/api/chat/route.ts](app/api/chat/route.ts)
- [lib/local-llm.ts](lib/local-llm.ts)
