export function generateFingerprint(data = {}, type = 'task') {
  if (type === 'task') {
    const title = (data.title || '').trim().toLowerCase();
    const dueDate = (data.dueDate || '').toString().slice(0, 10);
    const assignee = (data.assignee || '').trim().toLowerCase();
    const category = (data.category || '').trim().toLowerCase();
    return [title, dueDate, assignee, category].join('|');
  }

  const safe = JSON.stringify(data);
  return safe.toLowerCase();
}
