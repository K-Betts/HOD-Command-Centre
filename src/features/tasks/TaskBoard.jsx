import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Trash2,
  ArrowUpDown,
  Star,
  CheckSquare,
  Kanban as KanbanIcon,
  Timer,
} from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { useTasks } from '../../hooks/useTasks';
import { generateFingerprint } from '../../utils/fingerprint';
import { applyContextTags } from '../../utils/taskContext';
import { BrainCard } from '../../components/ui/BrainCard';
import { StatusBadge } from '../../components/ui/StatusBadge';

const statusLabels = {
  todo: 'On Deck',
  doing: 'In Flight',
  done: 'Completed',
};

const statusTone = {
  todo: 'strategy',
  doing: 'strategy',
  done: 'support',
};

const statusCardStyles = {
  todo: 'border-slate-200 bg-white hover:border-slate-300',
  doing: 'border-sky-200 bg-sky-50/70 hover:border-sky-300',
  done: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 opacity-90',
};

const statusRowStyles = {
  todo: 'border-slate-200 bg-white hover:bg-slate-50',
  doing: 'border-sky-400 bg-sky-50/70 hover:bg-sky-100',
  done: 'border-emerald-400 bg-emerald-50/70 hover:bg-emerald-100 opacity-90',
};

const priorityWeight = { High: 3, Medium: 2, Low: 1 };

const toDateValue = (value) => {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const taskKey = (task, idx, prefix = 'task') => {
  const base =
    task?.id ||
    task?.fingerprint ||
    task?.tempId ||
    (typeof task?.createdAt === 'string' ? task.createdAt : null) ||
    `${prefix}-${idx}`;
  return `${base}-${idx}`;
};

export function TaskBoard({ user, onEditTask }) {
  const { tasks, updateTask, deleteTask } = useTasks(user);
  const [sortBy, setSortBy] = useState('priority');
  const [viewMode, setViewMode] = useState('active');
  const [timeFeedbackTask, setTimeFeedbackTask] = useState(null);
  const [actualTime, setActualTime] = useState('same');

  const requestTimeFeedback = (task) => {
    setTimeFeedbackTask(task);
    setActualTime('same');
  };

  const completeTaskWithFeedback = async () => {
    if (!timeFeedbackTask) return;

    const estimated = timeFeedbackTask.estimatedMinutes || 0;
    const timeMapping = {
      same: estimated,
      less: Math.max(0, (estimated || 15) * 0.7),
      more: (estimated || 15) * 1.5,
    };

    try {
      await updateTask?.(timeFeedbackTask.id, {
        status: 'done',
        completedAt: serverTimestamp(),
        actualTime,
        actualMinutes: timeMapping[actualTime] || estimated,
      });
      setTimeFeedbackTask(null);
    } catch (err) {
      console.error('Failed to complete task', err);
    }
  };

  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.archivedAt && !t.isDelegated && !t.assignedTo),
    [tasks]
  );

  const sortedTasks = useMemo(() => {
    const next = [...activeTasks];
    if (sortBy === 'priority') {
      next.sort(
        (a, b) =>
          (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
      );
    } else if (sortBy === 'dueDate') {
      next.sort((a, b) => {
        const dateA = a.dueDate || '9999-99-99';
        const dateB = b.dueDate || '9999-99-99';
        return dateA.localeCompare(dateB);
      });
    } else {
      next.sort(
        (a, b) => toDateValue(b.createdAt || b.dateCreated) - toDateValue(a.createdAt || a.dateCreated)
      );
    }
    return next;
  }, [activeTasks, sortBy]);

  const weeklyWins = useMemo(
    () => sortedTasks.filter((t) => t.isWeeklyWin),
    [sortedTasks]
  );
  const adminTasks = useMemo(() => sortedTasks.filter((t) => !t.isWeeklyWin), [sortedTasks]);
  const archivedTasks = useMemo(
    () => tasks.filter((t) => t.archivedAt),
    [tasks]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Cockpit
          </p>
          <h2 className="text-2xl font-bold text-slate-900">Weekly Wins & Admin</h2>
          <p className="text-sm text-slate-500">
            Pinned wins up top, denser admin feed below. Archive lives as a sub-view.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <ArrowUpDown size={12} />
            Sort
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="p-2 pl-3 pr-8 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-slate-200 outline-none font-medium text-slate-700 transition-all hover:border-slate-300 cursor-pointer"
          >
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
            <option value="createdAt">Newest First</option>
          </select>
          <div className="bg-slate-100 border border-slate-200 rounded-full p-1 flex items-center gap-1">
            {[
              { id: 'active', label: 'Active' },
              { id: 'kanban', label: 'Kanban' },
              { id: 'archive', label: 'Archive' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  viewMode === mode.id
                    ? 'bg-white shadow text-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'archive' ? (
        <ArchiveView user={user} onEditTask={onEditTask} archivedTasks={archivedTasks} />
      ) : viewMode === 'kanban' ? (
        <>
          <BrainCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Weekly Wins
                </p>
                <h3 className="text-xl font-bold text-slate-900">Celebrate the signal</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Pinned: {weeklyWins.length}
              </span>
            </div>
            {weeklyWins.length === 0 ? (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 p-5 text-slate-500">
                <span>No Weekly Wins pinned. Promote a task to spotlight it.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {weeklyWins.map((task, idx) => (
                  <WeeklyWinCard
                    key={taskKey(task, idx, 'weekly')}
                    task={task}
                    onEditTask={onEditTask}
                    updateTask={updateTask}
                    deleteTask={deleteTask}
                  />
                ))}
              </div>
            )}
          </BrainCard>

          <KanbanBoard
            tasks={activeTasks}
            updateTask={updateTask}
            deleteTask={deleteTask}
            onEditTask={onEditTask}
            onRequestTimeFeedback={requestTimeFeedback}
          />
        </>
      ) : (
        <>
          <BrainCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Weekly Wins
                </p>
                <h3 className="text-xl font-bold text-slate-900">Celebrate the signal</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Pinned: {weeklyWins.length}
              </span>
            </div>
            {weeklyWins.length === 0 ? (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 p-5 text-slate-500">
                <span>No Weekly Wins pinned. Promote a task to spotlight it.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {weeklyWins.map((task, idx) => (
                  <WeeklyWinCard
                    key={taskKey(task, idx, 'weekly')}
                    task={task}
                    onEditTask={onEditTask}
                    updateTask={updateTask}
                    deleteTask={deleteTask}
                  />
                ))}
              </div>
            )}
          </BrainCard>

          <BrainCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Admin / Tasks
                </p>
                <h3 className="text-xl font-bold text-slate-900">Cockpit feed</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {adminTasks.length} active
              </span>
            </div>
            {adminTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-slate-500 text-sm">
                Everything is either pinned to Weekly Wins or complete.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {adminTasks.map((task, idx) => (
                  <TaskRow
                    key={taskKey(task, idx, 'task')}
                    task={task}
                    updateTask={updateTask}
                    deleteTask={deleteTask}
                    onEditTask={onEditTask}
                    onRequestTimeFeedback={requestTimeFeedback}
                  />
                ))}
              </div>
            )}
          </BrainCard>
        </>
      )}

      {/* Time Feedback Modal */}
      {timeFeedbackTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-100 rounded-2xl">
                <Timer className="text-indigo-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Task Complete!</h3>
                <p className="text-sm text-gray-500">How was the time estimate?</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-1">{timeFeedbackTask.title}</p>
              <p className="text-xs text-gray-500">
                Estimated: {timeFeedbackTask.estimatedTime || timeFeedbackTask.estimatedMinutes + ' mins' || 'Not set'}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                Actual Time
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'less', label: 'Less', emoji: '⚡', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                  { value: 'same', label: 'Same', emoji: '✓', color: 'bg-sky-50 border-sky-200 text-sky-700' },
                  { value: 'more', label: 'More', emoji: '⏰', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setActualTime(option.value)}
                    className={`p-4 rounded-2xl border-2 font-semibold text-sm transition-all ${
                      actualTime === option.value
                        ? `${option.color} shadow-md scale-105`
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    <div>{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setTimeFeedbackTask(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={completeTaskWithFeedback}
                className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                Complete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- shared utility used across task views
export function createTaskFingerprint(taskLike, forcedAssignee) {
  return generateFingerprint(
    {
      title: taskLike.title,
      dueDate: taskLike.dueDate,
      assignee: forcedAssignee || taskLike.assignee,
      category: taskLike.category,
    },
    'task'
  );
}

function ArchiveView({ user, onEditTask, archivedTasks: provided }) {
  const { tasks, updateTask, deleteTask } = useTasks(user);

  const archivedTasks = useMemo(
    () => provided || tasks.filter((t) => t.archivedAt),
    [provided, tasks]
  );

  const handleRestore = async (task) => {
    await updateTask(task.id, {
      archivedAt: null,
      completedAt: null,
      status: 'todo',
    });
  };

  return (
    <BrainCard className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Archive
          </p>
          <h3 className="text-xl font-bold text-slate-900">Past tasks</h3>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {archivedTasks.length} item{archivedTasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {archivedTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-slate-500 text-sm">
          No archived tasks yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {archivedTasks.map((task, idx) => (
            <TaskRow
              key={taskKey(task, idx, 'archived')}
              task={task}
              updateTask={updateTask}
              deleteTask={deleteTask}
              onEditTask={onEditTask}
              archived
              onRestore={() => handleRestore(task)}
            />
          ))}
        </div>
      )}
    </BrainCard>
  );
}

function KanbanBoard({ tasks = [], updateTask, deleteTask, onEditTask, onRequestTimeFeedback }) {
  const columns = [
    { key: 'todo', title: 'On Deck', description: 'Ready to start', accent: 'bg-sky-50 border-sky-100' },
    { key: 'doing', title: 'In Flight', description: 'Currently moving', accent: 'bg-amber-50 border-amber-100' },
    { key: 'done', title: 'Completed', description: 'Shipped and celebrated', accent: 'bg-emerald-50 border-emerald-100' },
  ];

  const byStatus = tasks.reduce((acc, task) => {
    const status = (task.status || 'todo').toLowerCase();
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {});

  const moveTask = async (task, direction) => {
    const order = ['todo', 'doing', 'done'];
    const current = (task.status || 'todo').toLowerCase();
    const currentIdx = order.indexOf(current);
    const nextIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
    const nextStatus = order[Math.max(0, Math.min(order.length - 1, nextIdx))];
    if (!nextStatus || nextStatus === current) return;
    
    if (nextStatus === 'done') {
      // Trigger time feedback modal
      onRequestTimeFeedback?.(task);
      return;
    }
    
    try {
      await updateTask?.(task.id, {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? serverTimestamp() : null,
      });
    } catch (err) {
      console.error('Failed to move task', err);
    }
  };

  // Completion is handled by the parent TaskBoard time-feedback modal.

  const handleDelete = async (task, e) => {
    e?.stopPropagation?.();
    if (typeof window !== 'undefined' && !window.confirm('Delete this task?')) return;
    try {
      await deleteTask?.(task.id);
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const renderCard = (task, idx) => {
    const displayTask = applyContextTags(task);
    const status = (displayTask.status || 'todo').toLowerCase();
    const cardTone = statusCardStyles[status] || statusCardStyles.todo;
    const order = ['todo', 'doing', 'done'];
    const canMoveLeft = order.indexOf(status) > 0;
    const canMoveRight = order.indexOf(status) < order.length - 1;
    const dueDateValue = displayTask.dueDate ? new Date(displayTask.dueDate) : null;
    const hasDueDate = dueDateValue && !Number.isNaN(dueDateValue.getTime());

    return (
      <div
        key={taskKey(task, idx, status)}
        onClick={() => onEditTask?.(task)}
        className={`p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer space-y-3 ${cardTone}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900 line-clamp-2">
              {displayTask.title || 'Untitled'}
            </div>
            {displayTask.summary && (
              <div className="text-xs text-slate-500 line-clamp-2">{displayTask.summary}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canMoveLeft && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveTask(task, 'left');
                }}
                className="p-1.5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                title="Move left"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {canMoveRight && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveTask(task, 'right');
                }}
                className="p-1.5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                title="Move right"
              >
                <ChevronRight size={14} />
              </button>
            )}
            <button
              onClick={(e) => handleDelete(task, e)}
              className="p-1.5 rounded-full border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600">
          <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 font-semibold">
            Priority: {getEffectivePriority(displayTask)}
          </span>
          {displayTask.assignee && (
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200 font-semibold">
              {displayTask.assignee}
            </span>
          )}
          {displayTask.energyLevel && (
            <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold">
              {displayTask.energyLevel}
            </span>
          )}
          {displayTask.estimatedMinutes && (
            <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 font-semibold flex items-center gap-1">
              <Clock size={12} /> {displayTask.estimatedMinutes}m
            </span>
          )}
          {hasDueDate && (
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200 font-semibold flex items-center gap-1">
              <Calendar size={12} />
              {dueDateValue.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <BrainCard className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
            <KanbanIcon size={14} /> Kanban Board
          </p>
          <h3 className="text-xl font-bold text-slate-900">Flow by status</h3>
          <p className="text-sm text-slate-500">Drag-free, quick taps to move left/right.</p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {tasks.length} active item{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = byStatus[col.key] || [];
          return (
            <div
              key={col.key}
              className={`rounded-2xl border ${col.accent} p-4 space-y-3 min-h-[220px]`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-slate-600">{col.title}</div>
                  <div className="text-[11px] text-slate-500">{col.description}</div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-white/70 px-2 py-1 rounded-full border border-slate-200">
                  {colTasks.length}
                </span>
              </div>
              {colTasks.length === 0 ? (
                <div className="text-sm text-slate-400 italic">No tasks here yet.</div>
              ) : (
                <div className="space-y-3">
                  {colTasks.map((task, idx) => renderCard(task, idx))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BrainCard>
  );
}

function WeeklyWinCard({ task, onEditTask, updateTask, deleteTask }) {
  const displayTask = applyContextTags(task);
  const dueDateValue = displayTask.dueDate ? new Date(displayTask.dueDate) : null;
  const hasDueDate = dueDateValue && !Number.isNaN(dueDateValue.getTime());

  const toggleWeeklyWin = async (e) => {
    e.stopPropagation();
    await updateTask(task.id, { isWeeklyWin: !displayTask.isWeeklyWin });
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && !window.confirm('Delete this task?')) return;
    try {
      await deleteTask?.(task.id);
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  return (
    <div
      onClick={() => onEditTask?.(task)}
      className="p-5 rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white hover:shadow-md transition-all cursor-pointer group"
    >
        <div className="flex items-start justify-between gap-3">
          <StatusBadge tone="support" label="Weekly Win" />
          <div className="flex items-center gap-2">
            {hasDueDate && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-white/70 border border-emerald-100 text-emerald-700">
                <Calendar size={12} />
                {dueDateValue.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          <button
            onClick={toggleWeeklyWin}
            className="p-2 rounded-full bg-white/80 border border-slate-200 text-amber-600 hover:bg-amber-50 transition-colors"
            title="Unpin from Weekly Wins"
          >
            <Star size={14} fill="currentColor" />
          </button>
          <button
            onClick={(e) => {
              handleDelete(e);
            }}
            className="p-2 rounded-full bg-white/80 border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900 leading-snug">
        {displayTask.title}
      </div>
      {displayTask.summary && (
        <p className="text-sm text-slate-600 mt-2 leading-relaxed line-clamp-3">
          {displayTask.summary}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
        {displayTask.assignee && (
          <span className="px-2 py-1 rounded-full bg-white/70 border border-emerald-100 font-semibold">
            {displayTask.assignee}
          </span>
        )}
        {displayTask.category && (
          <span className="px-2 py-1 rounded-full bg-emerald-100/80 text-emerald-800 font-semibold">
            {displayTask.category}
          </span>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, updateTask, deleteTask, onEditTask, archived = false, onRestore, onRequestTimeFeedback }) {
  const displayTask = applyContextTags(task);
  const manualPriority = displayTask.priority || 'Medium';
  const effectivePriority = getEffectivePriority(displayTask);
  const currentStatus = (displayTask.status || 'todo').toString().toLowerCase();
  const statusOrder = ['todo', 'doing', 'done'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < statusOrder.length - 1;

  const handleMove = async (direction, e) => {
    e.stopPropagation();
    let newIndex = currentIndex;
    if (direction === 'left' && canMoveLeft) newIndex = currentIndex - 1;
    if (direction === 'right' && canMoveRight) newIndex = currentIndex + 1;

    const newStatus = statusOrder[newIndex];
    if (!newStatus) return;

    if (newStatus === 'done' && onRequestTimeFeedback) {
      onRequestTimeFeedback(task);
      return;
    }

    if (newStatus === 'done') {
      await updateTask(task.id, {
        status: newStatus,
        completedAt: serverTimestamp(),
      });
    } else {
      await updateTask(task.id, {
        status: newStatus,
        completedAt: null,
      });
    }
  };

  const handleToggleWeeklyWin = async (e) => {
    e.stopPropagation();
    await updateTask(task.id, { isWeeklyWin: !displayTask.isWeeklyWin });
  };

  const handleMarkDone = async (e) => {
    e.stopPropagation();
    if (onRequestTimeFeedback) {
      onRequestTimeFeedback(task);
      return;
    }
    await updateTask(task.id, { status: 'done', completedAt: serverTimestamp() });
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && !window.confirm('Delete this task?')) return;
    try {
      await deleteTask?.(task.id);
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const dueDateValue = displayTask.dueDate ? new Date(displayTask.dueDate) : null;
  const hasDueDate = dueDateValue && !Number.isNaN(dueDateValue.getTime());
  const isOverdue = hasDueDate ? dueDateValue < new Date() : false;
  const rowTone = statusRowStyles[currentStatus] || statusRowStyles.todo;

  return (
    <div
      onClick={() => onEditTask?.(task)}
      className={`flex items-start justify-between gap-4 p-4 transition-colors cursor-pointer border-l-4 rounded-xl ${rowTone}`}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge
            tone={statusTone[currentStatus] || 'strategy'}
            label={archived ? 'Archived' : statusLabels[currentStatus] || 'Task'}
          />
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
            Priority: {effectivePriority}
            {effectivePriority !== manualPriority ? ' • time-adjusted' : ''}
          </span>
          {displayTask.category && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
              {displayTask.category}
            </span>
          )}
          {displayTask.assignee && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
              {displayTask.assignee}
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-slate-900 leading-snug">
          {displayTask.title}
        </div>
        {displayTask.summary && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {displayTask.summary}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
          {displayTask.energyLevel && (
            <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
              {displayTask.energyLevel}
            </span>
          )}
          {displayTask.estimatedMinutes && (
            <span className="px-2 py-1 rounded-lg bg-slate-100 font-semibold flex items-center gap-1">
              <Clock size={12} />
              {displayTask.estimatedMinutes}m
            </span>
          )}
          {hasDueDate && (
            <span
              className={`px-2 py-1 rounded-lg border font-semibold inline-flex items-center gap-1 ${
                isOverdue
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <Calendar size={12} />
              {dueDateValue.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!archived && (
          <>
            <button
              onClick={handleToggleWeeklyWin}
              className={`p-2 rounded-full border text-amber-600 transition-colors ${
                displayTask.isWeeklyWin
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-200 hover:bg-amber-50'
              }`}
              title={displayTask.isWeeklyWin ? 'Unpin from Weekly Wins' : 'Pin to Weekly Wins'}
            >
              <Star size={14} fill={displayTask.isWeeklyWin ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => handleMove('left', e)}
              disabled={!canMoveLeft}
              className="p-2 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="Move earlier"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={(e) => handleMove('right', e)}
              disabled={!canMoveRight}
              className="p-2 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="Move later"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={handleMarkDone}
              disabled={currentStatus === 'done'}
              className="p-2 rounded-full border border-slate-200 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
              title="Mark done"
            >
              <CheckSquare size={14} />
            </button>
          </>
        )}
        {archived && onRestore && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className="p-2 rounded-full border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
            title="Restore to active"
          >
            <RefreshCw size={14} />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="p-2 rounded-full border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Delete task"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- shared utility used by context widgets
export function getEffectivePriority(task) {
  const manualPriority = task?.priority || 'Medium';
  if (!task?.dueDate) return manualPriority;

  const order = { Low: 1, Medium: 2, High: 3 };
  const clamp = (desired) =>
    order[manualPriority] >= order[desired] ? manualPriority : desired;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'High';
  if (diffDays === 1) return clamp('Medium');
  if (diffDays > 14) return manualPriority;
  return manualPriority;
}
