import fs from 'fs';
import csv from 'csv-parser';

const rows = [];
fs.createReadStream('../demo_counsellors.csv')
  .pipe(csv())
  .on('data', (row) => rows.push(row))
  .on('end', () => {
    console.log(rows.map(r => ({ email: r.email, password: r.password, raw: r })));
  });
