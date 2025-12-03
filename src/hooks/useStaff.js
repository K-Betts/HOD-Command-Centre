import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import { useUserCollection } from './shared/useUserCollection';
import { useAcademicYear } from '../context/AcademicYearContext';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useStaff(user) {
  const { currentAcademicYear } = useAcademicYear();
  const {
    data: staff,
    add,
    update,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['staff']);

  const addStaff = async (member) => {
    if (!user) return;
    await add({ isLineManager: false, ...member });
  };

  const updateStaff = async (id, updates) => {
    if (!id) return;
    await update(id, updates);
  };

  const deleteStaff = async (id) => {
    if (!id) return;
    await remove(id);
  };

  const logInteraction = async (staffId, payload) => {
    if (!user || !staffId) return;
    if (!currentAcademicYear)
      throw new Error('Academic year not available for interactions yet.');
    const buckTag = payload.buckTag || 'admin';
    const interactionType = (payload.interactionType || buckTag || 'admin')
      .toString()
      .toUpperCase();
    await addDoc(
      collection(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'staff',
        staffId,
        'interactions'
      ),
      {
        date: payload.date,
        type: payload.type,
        summary: payload.summary,
        source: payload.source,
        buckTag,
        interactionType,
        staffId,
        staffName: payload.staffName || '',
        userId: user.uid,
        uid: user.uid,
        academicYear: currentAcademicYear,
        createdAt: serverTimestamp(),
      }
    );
  };

  return { staff, addStaff, updateStaff, deleteStaff, logInteraction, loading, error };
}

export function useInteractionLogs(user, staffId) {
  const enabled = Boolean(user && staffId);
  const {
    data,
    add,
    update,
    remove,
    loading,
    error,
  } = useUserCollection(enabled ? user : null, enabled ? ['staff', staffId, 'interactions'] : [], {
    filterByYear: true,
  });

  const sortedInteractions = useMemo(() => {
    const list = Array.isArray(data) ? data.slice() : [];
    return list.sort((a, b) => {
      const aDate = a.date || a.createdAt;
      const bDate = b.date || b.createdAt;
      const aVal = aDate?.toMillis ? aDate.toMillis() : new Date(aDate || 0).getTime();
      const bVal = bDate?.toMillis ? bDate.toMillis() : new Date(bDate || 0).getTime();
      return bVal - aVal;
    });
  }, [data]);

  const addInteraction = async (payload) => {
    if (!enabled) return;
    const interactionType = (payload.interactionType || payload.buckTag || 'ADMIN')
      .toString()
      .toUpperCase();
    await add({ ...payload, interactionType });
  };

  const updateInteraction = async (id, updates) => {
    if (!enabled || !id) return;
    const interactionType = updates?.interactionType
      ? updates.interactionType.toString().toUpperCase()
      : undefined;
    await update(id, interactionType ? { ...updates, interactionType } : updates);
  };

  const deleteInteraction = async (id) => {
    if (!enabled || !id) return;
    await remove(id);
  };

  return {
    interactions: enabled ? sortedInteractions : [],
    addInteraction,
    updateInteraction,
    deleteInteraction,
    loading: enabled ? loading : false,
    error: enabled ? error : null,
  };
}
