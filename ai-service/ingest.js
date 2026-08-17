import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_DIR = path.join(__dirname, 'knowledge-base');
const COLLECTION_NAME = 'dropout_kb';
const EMBEDDING_DIM = 3072; // Gemini text-embedding-004 output size

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

function chunkText(text, chunkSize = 500) {
  // Simple paragraph-based chunking — splits on blank lines, keeps chunks under ~500 chars
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > chunkSize && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

async function embed(text) {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function ingest() {
  console.log('Setting up Qdrant collection...');
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (exists) {
    await qdrant.deleteCollection(COLLECTION_NAME);
    console.log('Cleared existing collection.');
  }

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
  });

  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith('.txt'));
  let pointId = 1;
  const points = [];

  for (const file of files) {
    const topic = file.replace('.txt', '');
    const content = fs.readFileSync(path.join(KB_DIR, file), 'utf-8');
    const chunks = chunkText(content);

    console.log(`Embedding ${chunks.length} chunks from ${file}...`);

    for (const chunk of chunks) {
      const vector = await embed(chunk);
      points.push({
        id: pointId++,
        vector,
        payload: { topic, text: chunk },
      });
    }
  }

  console.log(`Uploading ${points.length} points to Qdrant...`);
  await qdrant.upsert(COLLECTION_NAME, { points });

  console.log(`Ingestion complete. ${points.length} chunks indexed.`);
}

ingest().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});