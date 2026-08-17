import { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiMessageCircle, FiAlertCircle, FiBookOpen, FiCalendar, FiTrendingDown, FiX } from 'react-icons/fi';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Hi! I'm here if you want to talk through anything — study habits, attendance, exam stress, or just how things are going. What's on your mind?" },
  ]);
  const SUGGESTED_PROMPTS = [
    { label: 'Study habits', icon: FiBookOpen, prompt: 'Can you help me build a better study routine?' },
    { label: 'Attendance help', icon: FiCalendar, prompt: "I'm finding it hard to keep up with attendance lately." },
    { label: 'Exam stress', icon: FiTrendingDown, prompt: "I'm feeling stressed about upcoming exams." },
  ];
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const [escalated, setEscalated] = useState(false);
  const [showMentorPrompt, setShowMentorPrompt] = useState(false);
  const bottomRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-chat-widget', handleOpen);
    return () => window.removeEventListener('open-chat-widget', handleOpen);
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || escalated) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setShowMentorPrompt(false);

    try {
      const res = await api.post('/chat', { message: text, chatSessionId });

      const data = res.data;
      setChatSessionId(data.chatSessionId);
      setMessages((prev) => [...prev, { role: 'ai', content: data.reply }]);

      if (data.escalated) {
        setEscalated(true);
      } else if (data.lowConfidence) {
        setShowMentorPrompt(true);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', content: "Sorry, I'm having trouble responding right now. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const requestMentor = async () => {
    if (!chatSessionId) return;
    setSending(true);
    try {
      await api.post('/chat/escalate', { chatSessionId });
      setEscalated(true);
      setMessages((prev) => [...prev, { role: 'ai', content: "I've let your mentor know you'd like to talk. They'll reach out soon." }]);
      showToast('Mentor notified', 'success');
    } catch {
      showToast('Failed to connect with mentor. Please try again.', 'error');
    } finally {
      setSending(false);
      setShowMentorPrompt(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-700 transition z-50"
      >
        <FiMessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col h-[500px] max-h-[80vh] z-50">
      <div className="bg-indigo-600 text-white p-4 rounded-t-xl flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-sm">Mentor AI</h3>
          <p className="text-xs text-indigo-200">A supportive space</p>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition">
          <FiX size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                m.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              {m.role === 'user' ? <FiUser size={13} /> : <FiMessageCircle size={13} />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {messages.length === 1 && !sending && (
          <div className="flex flex-col gap-2 pl-9">
            {SUGGESTED_PROMPTS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.prompt)}
                  className="flex items-center gap-2 text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition text-left"
                >
                  <Icon size={14} className="shrink-0" />
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FiMessageCircle size={13} />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-400">
              Typing...
            </div>
          </div>
        )}

        {showMentorPrompt && !escalated && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-3 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <FiAlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">Want to talk to your mentor about this instead?</p>
            </div>
            <button
              onClick={requestMentor}
              disabled={sending}
              className="text-xs font-medium bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition w-full"
            >
              Connect with Mentor
            </button>
          </div>
        )}

        {escalated && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-3 text-center">
            <p className="text-xs text-indigo-700">
              This conversation has been shared with your mentor. They'll follow up with you soon.
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={escalated ? 'Handed off to mentor' : 'Type a message...'}
          disabled={sending || escalated}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={sending || escalated || !input.trim()}
          className="bg-indigo-600 text-white px-3.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center"
        >
          <FiSend size={15} />
        </button>
      </form>
    </div>
  );
}
