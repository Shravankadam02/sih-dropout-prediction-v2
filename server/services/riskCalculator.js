const WEIGHTS = { attendance: 0.50, scoreTrend: 0.30, fees: 0.15, attempts: 0.05 };
const THRESHOLDS = { high: 0.70, medium: 0.40 };

function attendanceRisk(pct) {
  return pct >= 75 ? 0 : Math.max(0, (75 - pct) / 75);
}

function scoreTrendRisk(prevAvg, currAvg) {
  if (!prevAvg || !currAvg) return 0;
  const drop = prevAvg - currAvg;
  if (drop <= 0) return 0;
  return Math.min(Math.max(drop / 100, 0), 1);
}

function feeRisk(daysOverdue) {
  return Math.min(daysOverdue / 90, 1);
}

function attemptsRisk(attempts) {
  return attempts <= 1 ? 0 : Math.min((attempts - 1) / 4, 1);
}

export function calculateRisk(student) {
  const aRisk = attendanceRisk(student.attendancePercent ?? 0);
  const sRisk = scoreTrendRisk(student.previous3TestsAvg ?? 0, student.last3TestsAvg ?? 0);
  const fRisk = feeRisk(student.feesDueDays ?? 0);
  const atRisk = attemptsRisk(student.attemptsInSubjectX ?? 1);

  const riskScore =
    WEIGHTS.attendance * aRisk +
    WEIGHTS.scoreTrend * sRisk +
    WEIGHTS.fees * fRisk +
    WEIGHTS.attempts * atRisk;

  const riskLevel =
    riskScore >= THRESHOLDS.high ? 'High' :
    riskScore >= THRESHOLDS.medium ? 'Medium' : 'Low';

  return {
    riskScore: Number(riskScore.toFixed(3)),
    riskLevel,
    components: {
      attendance: Number(aRisk.toFixed(3)),
      scoreTrend: Number(sRisk.toFixed(3)),
      fees: Number(fRisk.toFixed(3)),
      attempts: Number(atRisk.toFixed(3)),
    },
  };
}

// Explainability: turns components into plain-language reasons, sorted by severity
export function getTopReasons(components) {
  const labels = {
    attendance: 'Low attendance',
    scoreTrend: 'Declining test scores',
    fees: 'Fee payment overdue',
    attempts: 'Multiple subject attempts',
  };

  return Object.entries(components)
    .filter(([, val]) => val > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([key, val]) => ({ reason: labels[key], severity: Number(val.toFixed(2)) }));
}

export function generateRecommendations(riskLevel, components) {
  const recs = [];
  if (components.attendance > 0.3) recs.push('Schedule attendance counseling with the student');
  if (components.scoreTrend > 0.3) recs.push('Arrange remedial classes for recent weak subjects');
  if (components.fees > 0.3) recs.push('Connect student with fee-waiver/installment options');
  if (components.attempts > 0.3) recs.push('Recommend peer tutoring for repeated subject attempts');
  if (riskLevel === 'High' && recs.length === 0) recs.push('Schedule an immediate one-on-one check-in');
  return recs;
}