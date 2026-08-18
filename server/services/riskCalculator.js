export async function calculateRiskBatch(students) {
  if (!students || students.length === 0) return [];

  try {
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

    // Native fetch available in Node.js 18+
    const response = await fetch('http://127.0.0.1:8000/predict_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('ML API Error:', response.statusText);
      throw new Error('Failed to fetch risk scores from ML model');
    }

    const results = await response.json();
    
    // Merge results with student data
    return students.map((s, index) => {
      const result = results[index];
      const riskScore = result.risk_score;
      let riskLevel = 'Low';
      if (riskScore >= 0.7) riskLevel = 'High';
      else if (riskScore >= 0.4) riskLevel = 'Medium';

      return {
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        class: s.class,
        department: s.department,
        mentorId: s.mentorId,
        counsellorId: s.counsellorId,
        riskScore: Number(riskScore.toFixed(3)),
        riskLevel,
        mlInsights: result
      };
    });
  } catch (error) {
    console.error('Error calculating batch risk:', error);
    // Fallback if ML service is down
    return students.map(s => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      class: s.class,
      department: s.department,
      mentorId: s.mentorId,
      counsellorId: s.counsellorId,
      riskScore: 0,
      riskLevel: 'Low',
      mlInsights: null
    }));
  }
}

export async function calculateRisk(student) {
  try {
    const payload = {
      age: student.age ?? 20,
      gender: student.gender ?? 1,
      attendance_percentage: student.attendance_percentage ?? student.attendancePercent ?? 75.0,
      previous_semester_gpa: student.previous_semester_gpa ?? student.previous3TestsAvg ?? 7.0,
      backlogs: student.backlogs ?? 0,
      internal_marks_percentage: student.internal_marks_percentage ?? student.last3TestsAvg ?? 70.0,
      assignment_completion_rate: student.assignment_completion_rate ?? 80.0,
      study_hours_per_week: student.study_hours_per_week ?? 10,
      failed_subjects: student.failed_subjects ?? (student.attemptsInSubjectX ? student.attemptsInSubjectX - 1 : 0),
      family_income: student.family_income ?? 300000,
      distance_from_college_km: student.distance_from_college_km ?? 10.0,
      fee_payment_delay: student.fee_payment_delay ?? (student.feesDueDays > 0 ? 1 : 0),
      scholarship: student.scholarship ?? 0,
      extracurricular_participation: student.extracurricular_participation ?? 0
    };

    const response = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('ML API Error:', response.statusText);
      throw new Error('Failed to fetch risk score from ML model');
    }

    const result = await response.json();
    const riskScore = result.risk_score;
    let riskLevel = 'Low';
    if (riskScore >= 0.7) riskLevel = 'High';
    else if (riskScore >= 0.4) riskLevel = 'Medium';

    return {
      riskScore: Number(riskScore.toFixed(3)),
      riskLevel,
      mlInsights: result
    };
  } catch (error) {
    console.error('Error calculating risk:', error);
    return {
      riskScore: 0,
      riskLevel: 'Low',
      mlInsights: null
    };
  }
}

export function getTopReasons(mlInsights) {
  if (!mlInsights || !mlInsights.top_factors) return [];
  
  // Format the raw features into readable strings
  const labels = {
    age: 'Student Age',
    gender: 'Gender',
    attendance_percentage: 'Low attendance',
    previous_semester_gpa: 'Low previous GPA',
    backlogs: 'Active backlogs',
    internal_marks_percentage: 'Declining internal marks',
    assignment_completion_rate: 'Low assignment completion',
    study_hours_per_week: 'Low study hours',
    failed_subjects: 'Multiple failed subjects',
    family_income: 'Family income',
    distance_from_college_km: 'Long commute distance',
    fee_payment_delay: 'Fee payment overdue',
    scholarship: 'Lack of scholarship',
    extracurricular_participation: 'No extracurricular participation'
  };

  return mlInsights.top_factors
    .filter(factor => factor.impact > 0.02) // Only significant positive impact (increases risk)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(factor => ({
      reason: labels[factor.feature] || factor.feature,
      severity: Number(factor.impact.toFixed(3))
    }));
}

export function generateRecommendations(riskLevel, mlInsights) {
  const recs = [];
  if (!mlInsights || !mlInsights.top_factors) return ['Schedule an immediate check-in to gather more data'];
  
  mlInsights.top_factors.forEach(factor => {
    if (factor.impact > 0.05) {
      if (factor.feature === 'attendance_percentage') recs.push('Schedule attendance counseling with the student');
      if (factor.feature === 'internal_marks_percentage' || factor.feature === 'previous_semester_gpa') recs.push('Arrange remedial classes for recent weak subjects');
      if (factor.feature === 'fee_payment_delay' || factor.feature === 'family_income') recs.push('Connect student with fee-waiver/installment options');
      if (factor.feature === 'failed_subjects' || factor.feature === 'backlogs') recs.push('Recommend peer tutoring for repeated subject attempts');
      if (factor.feature === 'study_hours_per_week') recs.push('Discuss study habits and time management');
      if (factor.feature === 'assignment_completion_rate') recs.push('Monitor assignment submissions closely');
    }
  });

  if (riskLevel === 'High' && recs.length === 0) recs.push('Schedule an immediate one-on-one check-in');
  
  return [...new Set(recs)];
}