const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? "gemma3:4b";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

const CHROMA_BASE_URL = process.env.CHROMA_BASE_URL ?? "http://127.0.0.1:8001";
const CHROMA_COLLECTION = process.env.CHROMA_COLLECTION ?? "local_llm_knowledge";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type KnowledgeItem = {
  id: string;
  document: string;
  metadata: Record<string, string>;
};

type RetrievalHit = {
  document: string;
  metadata: Record<string, string>;
  distance?: number;
};

let cachedCollectionId: string | null = null;
const seededCollectionIds = new Set<string>();

const knowledgeBase: KnowledgeItem[] = [
  {
    id: "ollama-setup",
    document:
      "Ollama must be running locally at http://127.0.0.1:11434. Common models for chat are llama3.2, mistral, and phi3. Embeddings can be generated with nomic-embed-text.",
    metadata: { source: "setup" },
  },
  {
    id: "chroma-setup",
    document:
      "ChromaDB should be reachable at http://127.0.0.1:8001. This app uses a single collection named local_llm_knowledge to store and query local documents.",
    metadata: { source: "setup" },
  },
  {
    id: "workflow",
    document:
      "The chat flow is: user question -> embed question with Ollama -> query Chroma for relevant context -> compose answer with Ollama using the retrieved context.",
    metadata: { source: "workflow" },
  },
  {
    id: "env-vars",
    document:
      "Useful environment variables are OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL, CHROMA_BASE_URL, and CHROMA_COLLECTION.",
    metadata: { source: "config" },
  },
];

async function ollamaEmbed(text: string) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_EMBED_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create embedding with Ollama: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { embedding?: number[] };
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Ollama did not return an embedding vector.");
  }

  return data.embedding;
}

async function chromaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CHROMA_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Chroma request failed: ${response.status} ${response.statusText} ${body}`);
  }

  return (await response.json()) as T;
}

async function ensureCollection() {
  if (cachedCollectionId) {
    return { id: cachedCollectionId, name: CHROMA_COLLECTION };
  }

  const existing = await chromaRequest<Array<{ id: string; name: string }>>(
    `/api/v1/collections?name=${encodeURIComponent(CHROMA_COLLECTION)}`,
  );

  const collection =
    existing.length > 0
      ? existing[0]
      : await chromaRequest<{ id: string; name: string }>("/api/v1/collections", {
          method: "POST",
          body: JSON.stringify({
            name: CHROMA_COLLECTION,
            metadata: { app: "my-app", purpose: "local-llm-rag" },
          }),
        });

  cachedCollectionId = collection.id;
  return collection;
}

async function getCollectionCount(collectionId: string) {
  return chromaRequest<number>(`/api/v1/collections/${collectionId}/count`);
}

async function seedCollection(collectionId: string) {
  if (seededCollectionIds.has(collectionId)) {
    return;
  }

  const count = await getCollectionCount(collectionId);
  if (count > 0) {
    seededCollectionIds.add(collectionId);
    return;
  }

  const items = await Promise.all(
    knowledgeBase.map(async (item) => ({
      id: item.id,
      embedding: await ollamaEmbed(item.document),
      document: item.document,
      metadata: item.metadata,
    })),
  );

  await chromaRequest(`/api/v1/collections/${collectionId}/upsert`, {
    method: "POST",
    body: JSON.stringify({
      ids: items.map((item) => item.id),
      embeddings: items.map((item) => item.embedding),
      documents: items.map((item) => item.document),
      metadatas: items.map((item) => item.metadata),
    }),
  });

  seededCollectionIds.add(collectionId);
}

async function getRelevantContext(question: string) {
  const collection = await ensureCollection();
  await seedCollection(collection.id);

  const queryEmbedding = await ollamaEmbed(question);
  const result = await chromaRequest<{
    documents?: string[][];
    metadatas?: Array<Array<Record<string, string>>>;
    distances?: number[][];
  }>(`/api/v1/collections/${collection.id}/query`, {
    method: "POST",
    body: JSON.stringify({
      query_embeddings: [queryEmbedding],
      n_results: 4,
      include: ["documents", "metadatas", "distances"],
    }),
  });

  const documents = result.documents?.[0] ?? [];
  const metadatas = result.metadatas?.[0] ?? [];
  const distances = result.distances?.[0] ?? [];

  return documents.map((document, index) => ({
    document,
    metadata: metadatas[index] ?? {},
    distance: distances[index],
  })) as RetrievalHit[];
}

function buildChatMessages(question: string, conversation: ChatMessage[], relevantContext: RetrievalHit[]) {
  const systemPrompt = [
    "You are a concise assistant running locally inside a Next.js app.",
    "Use the provided context when it is relevant.",
    "If the context does not answer the question, say what is missing and give the best practical next step.",
    "Do not mention internal implementation details unless the user asks for them.",
    "Reply in plain text only. Do not use markdown, asterisks, backticks, or bullet symbols.",
  ].join(" ");

  const contextBlock =
    relevantContext.length > 0
      ? relevantContext.map((item, index) => `[${index + 1}] ${item.document}`).join("\n")
      : "No context retrieved.";

  return [
    { role: "system", content: systemPrompt },
    { role: "system", content: `Retrieved context:\n${contextBlock}` },
    ...conversation.filter((message) => message.role !== "system"),
    { role: "user", content: question },
  ] satisfies ChatMessage[];
}

async function ollamaChatStream(messages: ChatMessage[]) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_CHAT_MODEL,
      messages,
      stream: true,
      keep_alive: "30m",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate chat completion with Ollama: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Ollama did not return a streaming response body.");
  }

  return response.body;
}

export async function streamAnswerWithLocalKnowledge(
  question: string,
  conversation: ChatMessage[] = [],
) {
  const relevantContext = await getRelevantContext(question);
  const finalMessages = buildChatMessages(question, conversation, relevantContext);
  const ollamaStream = await ollamaChatStream(finalMessages);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `${JSON.stringify({
            type: "meta",
            model: OLLAMA_CHAT_MODEL,
            context: relevantContext,
          })}\n`,
        ),
      );

      const reader = ollamaStream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) {
              continue;
            }

            const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
            const token = chunk.message?.content;
            if (token) {
              controller.enqueue(encoder.encode(`${JSON.stringify({ type: "token", token })}\n`));
            }
          }
        }

        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done" })}\n`));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return {
    stream,
    context: relevantContext,
    model: OLLAMA_CHAT_MODEL,
  };
}
