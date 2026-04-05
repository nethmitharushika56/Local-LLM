const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? "gemma3:4b";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

const CHROMA_BASE_URL = process.env.CHROMA_BASE_URL ?? "http://127.0.0.1:8000";
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
      "ChromaDB should be reachable at http://127.0.0.1:8000. This app uses a single collection named local_llm_knowledge to store and query local documents.",
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
  const existing = await chromaRequest<Array<{ id: string; name: string }>>(
    `/api/v1/collections?name=${encodeURIComponent(CHROMA_COLLECTION)}`,
  );

  if (existing.length > 0) {
    return existing[0];
  }

  return chromaRequest<{ id: string; name: string }>("/api/v1/collections", {
    method: "POST",
    body: JSON.stringify({
      name: CHROMA_COLLECTION,
      metadata: { app: "my-app", purpose: "local-llm-rag" },
    }),
  });
}

async function seedCollection(collectionId: string) {
  const items: Array<{ id: string; embedding: number[]; document: string; metadata: Record<string, string> }> = [];

  for (const item of knowledgeBase) {
    const embedding = await ollamaEmbed(item.document);
    items.push({
      id: item.id,
      embedding,
      document: item.document,
      metadata: item.metadata,
    });
  }

  await chromaRequest(`/api/v1/collections/${collectionId}/upsert`, {
    method: "POST",
    body: JSON.stringify({
      ids: items.map((item) => item.id),
      embeddings: items.map((item) => item.embedding),
      documents: items.map((item) => item.document),
      metadatas: items.map((item) => item.metadata),
    }),
  });
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

async function ollamaChat(messages: ChatMessage[]) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_CHAT_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate chat completion with Ollama: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}

export async function answerWithLocalKnowledge(question: string, conversation: ChatMessage[] = []) {
  const relevantContext = await getRelevantContext(question);

  const systemPrompt = [
    "You are a concise assistant running locally inside a Next.js app.",
    "Use the provided context when it is relevant.",
    "If the context does not answer the question, say what is missing and give the best practical next step.",
    "Do not mention internal implementation details unless the user asks for them.",
  ].join(" ");

  const contextBlock = relevantContext.length > 0
    ? relevantContext
        .map((item, index) => `[${index + 1}] ${item.document}`)
        .join("\n")
    : "No context retrieved.";

  const finalMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `Retrieved context:\n${contextBlock}` },
    ...conversation.filter((message) => message.role !== "system"),
    { role: "user", content: question },
  ];

  const answer = await ollamaChat(finalMessages);

  return {
    answer,
    context: relevantContext,
    model: OLLAMA_CHAT_MODEL,
  };
}
