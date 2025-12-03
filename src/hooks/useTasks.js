import { useEffect, useMemo } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useUserCollection } from './shared/useUserCollection';
import { useAcademicYear } from '../context/AcademicYearContext';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';
import { useToast } from '../context/ToastContext';

export function useTasks(user) {
  const { currentAcademicYear } = useAcademicYear();
  const { addToast } = useToast();
  const {
    data: taskDocs,
    add,
    update,
    remove: removeTask,
    loading,
    error,
  } = useUserCollection(user, ['tasks'], {
    filterByYear: true,
  });

  const tasks = useMemo(
    () => (taskDocs || []).filter((t) => !t.archivedAt),
    [taskDocs]
  );

  useEffect(() => {
    if (!user || !currentAcademicYear) return undefined;
    runAutoArchive(user, currentAcademicYear).catch((err) =>
      console.error('Auto-archive failed', err)
    );
    return undefined;
  }, [user, currentAcademicYear]);

  const addTask = async (task) => {
    if (!user) return;
    await add(task);
  };

  const updateTask = async (id, updates) => {
    if (!user || !id) return;
    const existing = (taskDocs || []).find((t) => t.id === id);
    const currentStatus = (existing?.status || '').toLowerCase();
    const nextStatus = (updates?.status || existing?.status || '').toLowerCase();
    const linkedStaffId = updates?.staffId || existing?.staffId;
    const normalizedTitle = (updates?.title || existing?.title || '').toLowerCase();
    const becameDone = nextStatus === 'done' && currentStatus !== 'done';

    let toastMessage = '';
    if (becameDone && linkedStaffId) {
      const challengeMatch = ['observation', 'feedback', 'review'].some((kw) =>
        normalizedTitle.includes(kw.toLowerCase())
      );
      const supportMatch = ['check-in', 'check in', 'coffee', 'wellbeing'].some((kw) =>
        normalizedTitle.includes(kw.toLowerCase())
      );
      if (challengeMatch) toastMessage = 'Log this as a CHALLENGE interaction?';
      else if (supportMatch) toastMessage = 'Log this as a SUPPORT interaction?';
    }

    if (existing && updates.priority && updates.priority !== existing.priority) {
      await addDoc(
        collection(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'priorityFeedback'
        ),
        {
          taskId: id,
          oldPriority: existing.priority || 'Medium',
          newPriority: updates.priority,
          category: updates.category || existing.category || 'General',
          assignee: updates.assignee || existing.assignee || '',
          uid: user.uid,
          academicYear: currentAcademicYear || null,
          timestamp: serverTimestamp(),
        }
      );
    }

    await update(id, updates);

    if (toastMessage) {
      addToast('success', toastMessage);
    }
  };

  const deleteTask = async (id) => {
    if (!user || !id) return;
    await removeTask(id);
  };

  const archiveTask = async (id) => {
    if (!id) return;
    await update(id, { archivedAt: serverTimestamp() });
  };

  const weeklyStrategySplit = useMemo(
    () => calculateWeeklyStrategySplit(tasks),
    [tasks]
  );

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    archiveTask,
    runAutoArchive: () => runAutoArchive(user, currentAcademicYear),
    weeklyStrategySplit,
    classifyTaskFocus,
    loading,
    error,
  };
}

function isOlderThan(dateValue, cutoffDate) {
  try {
    const d =
      typeof dateValue?.toDate === 'function'
        ? dateValue.toDate()
        : new Date(dateValue);
    return d < cutoffDate;
  } catch {
    return false;
  }
}

async function runAutoArchive(user, academicYear) {
  if (!user || !academicYear) return;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const q = query(
    collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'),
    where('status', '==', 'done'),
    where('academicYear', '==', academicYear)
  );
  const snap = await getDocs(q);
  const updates = snap.docs.filter((d) => {
    const data = d.data();
    return data.completedAt && !data.archivedAt && isOlderThan(data.completedAt, oneWeekAgo);
  });
  await Promise.all(
    updates.map((docSnap) =>
      updateDoc(docSnap.ref, { archivedAt: serverTimestamp() }).catch((err) => console.error(err))
    )
  );
}

export function classifyTaskFocus(task) {
  if (!task) return 'operational';
  const category = (task.category || '').toString().toLowerCase();
  const adminTagged =
    category.includes('admin') || category.includes('maintenance');
  if (adminTagged) return 'operational';

  const linkedToProject = Boolean(task.projectId || task.project || task.projectTitle);
  const linkedToStrategy = Boolean(task.strategyId || task.strategy || task.themeTag);
  const strategicCategory = category === 'strategic';

  if (linkedToProject || linkedToStrategy || strategicCategory) return 'strategic';
  return 'operational';
}

export function calculateWeeklyStrategySplit(tasks = [], now = new Date()) {
  const { start, end } = getCurrentWeekWindow(now);
  const completedThisWeek = (tasks || []).filter((t) => {
    const status = (t.status || '').toString().toLowerCase();
    if (status !== 'done') return false;
    const completionDate =
      normalizeDate(t.completedAt) ||
      normalizeDate(t.updatedAt) ||
      normalizeDate(t.dueDate) ||
      normalizeDate(t.createdAt);
    if (!completionDate) return false;
    return completionDate >= start && completionDate <= end;
  });

  const counts = completedThisWeek.reduce(
    (acc, task) => {
      const focus = classifyTaskFocus(task);
      if (focus === 'strategic') acc.strategic += 1;
      else acc.operational += 1;
      return acc;
    },
    { strategic: 0, operational: 0 }
  );

  const total = counts.strategic + counts.operational;
  return {
    strategyRatio: total ? counts.strategic / total : 0,
    operationalRatio: total ? counts.operational / total : 0,
    counts: { ...counts, total },
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

function getCurrentWeekWindow(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  const day = start.getDay(); // Sunday = 0, Monday = 1
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
