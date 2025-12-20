import React, { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useStaff } from '../../hooks/useStaff';
import { useSchoolCalendarEvents } from '../../hooks/useSchoolCalendarEvents';
import { useMeetings } from '../../hooks/useMeetings';
import { askOmniBot } from '../../services/ai/chatAi';

function sanitizeTasks(tasks = []) {
  return (tasks || [])
    .slice(0, 60)
    .map((t) => ({
      id: t.id,
      title: t.title || t.name || '',
      status: t.status || '',
      assignee: t.assignee || t.staffId || t.delegatedTo || '',
      priority: t.priority || '',
      dueDate: t.dueDate ? (typeof t.dueDate.toDate === 'function' ? t.dueDate.toDate().toISOString().slice(0,10) : (''+t.dueDate).slice(0,10)) : null,
    }));
}

function sanitizeStaff(items = []) {
  return (items || []).slice(0, 60).map((s) => ({
    id: s.id,
    name: s.name || s.fullName || '',
    role: s.role || s.position || '',
    timetable: s.timetable || null,
  }));
}

function sanitizeCalendar(events = []) {
  return (events || []).slice(0, 60).map((e) => ({
    id: e.id,
    title: e.title || e.event || '',
    date: e.date || (e.dateObj ? e.dateObj.toISOString().slice(0,10) : ''),
    category: e.category || '',
  }));
}

function sanitizeMeetings(meetings = []) {
  return (meetings || []).slice(0, 60).map((m) => ({
    id: m.id,
    title: m.title || '',
    meetingDate: m.meetingDate || '',
    attendees: Array.isArray(m.attendees) ? m.attendees.map((a) => (a.name || a)) : [],
    minutesSummary: m.minutesSummary || m.summary || '',
    actions: Array.isArray(m.actions) ? m.actions.map((a) => ({ id: a.id, title: a.title || a })) : [],
  }));
}

export function ChatInterface({ user, onClose }) {
  const { tasks, updateTask, addTask } = useTasks(user);
  const { staff } = useStaff(user);
  const { events } = useSchoolCalendarEvents(user);
  const { meetings } = useMeetings(user);
  

  const [messages, setMessages] = useState([
    { id: 'init', role: 'assistant', text: 'Hello — I am Orbit, your Chief of Staff. How can I help today?' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, thinking]);

  const buildContext = () => {
    const ctx = {
      tasks: sanitizeTasks(tasks),
      staff: sanitizeStaff(staff),
      calendar: sanitizeCalendar(events),
      meetings: sanitizeMeetings(meetings),
    };
    return ctx;
  };

  const sendMessage = async () => {
    const text = (input || '').trim();
    if (!text) return;
    const userMsg = { id: `u_${Date.now()}`, role: 'user', text };
    setMessages((m) => [...m, userMsg]);
    setInput('');

    const contextObj = buildContext();
    const safeContext = JSON.stringify(contextObj);

    setThinking(true);
    try {
      const { text: replyText, commands } = await askOmniBot(text, safeContext);
      const assistantMsg = { id: `a_${Date.now()}`, role: 'assistant', text: replyText || 'Sorry, I could not generate a response.' };
      setMessages((m) => [...m, assistantMsg]);

      // If model returned commands, store as pending and prompt for confirmation
      if (commands && Array.isArray(commands) && commands.length) {
        const pending = { id: `pending_${Date.now()}`, commands };
        setPendingCommand(pending);
        // also append a system-style message asking for confirmation
        setMessages((m) => [
          ...m,
          {
            id: `confirm_${Date.now()}`,
            role: 'system',
            text: `I detected ${commands.length} suggested action(s). Confirm to execute or cancel.`,
            meta: { pendingId: pending.id },
          },
        ]);
      }
    } catch (err) {
      const errMsg = { id: `err_${Date.now()}`, role: 'assistant', text: 'AI service unavailable.' };
      setMessages((m) => [...m, errMsg]);
      console.error('askOmniBot failed', err);
    } finally {
      setThinking(false);
    }
  };

  const [pendingCommand, setPendingCommand] = useState(null);

  const executePending = async (pending) => {
    if (!pending || !pending.commands) return;
    for (const cmd of pending.commands) {
      if (cmd.action === 'reassignTask') {
        // find task by id or title
        let task = null;
        if (cmd.taskId) task = (tasks || []).find((t) => t.id === cmd.taskId);
        if (!task && cmd.taskTitle) {
          const title = cmd.taskTitle.toLowerCase();
          task = (tasks || []).find((t) => (t.title || '').toLowerCase().includes(title));
        }
        if (!task) {
          setMessages((m) => [...m, { id: `fail_${Date.now()}`, role: 'assistant', text: `Could not find task for command: ${JSON.stringify(cmd)}` }]);
          continue;
        }

        // find staff by name
        let staffId = undefined;
        let staffName = cmd.to;
        if (cmd.toId) {
          staffId = cmd.toId;
        } else if (cmd.to) {
          const match = (staff || []).find((s) => (s.name || '').toLowerCase() === (cmd.to || '').toLowerCase());
          if (match) staffId = match.id;
        }

        try {
          await updateTask(task.id, { delegatedTo: cmd.to || staffName || '', staffId: staffId || '' });
          setMessages((m) => [...m, { id: `done_${Date.now()}`, role: 'assistant', text: `Executed: reassigned task "${task.title}" to ${cmd.to || staffName}.` }]);
        } catch (e) {
          console.error('execute reassign failed', e);
          setMessages((m) => [...m, { id: `errexec_${Date.now()}`, role: 'assistant', text: `Failed to execute reassignment: ${e.message || String(e)}` }]);
        }
      }

      if (cmd.action === 'createTask') {
        try {
          await addTask({ title: cmd.task.title || 'New Task from Orbit', summary: cmd.task.summary || '', priority: cmd.task.priority || 'Medium', dueDate: cmd.task.dueDate || null });
          setMessages((m) => [...m, { id: `donec_${Date.now()}`, role: 'assistant', text: `Executed: created task "${cmd.task.title || 'New Task'}".` }]);
        } catch (e) {
          console.error('createTask failed', e);
          setMessages((m) => [...m, { id: `errc_${Date.now()}`, role: 'assistant', text: `Failed to create task: ${e.message || String(e)}` }]);
        }
      }
    }
    setPendingCommand(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="text-lg font-semibold">Orbit — Chief of Staff</div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-auto p-4 space-y-4 bg-slate-50">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'bg-indigo-600 text-white px-4 py-2 rounded-2xl max-w-[80%]'
                  : 'bg-white text-slate-900 px-4 py-2 rounded-2xl shadow'
              }
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-500 px-4 py-2 rounded-2xl shadow italic">Thinking...</div>
          </div>
        )}

        {pendingCommand && (
          <div className="p-4 bg-yellow-50 border rounded-md">
            <div className="text-sm">Orbit suggests the following action(s):</div>
            <pre className="text-xs whitespace-pre-wrap mt-2 bg-white p-2 rounded">{JSON.stringify(pendingCommand.commands, null, 2)}</pre>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => executePending(pendingCommand)}
                className="bg-emerald-600 text-white px-3 py-1 rounded"
              >
                Confirm
              </button>
              <button
                onClick={() => setPendingCommand(null)}
                className="bg-slate-200 px-3 py-1 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring"
            placeholder="Ask Orbit (e.g. 'When is Colm free?')"
          />
          <button
            onClick={sendMessage}
            disabled={thinking}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
