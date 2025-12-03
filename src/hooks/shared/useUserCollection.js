import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy as orderByClause,
  query,
  updateDoc,
  where as whereClause,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { useAcademicYear } from '../../context/AcademicYearContext';

/**
 * Generic Firestore collection hook scoped to the current user.
 * - Auto-filters by uid for safety.
 * - Auto-attaches uid on create.
 */
export function useUserCollection(user, segments = [], options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentAcademicYear, loading: academicYearLoading } = useAcademicYear();
  const filterByYear = Boolean(options.filterByYear);

  const segmentsKey = useMemo(
    () => JSON.stringify(Array.isArray(segments) ? segments : []),
    [segments]
  );
  const resolvedSegments = useMemo(
    () => (Array.isArray(segments) ? [...segments] : []),
    [segmentsKey]
  );

  const collectionRef = useMemo(() => {
    if (!user) return null;
    return collection(db, 'artifacts', appId, 'users', user.uid, ...resolvedSegments);
  }, [user, segmentsKey]);

  const whereKey = useMemo(
    () => JSON.stringify(options.where || []),
    [options.where]
  );
  const orderKey = useMemo(
    () => JSON.stringify(options.orderBy || []),
    [options.orderBy]
  );

  const whereRules = useMemo(
    () => (Array.isArray(options.where) ? options.where : []),
    [whereKey]
  );

  const orderRules = useMemo(
    () => (Array.isArray(options.orderBy) ? options.orderBy : []),
    [orderKey]
  );

  const constraints = useMemo(() => {
    if (!user) return [];

    const whereFilters = [
      whereClause('uid', '==', user.uid),
      ...(filterByYear && currentAcademicYear
        ? [whereClause('academicYear', '==', currentAcademicYear)]
        : []),
      ...whereRules
        .map((w) => {
          if (!w || !w.field || !w.op) return null;
          return whereClause(w.field, w.op, w.value);
        })
        .filter(Boolean),
    ];

    const orderFilters = orderRules
      .map((o) => {
        if (!o) return null;
        if (typeof o === 'string') return orderByClause(o);
        if (o.field) return orderByClause(o.field, o.direction || 'asc');
        return null;
      })
      .filter(Boolean);

    return [...whereFilters, ...orderFilters];
  }, [user, whereRules, orderRules, filterByYear, currentAcademicYear]);

  useEffect(() => {
    if (!collectionRef) {
      setData([]);
      setLoading(false);
      return undefined;
    }

    if (filterByYear && !academicYearLoading && !currentAcademicYear) {
      setData([]);
      setLoading(false);
      setError('Academic year not available.');
      return undefined;
    }

    if (filterByYear && (academicYearLoading || !currentAcademicYear)) {
      setLoading(true);
      return undefined;
    }

    setLoading(true);
    const q = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setError(null);
        // Ensure Firestore doc id is authoritative to avoid collisions with any stored "id" field
        const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        setData(rows);
        setLoading(false);
      },
      (err) => {
        console.error('useUserCollection snapshot error', err);
        setError(err.message || 'Failed to load data.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionRef, constraints, filterByYear, academicYearLoading, currentAcademicYear]);

  const add = useCallback(
    async (payload) => {
      if (!collectionRef || !user) throw new Error('No user session.');
      if (filterByYear && !currentAcademicYear)
        throw new Error('Academic year is not available for writes yet.');
      const docPayload = { ...payload, uid: user.uid };
      if (filterByYear) docPayload.academicYear = currentAcademicYear;
      if (!docPayload.createdAt) docPayload.createdAt = serverTimestamp();
      return addDoc(collectionRef, docPayload);
    },
    [collectionRef, user, filterByYear, currentAcademicYear]
  );

  const update = useCallback(
    async (id, updates) => {
      if (!collectionRef || !user || !id) throw new Error('Missing parameters.');
      const ref = doc(collectionRef, id);
      return updateDoc(ref, { ...updates, uid: user.uid });
    },
    [collectionRef, user]
  );

  const remove = useCallback(
    async (id) => {
      if (!collectionRef || !user || !id) throw new Error('Missing parameters.');
      const ref = doc(collectionRef, id);
      return deleteDoc(ref);
    },
    [collectionRef, user]
  );

  return { data, loading, error, add, update, remove };
}
