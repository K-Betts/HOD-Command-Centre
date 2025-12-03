function fallbackId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createPriorityId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return fallbackId();
}

export function normalizeInitials(value = '') {
  return value
    .toString()
    .replace(/[^a-z]/gi, '')
    .toUpperCase();
}

function initialsFromName(name = '') {
  const parts = name
    .toString()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  return parts.map((p) => p[0]).join('').toUpperCase();
}

function deriveUserInitials(user) {
  const fromName = initialsFromName(user?.displayName || '');
  if (fromName) return fromName;
  const emailPrefix = (user?.email || '').split('@')[0] || '';
  return normalizeInitials(emailPrefix).slice(0, 3);
}

function normalizeRag(value) {
  const raw = (value || '').toString().trim().toLowerCase();
  if (['g', 'green', 'on-track', 'on track'].includes(raw)) return 'Green';
  if (['a', 'amber', 'mid', 'watch'].includes(raw)) return 'Amber';
  if (['r', 'red', 'off-track', 'off track'].includes(raw)) return 'Red';
  return 'Amber';
}

function parseDateCandidate(input) {
  if (!input) return null;
  const cleaned = input
    .toString()
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) return direct;

  const withYear = `${cleaned} ${new Date().getFullYear()}`;
  const retry = new Date(withYear);
  if (!Number.isNaN(retry.getTime())) return retry;
  return null;
}

function toIsoDay(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const now = new Date();
  if (year < now.getFullYear() - 1) {
    date.setFullYear(now.getFullYear());
  }
  if (date < now) {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export function parseReviewMeta(raw) {
  const rawReview = (raw || '').toString().trim();
  const lower = rawReview.toLowerCase();
  let reviewFrequency = '';
  if (lower.includes('week')) reviewFrequency = 'Weekly';
  else if (lower.includes('fortnight')) reviewFrequency = 'Fortnightly';
  else if (lower.includes('month')) reviewFrequency = 'Monthly';
  else if (lower.includes('term')) reviewFrequency = 'Termly';
  else if (lower.includes('half')) reviewFrequency = 'Half-termly';
  else if (lower.includes('daily')) reviewFrequency = 'Daily';

  const parsed = parseDateCandidate(rawReview);
  const reviewDate = parsed ? toIsoDay(parsed) : null;

  return { reviewDate, reviewFrequency, rawReview };
}

function frequencyDays(freq = '') {
  const key = freq.toLowerCase();
  if (key === 'weekly') return 7;
  if (key === 'fortnightly') return 14;
  if (key === 'monthly') return 30;
  if (key === 'termly') return 90;
  if (key === 'half-termly') return 42;
  if (key === 'daily') return 1;
  return null;
}

export function getNextReviewDate(priority = {}, now = new Date()) {
  const base = priority.reviewDate ? new Date(priority.reviewDate) : null;
  const freqDays = frequencyDays(priority.reviewFrequency || '');
  if (base && !Number.isNaN(base.getTime())) {
    if (freqDays) {
      while (base < now) {
        base.setDate(base.getDate() + freqDays);
      }
    }
    return base;
  }

  if (freqDays) {
    const next = new Date(now);
    next.setDate(next.getDate() + freqDays);
    return next;
  }

  return null;
}

export function isPriorityDueSoon(priority = {}, days = 7, now = new Date()) {
  const next = getNextReviewDate(priority, now);
  if (!next) return false;
  const msDiff = next.getTime() - now.getTime();
  const daysDiff = msDiff / (1000 * 60 * 60 * 24);
  return daysDiff <= days;
}

function matchLeadToStaff(leadRaw, staff = [], user) {
  const normalizedLead = normalizeInitials(leadRaw);
  const leadLower = (leadRaw || '').toString().trim().toLowerCase();
  const userInitials = deriveUserInitials(user);

  if (!normalizedLead && ['team', 'whole team', 'all'].includes(leadLower)) {
    return {
      isWholeTeam: true,
      leadInitials: 'TEAM',
      leadName: 'Whole Team',
      assignmentType: 'TEAM_GOAL',
    };
  }

  if (normalizedLead && userInitials && userInitials.startsWith(normalizedLead)) {
    return {
      isWholeTeam: true,
      leadInitials: userInitials,
      leadName: user?.displayName || 'You',
      assignmentType: 'TEAM_GOAL',
    };
  }

  const match =
    staff.find(
      (s) =>
        normalizeInitials(s.initials) === normalizedLead ||
        initialsFromName(s.name || '').startsWith(normalizedLead)
    ) || null;

  if (match) {
    return {
      leadStaffId: match.id,
      leadName: match.name,
      leadInitials: match.initials || normalizedLead,
      isWholeTeam: false,
      assignmentType: 'INDIVIDUAL',
    };
  }

  return {
    leadName: leadRaw || '',
    leadInitials: normalizedLead || leadLower.toUpperCase(),
    isWholeTeam: false,
    assignmentType: normalizedLead ? 'INDIVIDUAL' : 'UNASSIGNED',
  };
}

export function enrichPriorityFromImport(raw = {}, staff = [], user) {
  const meta = parseReviewMeta(
    raw.reviewDate || raw.review || raw.reviewWhen || raw.frequency || raw.reviewFrequency
  );
  const lead = matchLeadToStaff(raw.lead || raw.owner || raw.ragOwner || '', staff, user);
  return {
    id: raw.id || createPriorityId(),
    vision: raw.vision || raw.visionStatement || '',
    objective: raw.objective || raw.objectiveStatement || raw.goal || '',
    action: raw.action || raw.actionStep || raw.actionPlan || raw.title || '',
    evidence: raw.evidence || raw.successCriteria || raw.measure || '',
    rag: normalizeRag(raw.rag),
    reviewDate: meta.reviewDate,
    reviewFrequency: meta.reviewFrequency,
    rawReview: meta.rawReview,
    leadRaw: raw.lead || raw.owner || '',
    ...lead,
  };
}
