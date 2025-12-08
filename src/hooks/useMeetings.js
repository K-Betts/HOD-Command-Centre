import { useMemo } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { useUserCollection } from './shared/useUserCollection';
import { storage } from '../services/firebase';
import { useAcademicYear } from '../context/AcademicYearContext';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toMillis = (value) => {
  const date = normalizeDate(value);
  return date ? date.getTime() : 0;
};

const ensureIds = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id || generateId(),
    ...item,
  }));

export function useMeetings(user) {
  const { currentAcademicYear } = useAcademicYear();
  const {
    data,
    add,
    update,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['meetings'], {
    orderBy: [
      { field: 'meetingDate', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' },
    ],
  });

  const meetings = useMemo(() => {
    const list = Array.isArray(data) ? data.slice() : [];
    return list.sort((a, b) => toMillis(b.meetingDate || b.createdAt) - toMillis(a.meetingDate || a.createdAt));
  }, [data]);

  const addMeeting = async (payload = {}) => {
    if (!user) return null;
    const docRef = await add({
      title: payload.title || 'Department Meeting',
      meetingDate: payload.meetingDate || new Date().toISOString().slice(0, 10),
      startTime: payload.startTime || '',
      location: payload.location || '',
      attendees: Array.isArray(payload.attendees) ? payload.attendees : [],
      agenda: ensureIds(payload.agenda),
      actions: ensureIds(payload.actions),
      staffNotes: ensureIds(payload.staffNotes),
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      minutesSummary: payload.minutesSummary || '',
      type: payload.type || 'live',
      status: payload.status || 'planned',
      academicYear: currentAcademicYear || null,
      updatedAt: serverTimestamp(),
    });
    return docRef;
  };

  const updateMeeting = async (id, updates = {}) => {
    if (!id) return;
    await update(id, { ...updates, updatedAt: serverTimestamp() });
  };

  const deleteMeeting = async (id) => {
    if (!id) return;

    // Find the meeting so we can also clean up any stored attachments
    const meeting = (data || []).find((m) => m.id === id);

    // Best-effort delete of any files in Firebase Storage that belong to this meeting
    if (meeting && Array.isArray(meeting.attachments)) {
      for (const attachment of meeting.attachments) {
        if (!attachment?.storagePath) continue;
        try {
          const fileRef = ref(storage, attachment.storagePath);
          await deleteObject(fileRef);
        } catch (err) {
          // Don't block deletion of the meeting if a file can't be removed
          console.error('Failed to delete attachment from storage', attachment.storagePath, err);
        }
      }
    }

    // Finally remove the Firestore document via the shared collection helper
    await remove(id);
  };

  const uploadMinutesFile = async (meetingId, file, meta = {}) => {
    if (!user || !meetingId || !file) throw new Error('Missing parameters for upload.');
    const storagePath = meta.storagePath || `meetings/${user.uid}/${meetingId}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const attachment = {
      id: generateId(),
      name: meta.name || file.name,
      url,
      meetingDate: meta.meetingDate || '',
      note: meta.note || '',
      uploadedAt: new Date().toISOString(),
      storagePath,
      uploadedBy: user.uid,
      sourceType: meta.sourceType || 'attachment',
      actionsSnapshot: Array.isArray(meta.actionsSnapshot) ? meta.actionsSnapshot : [],
      attendeesSnapshot: Array.isArray(meta.attendeesSnapshot) ? meta.attendeesSnapshot : [],
      staffNotesSnapshot: Array.isArray(meta.staffNotesSnapshot) ? meta.staffNotesSnapshot : [],
    };

    const meeting = (data || []).find((m) => m.id === meetingId);
    const attachments = Array.isArray(meeting?.attachments) ? [...meeting.attachments, attachment] : [attachment];
    await updateMeeting(meetingId, { attachments });
    return attachment;
  };

  const addHistoricalMinutes = async ({
    title,
    meetingDate,
    note = '',
    file,
    previousTasks = [],
  } = {}) => {
    if (!user) return null;
    const docRef = await add({
      title: title || 'Historic Meeting',
      meetingDate: meetingDate || '',
      minutesSummary: note,
      type: 'archive',
      status: 'archived',
      attendees: [],
      agenda: [],
      actions: [],
      staffNotes: [],
      attachments: [],
      academicYear: currentAcademicYear || null,
      updatedAt: serverTimestamp(),
    });

    let attachment = null;
    if (file) {
      attachment = await uploadMinutesFile(docRef.id, file, {
        name: file.name,
        meetingDate,
        note,
        sourceType: 'archive',
        actionsSnapshot: Array.isArray(previousTasks) ? previousTasks : [],
      });
      await updateMeeting(docRef.id, { attachments: [attachment] });
    }

    return { id: docRef.id, attachment };
  };

  return {
    meetings,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    uploadMinutesFile,
    addHistoricalMinutes,
    loading,
    error,
  };
}
