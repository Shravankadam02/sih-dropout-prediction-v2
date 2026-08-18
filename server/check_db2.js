import mongoose from 'mongoose';
import 'dotenv/config';
import Student from './models/Student.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const s = await Student.findOne({ attendancePercent: { $lt: 40 } }).lean();
  console.log(s);
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
