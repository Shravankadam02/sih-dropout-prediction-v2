import express from 'express';
import multer from 'multer';
import fs from 'fs';
import csv from 'csv-parser';
import bcrypt from 'bcryptjs';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const REQUIRED_FIELDS = [
  'student_id', 'attendance_percent', 'fees_due_days',
  'attempts_in_subject_x', 'last_3_tests_avg', 'previous_3_tests_avg',
];

router.post('/', protect, requireRole('admin', 'mentor'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const rows = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      fs.unlinkSync(req.file.path); // cleanup temp file

      let processed = 0;
      let unassigned = 0;
      const skipped = [];

      for (const row of rows) {
        const missing = REQUIRED_FIELDS.filter((f) => !row[f] && row[f] !== '0');
        if (missing.length > 0) {
          skipped.push({ student_id: row.student_id || 'unknown', missing });
          continue;
        }

        const studentData = {
          studentId: row.student_id,
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          class: row.class || '',
          rollNo: row.roll_no || '',
          department: row.department || 'Unspecified',
          college: row.college || 'MET Institute of Engineering',
          mentorId: req.user.role === 'mentor' ? req.user.mentorCode : (row.mentor_id || null),
          attendancePercent: Number(row.attendance_percent),
          feesDueDays: Number(row.fees_due_days),
          attemptsInSubjectX: Number(row.attempts_in_subject_x),
          lastTest1: row.last_test_1 ? Number(row.last_test_1) : undefined,
          lastTest2: row.last_test_2 ? Number(row.last_test_2) : undefined,
          lastTest3: row.last_test_3 ? Number(row.last_test_3) : undefined,
          last3TestsAvg: Number(row.last_3_tests_avg),
          previous3TestsAvg: Number(row.previous_3_tests_avg),
          email: row.email || '',
          phone: row.phone || '',
          guardianContact: row.guardian_contact || '',
          semester: row.semester || '',
        };

        if (!studentData.mentorId) unassigned++;

        await Student.findOneAndUpdate(
          { studentId: studentData.studentId },
          studentData,
          { upsert: true, returnDocument: 'after' }
        );

        processed++;
      }

      res.json({
        message: 'CSV processed',
        processed,
        unassigned,
        skipped,
      });
    })
    .on('error', (err) => {
      res.status(500).json({ message: 'CSV parsing failed', error: err.message });
    });
});

// POST /api/upload/counsellors
router.post('/counsellors', protect, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const rows = [];
  const skipped = [];
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      fs.unlinkSync(req.file.path);
      
      let processed = 0;
      
      for (const row of rows) {
        if (!row.email || !row.counsellor_code) {
          skipped.push({ email: row.email, missing: ['email or counsellor_code'] });
          continue;
        }

        const password = row.password || 'password123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        const languages = row.languages ? row.languages.split(';').map(l => l.trim()) : [];
        
        await User.findOneAndUpdate(
          { username: row.email },
          {
            username: row.email,
            passwordHash,
            role: 'counsellor',
            counsellorCode: row.counsellor_code,
            specialization: row.specialization || '',
            phone: row.phone || '',
            languages
          },
          { upsert: true }
        );
        processed++;
      }
      
      res.json({ message: 'Counsellors CSV processed', processed, skipped });
    })
    .on('error', (err) => res.status(500).json({ message: 'CSV parsing failed', error: err.message }));
});

export default router;