import express from 'express';
import Student from '../models/Student.js';
import Note from '../models/Note.js';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { calculateRisk } from '../services/riskCalculator.js';

const router = express.Router();

// GET /api/summary — admin and mentor dashboard stats
router.get('/', protect, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const query = req.user.role === 'mentor' ? { mentorId: req.user.mentorCode } : {};
    const students = await Student.find(query);

    // Risk distribution
    const distribution = { High: 0, Medium: 0, Low: 0 };
    const byDepartment = {};   // { "IT": { High: 2, Medium: 1, Low: 5 }, ... }
    const byClass = {};
    const attendanceDistribution = { '0-50%': 0, '51-65%': 0, '66-75%': 0, '76-85%': 0, '86-100%': 0 };
    const testTrends = [];
    const highRiskStudents = [];

    for (const s of students) {
      const { riskLevel, riskScore, topReasons } = calculateRisk(s);
      distribution[riskLevel]++;

      const dept = s.department || 'Unspecified';
      byDepartment[dept] = byDepartment[dept] || { High: 0, Medium: 0, Low: 0 };
      byDepartment[dept][riskLevel]++;

      const cls = s.class || 'Unspecified';
      byClass[cls] = byClass[cls] || { High: 0, Medium: 0, Low: 0 };
      byClass[cls][riskLevel]++;

      // Attendance Buckets
      const att = s.attendancePercent || 0;
      if (att <= 50) attendanceDistribution['0-50%']++;
      else if (att <= 65) attendanceDistribution['51-65%']++;
      else if (att <= 75) attendanceDistribution['66-75%']++;
      else if (att <= 85) attendanceDistribution['76-85%']++;
      else attendanceDistribution['86-100%']++;

      // Test Trends
      if (s.previous3TestsAvg != null && s.last3TestsAvg != null) {
        testTrends.push({ x: s.previous3TestsAvg, y: s.last3TestsAvg, risk: riskLevel });
      }

      // High Risk List
      if (riskLevel === 'High') {
        highRiskStudents.push({
          studentId: s.studentId,
          name: `${s.firstName} ${s.lastName}`,
          class: s.class,
          riskScore: Math.round(riskScore * 100),
          primaryIssue: topReasons?.[0]?.reason || 'Multiple Factors'
        });
      }
    }

    highRiskStudents.sort((a, b) => b.riskScore - a.riskScore);

    // Unassigned students (no mentor)
    const unassignedCount = students.filter((s) => !s.mentorId).length;

    // Open interventions aging report
    const notesQuery = { status: 'open' };
    if (req.user.role === 'mentor') {
      notesQuery.studentId = { $in: students.map(s => s.studentId) };
    }
    const openNotes = await Note.find(notesQuery).sort({ createdAt: 1 });
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const agingReport = openNotes.map((n) => {
      const ageMs = now - new Date(n.createdAt).getTime();
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      return {
        noteId: n._id,
        studentId: n.studentId,
        ageDays,
        stale: ageMs > THIRTY_DAYS_MS,
      };
    });

    const staleCount = agingReport.filter((n) => n.stale).length;

    res.json({
      totalStudents: students.length,
      unassignedCount,
      riskDistribution: distribution,
      byDepartment,
      byClass,
      attendanceDistribution,
      testTrends,
      highRiskStudents: highRiskStudents.slice(0, 5),
      openInterventions: {
        total: openNotes.length,
        staleOver30Days: staleCount,
        details: agingReport,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;