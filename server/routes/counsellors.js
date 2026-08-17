import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/counsellors - Get list of all counsellors
router.get('/', protect, async (req, res) => {
  try {
    const counsellors = await User.find({ role: 'counsellor' })
      .select('-passwordHash')
      .lean();
    res.json(counsellors);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
