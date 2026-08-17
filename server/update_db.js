import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const hash = await bcrypt.hash('demo123', 10);
    
    await db.collection('users').updateMany(
      { role: 'counsellor' },
      { $set: { passwordHash: hash } }
    );
    console.log('Updated counsellors to use demo123');
    process.exit(0);
  })
  .catch(console.error);
