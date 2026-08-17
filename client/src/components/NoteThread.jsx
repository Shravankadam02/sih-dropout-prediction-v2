import { useState } from 'react';
import { FiCheckCircle, FiCircle } from 'react-icons/fi';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

export default function NoteThread({ studentId, notes, onNoteAdded, onNoteUpdated, canWrite }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/notes', { studentId, note: text });
      onNoteAdded(res.data.note);
      setText('');
      showToast('Note added', 'success');
    } catch {
      showToast('Failed to add note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (note) => {
    const newStatus = note.status === 'open' ? 'resolved' : 'open';
    try {
      const res = await api.patch(`/notes/${note._id}/status`, { status: newStatus });
      onNoteUpdated(res.data.note);
      showToast(newStatus === 'resolved' ? 'Marked as resolved' : 'Reopened', 'success');
    } catch {
      showToast('Failed to update note', 'error');
    }
  };

  return (
    <div>
      {canWrite && (
        <form onSubmit={handleAdd} className="mb-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Log an intervention or update..."
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="mt-2 text-xs font-medium bg-indigo-600 text-white px-3.5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Adding...' : 'Add Note'}
          </button>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n._id} className="border border-slate-200 rounded-lg p-3.5">
              <div className="flex justify-between items-start gap-3 mb-1.5">
                <p className="text-sm text-slate-700 flex-1">{n.note}</p>
                {canWrite && (
                  <button
                    onClick={() => toggleStatus(n)}
                    className="shrink-0 text-slate-400 hover:text-slate-700 transition"
                    title={n.status === 'open' ? 'Mark resolved' : 'Reopen'}
                  >
                    {n.status === 'resolved' ? (
                      <FiCheckCircle size={16} className="text-emerald-600" />
                    ) : (
                      <FiCircle size={16} />
                    )}
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">
                  {n.mentorId?.username || 'Mentor'} · {new Date(n.createdAt).toLocaleDateString()}
                </span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    n.status === 'resolved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {n.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}