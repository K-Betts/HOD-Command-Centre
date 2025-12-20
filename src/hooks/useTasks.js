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
    if (!user?.uid || !currentAcademicYear) return undefined;
    runAutoArchive(user, currentAcademicYear).catch((err) =>
      console.error('Auto-archive failed', err)
    );
    return undefined;
  }, [user, currentAcademicYear]);

  const normalizeDelegationForAdd = (task = {}) => {
    const delegatedTo = (task.delegatedTo || '').toString().trim();
    const isWaitingFor =
      typeof task.isWaitingFor === 'boolean'
        ? task.isWaitingFor
        : Boolean(delegatedTo);
    return { delegatedTo, isWaitingFor };
  };

  const buildDelegationPatch = (updates = {}, existing = {}) => {
    const hasDelegatedUpdate = Object.prototype.hasOwnProperty.call(
      updates,
      'delegatedTo'
    );
    const hasWaitingUpdate = Object.prototype.hasOwnProperty.call(
      updates,
      'isWaitingFor'
    );

    if (!hasDelegatedUpdate && !hasWaitingUpdate) return {};

    const delegatedSource = hasDelegatedUpdate
      ? updates.delegatedTo
      : existing.delegatedTo;
    const delegatedTo = (delegatedSource || '').toString().trim();

    let isWaitingFor = hasWaitingUpdate
      ? updates.isWaitingFor
      : existing.isWaitingFor;
    if (!hasWaitingUpdate && hasDelegatedUpdate) {
      isWaitingFor = Boolean(delegatedTo);
    }

    return {
      delegatedTo,
      isWaitingFor: Boolean(isWaitingFor),
    };
  };

  const addTask = async (task) => {
    if (!user) return;
    const delegation = normalizeDelegationForAdd(task);
    await add({ ...task, ...delegation });
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

    const delegationPatch = buildDelegationPatch(updates, existing || {});

    await update(id, { ...updates, ...delegationPatch });

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

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    archiveTask,
    runAutoArchive: () => runAutoArchive(user, currentAcademicYear),
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
  if (!user?.uid || !academicYear) return;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const q = query(
    collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'),
    where('uid', '==', user.uid),
    where('status', '==', 'done'),
    where('academicYear', '==', academicYear)
  );
  const snap = await getDocs(q);
  const updates = snap.docs.filter((d) => {
    const data = d.data();
    return data.completedAt && !data.archivedAt && isOlderThan(data.completedAt, startOfToday);
  });
  await Promise.all(
    updates.map((docSnap) =>
      updateDoc(docSnap.ref, { archivedAt: serverTimestamp() }).catch((err) => console.error(err))
    )
  );
}
