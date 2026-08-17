import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fast first-pass — catches obvious explicit cases cheaply, without an extra API call
const DISTRESS_PATTERNS = [
  /\b(suicid|self.?harm|kill myself|end my life|hurt myself)\b/i,
  /\b(want to die|no reason to live|can'?t go on)\b/i,
  /\b(talk to (a )?(real|human) (person|mentor)|speak to my mentor|connect me (with|to) my mentor)\b/i,
  /\b(being harassed|being bullied|someone is threatening)\b/i,
];

export function checkDistressKeywords(message) {
  return DISTRESS_PATTERNS.some((pattern) => pattern.test(message));
}

// Real safety net — classifies intent even when wording doesn't match a pattern
export async function checkDistressIntent(message) {
  const prompt = `Classify this message from a student to an AI mentor. Respond with ONLY one word: "escalate" or "safe".

Respond "escalate" if the message expresses: suicidal thoughts or self-harm intent (even indirectly phrased, like hopelessness about the future or "not seeing the point"), a request to talk to a real person, harassment, abuse, or a crisis the student needs human help with.

Respond "safe" for normal academic, emotional, or day-to-day concerns, even if stressed or frustrated in tone.

Message: "${message}"

Classification:`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await model.generateContent(prompt);
    const classification = result.response.text().trim().toLowerCase();
    return classification.includes('escalate');
  } catch (err) {
    // If classification itself fails, fail safe — escalate rather than silently miss it
    console.error('Distress classification failed, escalating as precaution:', err.message);
    return true;
  }
}