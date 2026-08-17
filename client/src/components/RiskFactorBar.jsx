const LABELS = {
  attendance: 'Attendance',
  scoreTrend: 'Score Trend',
  fees: 'Fee Payment',
  attempts: 'Subject Attempts',
};

export default function RiskFactorBar({ factorKey, value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#DC2626' : pct >= 40 ? '#D97706' : '#059669';

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-slate-600">{LABELS[factorKey] || factorKey}</span>
        <span className="text-xs font-mono font-medium text-slate-500">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}