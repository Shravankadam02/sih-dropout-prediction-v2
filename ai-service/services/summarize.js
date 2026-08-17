import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateEscalationSummary(messages) {
  const transcript = messages.map((m) => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content}`).join('\n');

  const prompt = `Summarize this student chat conversation for a human mentor who has not seen it. Write 2-3 factual sentences covering: what the student is concerned about, and any specific details mentioned (deadlines, circumstances, people involved). Do not diagnose, speculate about mental health conditions, or use clinical language — just describe what was said.

Conversation:
${transcript}

Summary:`;

  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}