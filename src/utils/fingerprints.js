import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function fingerprintEvent(event) {
  const title = (event?.title || event?.event || '').trim().toLowerCase();
  const date = (event?.date || '').toString().slice(0, 10);
  if (!title || !date) return '';
  return `${title}|${date}`;
}

export function fingerprintInsight(insight) {
  const name = (insight?.staffName || '').trim().toLowerCase();
  const date = (insight?.date || '').toString().slice(0, 10);
  const summary = (insight?.summary || '').trim().toLowerCase();
  if (!name || !date || !summary) return '';
  return `${name}|${date}|${summary}`;
}

export function fingerprintStrategyNote(note) {
  const theme = (note?.theme || '').trim().toLowerCase();
  const content = (note?.note || '').trim().toLowerCase();
  if (!theme && !content) return '';
  return `${theme}|${content}`;
}

export async function fetchRecentStaffInsightFingerprints(user) {
  if (!user) return new Set();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const q = query(
    collection(db, 'artifacts', appId, 'users', user.uid, 'staffInsights'),
    where('createdAt', '>=', since)
  );
  const snap = await getDocs(q);
  const fps = new Set();
  snap.forEach((doc) => {
    const data = doc.data();
    const fp = data?.fingerprint || fingerprintInsight(data || {});
    if (fp) fps.add(fp);
  });
  return fps;
}

export async function fetchRecentStrategyNoteFingerprints(user) {
  if (!user) return new Set();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const q = query(
    collection(db, 'artifacts', appId, 'users', user.uid, 'strategyNotes'),
    where('createdAt', '>=', since)
  );
  const snap = await getDocs(q);
  const fps = new Set();
  snap.forEach((doc) => {
    const data = doc.data();
    const fp = data?.fingerprint || fingerprintStrategyNote(data || {});
    if (fp) fps.add(fp);
  });
  return fps;
}
