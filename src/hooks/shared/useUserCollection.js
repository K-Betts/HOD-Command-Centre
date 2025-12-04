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

  // Stabilise arrays so callers using inline literals don't resubscribe on every render.
  const segmentsKey = useMemo(
    () => (Array.isArray(segments) ? segments.join('::') : ''),
    [segments]
  );
  const resolvedSegments = useMemo(
    () => (Array.isArray(segments) ? [...segments] : []),
    [segmentsKey]
  );

  const collectionRef = useMemo(() => {
    if (!user) return null;
    return collection(db, 'artifacts', appId, 'users', user.uid, ...resolvedSegments);
  }, [user, resolvedSegments]);

  const whereKey = useMemo(
    () => (Array.isArray(options.where) ? JSON.stringify(options.where) : ''),
    [options.where]
  );
  const whereRules = useMemo(
    () => (whereKey ? JSON.parse(whereKey) : []),
    [whereKey]
  );

  const orderKey = useMemo(
    () => (Array.isArray(options.orderBy) ? JSON.stringify(options.orderBy) : ''),
    [options.orderBy]
  );
  const orderRules = useMemo(
    () => (orderKey ? JSON.parse(orderKey) : []),
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

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription drives local state */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
