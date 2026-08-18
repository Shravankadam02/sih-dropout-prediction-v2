import mongoose from 'mongoose';
import 'dotenv/config';
import Student from './models/Student.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const students = await Student.find().lean();
  
  const payload = students.map(s => ({
      age: s.age ?? 20,
      gender: s.gender ?? 1,
      attendance_percentage: s.attendance_percentage ?? s.attendancePercent ?? 75.0,
      previous_semester_gpa: s.previous_semester_gpa ?? s.previous3TestsAvg ?? 7.0,
      backlogs: s.backlogs ?? 0,
      internal_marks_percentage: s.internal_marks_percentage ?? s.last3TestsAvg ?? 70.0,
      assignment_completion_rate: s.assignment_completion_rate ?? 80.0,
      study_hours_per_week: s.study_hours_per_week ?? 10,
      failed_subjects: s.failed_subjects ?? (s.attemptsInSubjectX ? s.attemptsInSubjectX - 1 : 0),
      family_income: s.family_income ?? 300000,
      distance_from_college_km: s.distance_from_college_km ?? 10.0,
      fee_payment_delay: s.fee_payment_delay ?? (s.feesDueDays > 0 ? 1 : 0),
      scholarship: s.scholarship ?? 0,
      extracurricular_participation: s.extracurricular_participation ?? 0
  }));

  try {
    const res = await fetch('http://127.0.0.1:8000/predict_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.error(res.status, res.statusText);
      process.exit(1);
    }
    
    const results = await res.json();
    const scores = results.map(r => r.risk_score);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a,b) => a+b, 0) / scores.length;
    
    console.log(`Tested ${scores.length} students via API`);
    console.log(`Max Score: ${maxScore}`);
    console.log(`Avg Score: ${avgScore}`);
    
    const high = scores.filter(s => s >= 0.7).length;
    const medium = scores.filter(s => s >= 0.4 && s < 0.7).length;
    const low = scores.filter(s => s < 0.4).length;
    
    console.log(`High: ${high}, Medium: ${medium}, Low: ${low}`);
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
