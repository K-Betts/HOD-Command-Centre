import React, { useMemo, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { applyContextTags, ENERGY_OPTIONS, TIME_OPTIONS } from '../../utils/taskContext';

export function TaskDetailModal({ task, onSave, onDelete, onClose }) {
  const initial = useMemo(() => {
    const enriched = applyContextTags(task || {});
    return {
      title: enriched.title || '',
      summary: enriched.summary || '',
      status: enriched.status || 'todo',
      priority: enriched.priority || 'Medium',
      dueDate: enriched.dueDate || '',
      assignee: enriched.assignee || '',
      category: enriched.category || 'General',
      estimatedMinutes: enriched.estimatedMinutes || '',
      estimatedTime: enriched.estimatedTime || '',
      energyLevel: enriched.energyLevel || '',
      isWeeklyWin: typeof enriched.isWeeklyWin === 'boolean' ? enriched.isWeeklyWin : false,
      themeTag: enriched.themeTag || '',
      delegatedTo: enriched.delegatedTo || '',
      isWaitingFor: typeof enriched.isWaitingFor === 'boolean' ? enriched.isWaitingFor : false,
    };
  }, [task]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(initial);
  }, [initial]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDelegatedToChange = (value) => {
    const hasValue = value.trim().length > 0;
    setForm((prev) => ({
      ...prev,
      delegatedTo: value,
      isWaitingFor: hasValue ? true : false,
    }));
  };

  const handleSave = async () => {
    if (!task?.id || !onSave) return;
    setSaving(true);
    try {
      await onSave(task.id, form);
      onClose?.();
    } catch (err) {
      console.error('Failed to save task', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e) => {
    e?.stopPropagation?.();
    if (!task?.id || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(task.id);
      onClose?.();
    } catch (err) {
      console.error('Failed to delete task', err);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-2xl p-6 shadow-2xl border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Task Details
            </div>
            <div className="text-lg font-bold text-gray-900">{task?.title || 'Task'}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Assignee</label>
            <input
              value={form.assignee}
              onChange={(e) => handleChange('assignee', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
              placeholder="Name"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Delegated To (Optional)
              </label>
              <label className="text-[11px] font-semibold text-gray-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isWaitingFor}
                  onChange={(e) => handleChange('isWaitingFor', e.target.checked)}
                />
                Track in &quot;Waiting For&quot; list?
              </label>
            </div>
            <input
              value={form.delegatedTo}
              onChange={(e) => handleDelegatedToChange(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
              placeholder="Name you delegated to"
            />
            <p className="text-[11px] text-gray-400">
              Entering a name auto-tracks it in the Waiting For list.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white"
            >
              <option value="todo">To Do</option>
              <option value="doing">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Due Date</label>
            <input
              type="date"
              value={form.dueDate || ''}
              onChange={(e) => handleChange('dueDate', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
            <input
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
              placeholder="Admin / Strategic / Teaching"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Estimated Minutes
            </label>
            <input
              type="number"
              min="0"
              value={form.estimatedMinutes}
              onChange={(e) => handleChange('estimatedMinutes', Number(e.target.value))}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Strategy Tag</label>
            <input
              value={form.themeTag}
              onChange={(e) => handleChange('themeTag', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm"
              placeholder="Optional strategy link"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Energy Level</label>
            <select
              value={form.energyLevel}
              onChange={(e) => handleChange('energyLevel', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white"
            >
              <option value="">Auto</option>
              {ENERGY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Estimated Time</label>
            <select
              value={form.estimatedTime}
              onChange={(e) => handleChange('estimatedTime', e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white"
            >
              <option value="">Auto</option>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 flex items-end">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isWeeklyWin}
                onChange={(e) => handleChange('isWeeklyWin', e.target.checked)}
              />
              Mark as Weekly Win
            </label>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <label className="text-xs font-bold text-gray-500 uppercase">Summary</label>
          <textarea
            value={form.summary}
            onChange={(e) => handleChange('summary', e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-sm min-h-[100px]"
            placeholder="Notes or description"
          />
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-sm font-semibold"
          >
            <Trash2 size={16} /> Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
