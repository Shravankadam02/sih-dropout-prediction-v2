import mongoose from 'mongoose';

const riskSnapshotSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    riskScore: Number,
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High'] },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    class: String,
    rollNo: String,
    college: { type: String, default: 'MET Institute of Engineering' },
    department: { type: String, required: true },

    mentorId: { type: String, default: null }, // null = unassigned bucket
    counsellorId: { type: String, default: null }, // matches User.counsellorCode

    attendancePercent: { type: Number, default: 0 },
    feesDueDays: { type: Number, default: 0 },
    attemptsInSubjectX: { type: Number, default: 1 },

    lastTest1: Number,
    lastTest2: Number,
    lastTest3: Number,
    last3TestsAvg: { type: Number, default: 0 },
    previous3TestsAvg: { type: Number, default: 0 },

    email: String,
    phone: String,
    guardianContact: String,
    semester: String,

    riskHistory: [riskSnapshotSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Student', studentSchema);