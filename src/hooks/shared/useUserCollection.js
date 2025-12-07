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
 * - Stabilises all dependency inputs with JSON.stringify to prevent render loops.
 */
export function useUserCollection(user, segments = [], options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentAcademicYear, loading: academicYearLoading } = useAcademicYear();

  // Stabilise inputs
  const segmentsKey = useMemo(
    () => JSON.stringify(Array.isArray(segments) ? segments : []),
    [segments]
  );
  const resolvedSegments = useMemo(() => {
    try {
      return JSON.parse(segmentsKey);
    } catch {
      return [];
    }
  }, [segmentsKey]);

  const optionsKey = useMemo(() => JSON.stringify(options || {}), [options]);
  const parsedOptions = useMemo(() => {
    try {
      return JSON.parse(optionsKey);
    } catch {
      return {};
    }
  }, [optionsKey]);

  const filterByYear = Boolean(parsedOptions.filterByYear);
  const whereRules = useMemo(
    () => (Array.isArray(parsedOptions.where) ? parsedOptions.where : []),
    [parsedOptions]
  );
  const orderRules = useMemo(
    () => (Array.isArray(parsedOptions.orderBy) ? parsedOptions.orderBy : []),
    [parsedOptions]
  );

  const collectionRef = useMemo(() => {
    if (!user) return null;
    return collection(db, 'artifacts', appId, 'users', user.uid, ...resolvedSegments);
  }, [user, resolvedSegments]);

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

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription controls state */
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
