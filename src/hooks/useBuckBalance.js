import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

const riskWeight = { high: 2, medium: 1, none: 0 };

function normalizeBuckTag(interaction = {}) {
  const raw =
    (interaction.interactionType ||
      interaction.buckTag ||
      interaction.buckType ||
      interaction.buck_balance ||
      interaction.buck ||
      '').toString().toLowerCase();
  if (raw.startsWith('chall')) return 'challenge';
  if (raw.startsWith('supp')) return 'support';
  if (raw.startsWith('obs')) return 'observation';
  if (raw.startsWith('admin') || raw.startsWith('neutral')) return 'admin';

  const fallback = (interaction.type || '').toString().toLowerCase();
  if (fallback === 'praise') return 'support';
  if (fallback === 'concern') return 'challenge';
  if (fallback === 'observation') return 'observation';
  return 'admin';
}

function parseDate(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') return value.toDate();
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function daysSince(date) {
  if (!date) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = today.getTime() - target.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function computeRisk({ counts, lastSupportDate, lastChallengeDate }) {
  const supportGap = daysSince(lastSupportDate);
  const challengeGap = daysSince(lastChallengeDate);
  const challengeHeavy =
    counts.challenge >= counts.support + 2 || (counts.challenge > 0 && counts.support === 0);
  const supportHeavy =
    counts.support >= counts.challenge + 3 || (counts.support > 0 && counts.challenge === 0);

  if ((supportGap > 14 && challengeGap <= 7) || (challengeHeavy && supportGap > 10)) {
    return {
      level: 'high',
      message: `Risk of burnout: ${counts.challenge}x challenge vs ${counts.support}x support. Last support ${supportGap === Infinity ? 'never' : `${supportGap}d`} ago; last challenge ${challengeGap === Infinity ? 'never' : `${challengeGap}d`} ago.`,
      supportGap,
      challengeGap,
    };
  }

  if (supportHeavy && challengeGap > 21) {
    return {
      level: 'medium',
      message: `Risk of complacency: ${counts.support}x support and no stretch feedback for ${challengeGap === Infinity ? 'a long time' : `${challengeGap} days`}.`,
      supportGap,
      challengeGap,
    };
  }

  return { level: 'none', message: '', supportGap, challengeGap };
}

function buildStats(interactions = []) {
  const counts = { challenge: 0, support: 0, admin: 0, observation: 0 };
  let lastSupportDate = null;
  let lastChallengeDate = null;
  let lastInteractionDate = null;

  interactions.forEach((interaction) => {
    const tag = normalizeBuckTag(interaction);
    const date = parseDate(interaction.date);
    if (tag === 'support') counts.support += 1;
    else if (tag === 'challenge') counts.challenge += 1;
    else if (tag === 'observation') counts.observation += 1;
    else counts.admin += 1;

    if (date) {
      if (!lastInteractionDate || date > lastInteractionDate) lastInteractionDate = date;
      if (tag === 'support' && (!lastSupportDate || date > lastSupportDate))
        lastSupportDate = date;
      if (tag === 'challenge' && (!lastChallengeDate || date > lastChallengeDate))
        lastChallengeDate = date;
    }
  });

  const total = counts.challenge + counts.support;
  const ratio = total === 0 ? 0.5 : counts.support / total;
  const risk = computeRisk({ counts, lastSupportDate, lastChallengeDate });

  return {
    counts,
    ratio,
    totalInteractions: interactions.length,
    lastSupportDate,
    lastChallengeDate,
    lastInteractionDate,
    risk,
  };
}

export function useBuckBalance(user, staffList = []) {
  const [balanceByStaff, setBalanceByStaff] = useState({});

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription updates local cache */
  useEffect(() => {
    if (!user || !Array.isArray(staffList) || staffList.length === 0) {
      setBalanceByStaff({});
      return undefined;
    }

    const unsubscribers = [];

    staffList.forEach((member) => {
      if (!member?.id) return;
      const ref = collection(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'staff',
        member.id,
        'interactions'
      );
        const q = query(ref, where('uid', '==', user.uid), orderBy('date', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const interactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const stats = buildStats(interactions);
        setBalanceByStaff((prev) => ({
          ...prev,
          [member.id]: { ...stats, staffId: member.id, staffName: member.name || '' },
        }));
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((fn) => fn && fn());
    };
  }, [user, staffList]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const riskFlags = useMemo(() => {
    if (!Array.isArray(staffList)) return [];
    return staffList
      .map((member) => {
        const stats = balanceByStaff[member.id];
        if (!stats || stats.risk.level === 'none') return null;
        return {
          staffId: member.id,
          staffName: member.name,
          role: member.role,
          risk: stats.risk,
          counts: stats.counts,
        };
      })
      .filter(Boolean)
      .sort((a, b) => riskWeight[b.risk.level] - riskWeight[a.risk.level]);
  }, [balanceByStaff, staffList]);

  return { balanceByStaff, riskFlags };
}
