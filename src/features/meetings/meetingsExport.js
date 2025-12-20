import { groupMeetingsByWeek } from './meetingsUtils';

const escapeHtml = (value = '') =>
  value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMultiline = (value = '') => escapeHtml(value || '').replace(/\n/g, '<br />');

export function exportMeetingsBook(meetings = []) {
  if (typeof window === 'undefined') return;
  const weeks = groupMeetingsByWeek(meetings);
  const style = `
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .archive { max-width: 1000px; margin: 0 auto; }
    .week { margin-bottom: 32px; }
    .week:not(:first-of-type) { page-break-before: always; }
    .week-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
    .week-title { font-size: 16px; font-weight: 700; }
    .week-range { font-size: 12px; color: #475569; }
    .meeting { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06); }
    .meeting-title { font-size: 16px; font-weight: 700; margin: 0 0 4px 0; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 4px; }
    .section-title { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; margin: 10px 0 4px; }
    .body-text { font-size: 14px; line-height: 1.5; color: #0f172a; }
    ul { padding-left: 18px; margin: 6px 0; }
    li { margin-bottom: 4px; font-size: 13px; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; border: 1px solid #cbd5e1; font-size: 11px; color: #0f172a; background: #f8fafc; }
    @media print {
      body { background: #ffffff; }
      .meeting { box-shadow: none; page-break-inside: avoid; }
      .week { page-break-inside: avoid; }
      button { display: none !important; }
    }
  `;

  const content = weeks
    .map(
      (week) => `
      <section class="week">
        <div class="week-header">
          <div class="week-title">${escapeHtml(week.label)}</div>
          <div class="week-range">${escapeHtml(week.rangeLabel || '')}</div>
        </div>
        ${week.meetings
          .map((meeting) => {
            const agendaList = (meeting.agenda || [])
              .map(
                (item, idx) =>
                  `<li><strong>${idx + 1}. ${escapeHtml(item.title || 'Agenda item')}</strong>${
                    item.owner ? ` (${escapeHtml(item.owner)})` : ''
                  }${item.minutes ? ` – ${formatMultiline(item.minutes)}` : ''}</li>`
              )
              .join('');
            const actionsList = (meeting.actions || [])
              .map(
                (action) =>
                  `<li><span class="badge">${action.status === 'done' ? 'Done' : 'Open'}</span> ${escapeHtml(
                    action.task || 'Action'
                  )}${action.owner ? ` — ${escapeHtml(action.owner)}` : ''}${
                    action.dueDate ? ` (Due ${escapeHtml(action.dueDate)})` : ''
                  }</li>`
              )
              .join('');
            return `
              <article class="meeting">
                <h2 class="meeting-title">${escapeHtml(meeting.title || 'Meeting')}</h2>
                <div class="meta">
                  ${escapeHtml(meeting.meetingDate || 'Date TBD')}
                  ${meeting.startTime ? ` • ${escapeHtml(meeting.startTime)}` : ''}
                  ${meeting.location ? ` • ${escapeHtml(meeting.location)}` : ''}
                  ${meeting.type === 'archive' ? ' • Archive' : ''}
                </div>
                <div class="meta">Attendees: ${escapeHtml((meeting.attendees || []).join(', ') || '—')}</div>
                <div class="section-title">Minutes</div>
                <div class="body-text">${formatMultiline(meeting.minutesSummary || 'No minutes summary recorded.')}</div>
                ${agendaList ? `<div class="section-title">Agenda</div><ul>${agendaList}</ul>` : ''}
                ${actionsList ? `<div class="section-title">Actions</div><ul>${actionsList}</ul>` : ''}
              </article>
            `;
          })
          .join('')}
      </section>
    `
    )
    .join('');

  const html = `
    <html>
      <head>
        <title>Meeting Minutes Archive</title>
        <style>${style}</style>
      </head>
      <body>
        <div class="archive">
          ${content}
        </div>
      </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (!win) throw new Error('Blocked by browser');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
