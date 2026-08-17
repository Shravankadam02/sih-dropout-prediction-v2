import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Escalation from '../models/Escalation.js';
import { checkDistressKeywords, checkDistressIntent } from '../services/escalationDetector.js';
import { generateEscalationSummary } from '../services/summarize.js';

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

const COLLECTION_NAME = 'dropout_kb';
const LOW_CONFIDENCE_THRESHOLD = 0.65;

async function embedQuery(text) {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function retrieveContext(queryVector, topK = 3) {
  const results = await qdrant.query(COLLECTION_NAME, {
    query: queryVector,
    limit: topK,
    with_payload: true,
  });
  return results.points;
}

function buildSystemPrompt(studentContext, retrievedChunks) {
  const contextText = retrievedChunks.map((r) => `[${r.payload.topic}] ${r.payload.text}`).join('\n\n');
  return `You are a supportive AI mentor for a student at an engineering college in India. Your role is to offer encouraging, practical guidance — not clinical or robotic advice.

Student context (use to personalize, never state their exact risk score or label directly):
- Name: ${studentContext.firstName || 'the student'}
- Attendance: ${studentContext.attendancePercent}%
- Recent test average: ${studentContext.last3TestsAvg}
- Fee status: ${studentContext.feesDueDays > 0 ? `${studentContext.feesDueDays} days overdue` : 'clear'}

Relevant guidance from the knowledge base:
${contextText || 'No specific guidance found for this topic.'}

Instructions:
- Keep responses warm, brief (3-5 sentences), and actionable.
- Ground your advice in the knowledge base content above when relevant.
- Never make a clinical diagnosis or give medical/psychiatric advice.
- If you don't have relevant guidance for the topic, say so honestly and suggest they could talk to their mentor for more specific help — don't pretend to have expertise you don't.`;
}

// POST /chat — main conversational endpoint
router.post('/', async (req, res) => {
  try {
    const { message, studentContext, chatSessionId } = req.body;

    if (!message || !studentContext || !studentContext.studentId) {
      return res.status(400).json({ message: 'message and studentContext (with studentId) are required' });
    }

    // Get or create the chat session
    let session = chatSessionId ? await ChatSession.findById(chatSessionId) : null;
    if (!session) {
      session = await ChatSession.create({ studentId: studentContext.studentId, status: 'active' });
    }

    // Save the student's message
    await ChatMessage.create({ chatSessionId: session._id, role: 'user', content: message });

    // Check for automatic escalation trigger first, before spending a generation call
    const isDistress = checkDistressKeywords(message) || await checkDistressIntent(message);

    if (isDistress) {
      const allMessages = await ChatMessage.find({ chatSessionId: session._id }).sort({ createdAt: 1 });
      const summary = await generateEscalationSummary(allMessages);

      const escalation = await Escalation.create({
        studentId: studentContext.studentId,
        mentorId: studentContext.mentorId || null,
        reason: 'distress_keyword',
        summary,
        chatSessionId: session._id,
        status: 'open',
      });

      session.status = 'escalated';
      await session.save();

      const handoffReply = "I hear that this is difficult, and I want to make sure you get the right support. I'm connecting you with your mentor now — they'll be able to help in a way I can't.";
      await ChatMessage.create({ chatSessionId: session._id, role: 'ai', content: handoffReply });

      return res.json({
        reply: handoffReply,
        chatSessionId: session._id,
        escalated: true,
        escalationId: escalation._id,
      });
    }

    // Normal RAG flow
    const queryVector = await embedQuery(message);
    const retrieved = await retrieveContext(queryVector);
    const topScore = retrieved.length > 0 ? retrieved[0].score : 0;
    const lowConfidence = topScore < LOW_CONFIDENCE_THRESHOLD;

    const systemPrompt = buildSystemPrompt(studentContext, retrieved);

    const history = await ChatMessage.find({ chatSessionId: session._id }).sort({ createdAt: 1 });
    const chatHistory = history.slice(0, -1).map((h) => ({ // exclude the just-added current message
      role: h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    await ChatMessage.create({
      chatSessionId: session._id,
      role: 'ai',
      content: reply,
      retrievedTopics: retrieved.map((r) => r.payload.topic),
    });

    res.json({
      reply,
      chatSessionId: session._id,
      escalated: false,
      lowConfidence, // frontend uses this to show a "Talk to my mentor" suggestion
      retrievedTopics: retrieved.map((r) => r.payload.topic),
    });
  } catch (err) {
    res.status(500).json({ message: 'Chat failed', error: err.message });
  }
});

// POST /chat/escalate — manual, student-initiated escalation
router.post('/escalate', async (req, res) => {
  try {
    const { chatSessionId, studentContext } = req.body;
    if (!chatSessionId || !studentContext) {
      return res.status(400).json({ message: 'chatSessionId and studentContext are required' });
    }

    const session = await ChatSession.findById(chatSessionId);
    if (!session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    const allMessages = await ChatMessage.find({ chatSessionId: session._id }).sort({ createdAt: 1 });
    const summary = allMessages.length > 0
      ? await generateEscalationSummary(allMessages)
      : 'Student requested to speak with their mentor.';

    const escalation = await Escalation.create({
      studentId: studentContext.studentId,
      mentorId: studentContext.mentorId || null,
      reason: 'student_requested',
      summary,
      chatSessionId: session._id,
      status: 'open',
    });

    session.status = 'escalated';
    await session.save();

    res.json({ message: 'Escalation created', escalationId: escalation._id });
  } catch (err) {
    res.status(500).json({ message: 'Escalation failed', error: err.message });
  }
});

export default router;