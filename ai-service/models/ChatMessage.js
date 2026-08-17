import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    chatSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    role: { type: String, enum: ['user', 'ai'], required: true },
    content: { type: String, required: true },
    retrievedTopics: [String],
  },
  { timestamps: true }
);

export default mongoose.model('ChatMessage', chatMessageSchema);