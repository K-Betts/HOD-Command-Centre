import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { useScheduleEvents } from './useScheduleEvents';
import { useStrategy } from './useStrategy';
import { useBudget } from './useBudget';
import { differenceInCalendarWeeks, isWithinInterval, addWeeks } from 'date-fns';

/**
 * Aggregates data from across the app (tasks, events, priorities, budget)
 * and organizes it by week within a term for the Department Calendar
 */
export function useDepartmentCalendarData(user, selectedTerm, currentAcademicYear) {
  const { tasks = [] } = useTasks(user);
  const { events = [] } = useScheduleEvents(user);
  const { plan = {} } = useStrategy(user);
  const { expenses = [] } = useBudget(user);

  const weeklyData = useMemo(() => {
    if (!selectedTerm || !selectedTerm.start || !selectedTerm.end) {
      return [];
    }

    const termStart = new Date(selectedTerm.start);
    const termEnd = new Date(selectedTerm.end);
    const weeksCount = Math.max(1, differenceInCalendarWeeks(termEnd, termStart) + 1);

    const weeks = [];

    for (let i = 1; i <= weeksCount; i++) {
      const weekStart = addWeeks(termStart, i - 1);
      const weekEnd = addWeeks(weekStart, 1);

      // Filter data for this week
      const weekTasks = tasks.filter((t) => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        return isWithinInterval(dueDate, { start: weekStart, end: weekEnd });
      });

      const weekEvents = events.filter((e) => {
        const eventDate = e.startTime ? new Date(e.startTime) : e.eventDate ? new Date(e.eventDate) : null;
        if (!eventDate) return false;
        return isWithinInterval(eventDate, { start: weekStart, end: weekEnd });
      });

      const weekExpenses = expenses.filter((e) => {
        if (!e.date) return false;
        const expenseDate = new Date(e.date);
        return isWithinInterval(expenseDate, { start: weekStart, end: weekEnd });
      });

      // Extract auto-fill data
      weeks.push({
        weekNumber: i,
        weekStart,
        weekEnd,
        autoFilledData: {
          keyEvents: extractKeyEvents(weekEvents),
          assessments: extractAssessments(weekTasks),
          deadlines: extractDeadlines(weekTasks),
          cpdFocus: extractCpdFocus(weekEvents, weekTasks),
          qaFocus: extractQaFocus(plan),
          deptTime: extractDeptTime(weekEvents),
          budgetNotes: extractBudgetNotes(weekExpenses),
        },
      });
    }

    return weeks;
  }, [selectedTerm, tasks, events, plan, expenses, currentAcademicYear]);

  return weeklyData;
}

function extractKeyEvents(events) {
  const keyEventTypes = ['Staff Meeting', 'Department Meeting', 'CPD', 'Trip', 'Exam', 'Parents Evening', 'Special Event'];
  return events
    .filter((e) => keyEventTypes.some((type) => (e.title || '').includes(type)) || e.type === 'Meeting')
    .map((e) => e.title || e.event || 'Event')
    .join('; ');
}

function extractAssessments(tasks) {
  return tasks
    .filter((t) => (t.category || '').toLowerCase().includes('assess') || (t.title || '').toLowerCase().includes('assess'))
    .map((t) => t.title || 'Assessment')
    .join('; ');
}

function extractDeadlines(tasks) {
  return tasks
    .filter((t) => t.status !== 'done')
    .map((t) => t.title || 'Deadline')
    .join('; ');
}

function extractCpdFocus(events, tasks) {
  const cpdEvents = events.filter((e) => (e.title || '').toLowerCase().includes('cpd'));
  const cpdTasks = tasks.filter((t) => (t.category || '').toLowerCase().includes('cpd'));
  const items = [
    ...cpdEvents.map((e) => e.title || 'CPD Event'),
    ...cpdTasks.map((t) => t.title || 'CPD Task'),
  ];
  return items.slice(0, 3).join('; ');
}

function extractQaFocus(plan = {}) {
  // Get QA-related priorities from strategy plan
  const qaItems = (plan.priorities || [])
    .filter((p) => (p.objective || '').toLowerCase().includes('quality') || (p.objective || '').toLowerCase().includes('qa'))
    .map((p) => p.objective || p.action || 'QA Focus')
    .slice(0, 2);
  return qaItems.join('; ');
}

function extractDeptTime(events) {
  const deptMeetings = events
    .filter((e) => (e.title || '').toLowerCase().includes('department') || (e.title || '').toLowerCase().includes('dept'))
    .map((e) => e.title || 'Department Time')
    .slice(0, 2);
  return deptMeetings.join('; ');
}

function extractBudgetNotes(expenses) {
  return expenses
    .map((e) => `${e.item || 'Expense'}: ${e.amount || e.aedAmount || '0'}`)
    .slice(0, 2)
    .join('; ');
}
