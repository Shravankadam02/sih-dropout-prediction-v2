import mongoose from 'mongoose';
import 'dotenv/config';
import Student from './models/Student.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const students = await Student.find({}, 'studentId attendancePercent riskScore riskLevel').lean();
  
  const high = students.filter(s => s.riskLevel === 'High').length;
  const medium = students.filter(s => s.riskLevel === 'Medium').length;
  const low = students.filter(s => s.riskLevel === 'Low').length;
  
  const maxScore = Math.max(...students.map(s => s.riskScore || 0));
  const minScore = Math.min(...students.map(s => s.riskScore || 0));
  const avgScore = students.reduce((acc, s) => acc + (s.riskScore || 0), 0) / (students.length || 1);
  
  console.log(`High: ${high}, Medium: ${medium}, Low: ${low}`);
  console.log(`Max Risk: ${maxScore}, Min Risk: ${minScore}, Avg Risk: ${avgScore}`);
  
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
