const ENERGY_OPTIONS = ['High Focus', 'Low Energy/Admin'];
const TIME_OPTIONS = ['5 min', '15 min', '30 min', '1 hr+'];

function containsAny(text = '', keywords = []) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function deriveEnergyLevel(task = {}) {
  if (task.energyLevel) return task.energyLevel;
  const category = (task.category || '').toLowerCase();
  const text = `${task.title || ''} ${task.summary || ''}`.toLowerCase();

  if (category.includes('admin') || containsAny(text, ['email', 'invite', 'form', 'register'])) {
    return 'Low Energy/Admin';
  }
  if (
    containsAny(text, [
      'strategy',
      'strategic',
      'curriculum',
      'plan',
      'draft',
      'design',
      'analysis',
      'data',
    ])
  ) {
    return 'High Focus';
  }
  return 'High Focus';
}

function deriveEstimatedTime(task = {}) {
  if (task.estimatedTime) return task.estimatedTime;

  const minutes = Number(task.estimatedMinutes);
  if (!Number.isNaN(minutes) && minutes > 0) {
    if (minutes <= 5) return '5 min';
    if (minutes <= 15) return '15 min';
    if (minutes <= 30) return '30 min';
    return '1 hr+';
  }

  const text = `${task.title || ''} ${task.summary || ''}`.toLowerCase();
  if (containsAny(text, ['email', 'reply', 'send to', 'nudge'])) return '5 min';
  if (containsAny(text, ['call', 'follow up', 'chase'])) return '15 min';
  if (containsAny(text, ['review', 'mark', 'feedback'])) return '30 min';
  if (containsAny(text, ['draft', 'write', 'strategy', 'curriculum'])) return '1 hr+';

  return '';
}

function deriveIsWeeklyWin(task = {}) {
  if (typeof task.isWeeklyWin === 'boolean') return task.isWeeklyWin;

  const category = (task.category || '').toLowerCase();
  const hasStrategyLink = Boolean(task.themeTag || task.strategyId || task.projectId);
  const highImpactKeywords = ['strategy', 'curriculum', 'scheme', 'plan', 'project', 'milestone'];
  const text = `${task.title || ''} ${task.summary || ''}`.toLowerCase();
  const energy = deriveEnergyLevel(task);

  if (category.includes('strategic') || hasStrategyLink) return true;
  if (containsAny(text, highImpactKeywords) && energy === 'High Focus') return true;
  if ((task.priority || '').toLowerCase() === 'high' && energy === 'High Focus') return true;
  return false;
}

export function applyContextTags(task = {}) {
  const energyLevel = task.energyLevel || deriveEnergyLevel(task);
  const estimatedTime = task.estimatedTime || deriveEstimatedTime(task);
  const isWeeklyWin =
    typeof task.isWeeklyWin === 'boolean'
      ? task.isWeeklyWin
      : deriveIsWeeklyWin({ ...task, energyLevel, estimatedTime });

  return { ...task, energyLevel, estimatedTime, isWeeklyWin };
}

export { ENERGY_OPTIONS, TIME_OPTIONS };
