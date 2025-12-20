import test from 'node:test';

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const APP_ID = 'hod-production-v1';

/**
 * Use a unique project id so parallel runs don't conflict.
 * This project id is only for the emulator session.
 */
const projectId = `rules-test-${Date.now()}`;

let testEnv;

async function seedRole(uid, role) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'roles', uid), { role, createdAt: Date.now() });
  });
}

async function seedAiQuotaDay(uid, dayKey, count = 1) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, 'artifacts', APP_ID, 'aiQuota', uid, 'days', dayKey),
      { uid, dayKey, count, createdAt: Date.now() },
      { merge: true }
    );
  });
}

test.before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules,
    },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test('unauthenticated users are denied', async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(
    addDoc(collection(db, 'artifacts', APP_ID, 'telemetry'), { event: 'x' })
  );

  await assertFails(
    setDoc(doc(db, 'artifacts', APP_ID, 'users', 'u1', 'profile', 'p1'), { a: 1 })
  );
});

test('authenticated but without a role are denied', async () => {
  const db = testEnv
    .authenticatedContext('u1', { email: 'user@example.com' })
    .firestore();

  await assertFails(
    addDoc(collection(db, 'artifacts', APP_ID, 'telemetry'), { event: 'x' })
  );

  await assertFails(
    setDoc(doc(db, 'artifacts', APP_ID, 'users', 'u1', 'profile', 'p1'), { a: 1 })
  );
});

test('role=user can create telemetry but cannot read/list it', async () => {
  await seedRole('u1', 'user');

  const db = testEnv.authenticatedContext('u1', { email: 'user@example.com' }).firestore();

  const telemetryRef = collection(db, 'artifacts', APP_ID, 'telemetry');
  await assertSucceeds(addDoc(telemetryRef, { event: 'x', ts: Date.now() }));

  await assertFails(getDocs(telemetryRef));

  const knownDoc = doc(db, 'artifacts', APP_ID, 'telemetry', 'known');
  await assertFails(getDoc(knownDoc));
});

test('role=admin can read/list telemetry and feedback', async () => {
  await seedRole('a1', 'admin');
  const db = testEnv.authenticatedContext('a1', { email: 'admin@example.com' }).firestore();

  const telemetryRef = collection(db, 'artifacts', APP_ID, 'telemetry');
  const feedbackRef = collection(db, 'artifacts', APP_ID, 'feedback');

  await assertSucceeds(addDoc(telemetryRef, { event: 'x', ts: Date.now() }));
  await assertSucceeds(addDoc(feedbackRef, { type: 'crash', ts: Date.now() }));

  await assertSucceeds(getDocs(telemetryRef));
  await assertSucceeds(getDocs(feedbackRef));
});

test('role=user can read/write their own user namespace only', async () => {
  await seedRole('u2', 'user');
  await seedRole('u3', 'user');

  const ownDb = testEnv.authenticatedContext('u2', { email: 'user2@example.com' }).firestore();
  const otherDb = testEnv.authenticatedContext('u3', { email: 'user3@example.com' }).firestore();

  await assertSucceeds(
    setDoc(doc(ownDb, 'artifacts', APP_ID, 'users', 'u2', 'profile', 'p1'), { ok: true })
  );
  await assertFails(
    setDoc(doc(otherDb, 'artifacts', APP_ID, 'users', 'u4', 'profile', 'p1'), { no: true })
  );
});

test('roles doc access: self get allowed; admin list allowed; non-superadmin writes denied', async () => {
  await seedRole('u9', 'user');
  await seedRole('a9', 'admin');

  const selfDb = testEnv.authenticatedContext('u9', { email: 'self@example.com' }).firestore();
  const adminDb = testEnv.authenticatedContext('a9', { email: 'admin@example.com' }).firestore();

  await assertSucceeds(getDoc(doc(selfDb, 'roles', 'u9')));
  await assertFails(getDoc(doc(selfDb, 'roles', 'a9')));

  await assertSucceeds(getDocs(collection(adminDb, 'roles')));
  await assertFails(setDoc(doc(adminDb, 'roles', 'u9'), { role: 'admin' }));
});

test('aiQuota namespace: users cannot write/read; admins can read', async () => {
  await seedRole('u10', 'user');
  await seedRole('a10', 'admin');
  await seedAiQuotaDay('u10', '20251220', 3);

  const userDb = testEnv.authenticatedContext('u10', { email: 'user10@example.com' }).firestore();
  const adminDb = testEnv.authenticatedContext('a10', { email: 'admin10@example.com' }).firestore();

  await assertFails(
    setDoc(doc(userDb, 'artifacts', APP_ID, 'aiQuota', 'u10', 'days', '20251220'), { count: 999 })
  );

  await assertFails(getDoc(doc(userDb, 'artifacts', APP_ID, 'aiQuota', 'u10', 'days', '20251220')));
  await assertSucceeds(getDoc(doc(adminDb, 'artifacts', APP_ID, 'aiQuota', 'u10', 'days', '20251220')));
});
