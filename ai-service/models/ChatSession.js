import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    status: { type: String, enum: ['active', 'escalated', 'resolved'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('ChatSession', chatSessionSchema);