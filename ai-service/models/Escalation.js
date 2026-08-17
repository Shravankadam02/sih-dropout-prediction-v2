import mongoose from 'mongoose';

const escalationSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    mentorId: { type: String, default: null },
    reason: { type: String, required: true },
    summary: { type: String, default: '' },
    chatSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
  },
  { timestamps: true }
);

export default mongoose.model('Escalation', escalationSchema);