
/**
 * Creates an optimized context for AI processing by minimizing the data payload.
 * This helps prevent rate-limiting errors (429) by reducing the size of the request,
 * while still providing enough information for the AI to perform its tasks, such as task assignment.
 *
 * @param {Array<Object>} tasks - The full list of task objects.
 * @param {Array<Object>} staff - The full list of staff member objects.
 * @param {Array<Object>} events - The list of calendar events.
 * @returns {Object} An object containing minimized arrays for tasks, staff, and events.
 */
export const getOptimizedContext = (tasks = [], staff = [], events = []) => {
  // 1. "Diet" Tasks: Return only the titles of active tasks.
  // This is used for de-duplication and context, without the overhead of full task objects.
  const existingTaskTitles = tasks
    .filter(task => task.status !== 'completed')
    .map(task => task.title);

  // 2. "Diet" Staff: Return a lightweight directory of staff members.
  // Includes name, ID, and role, which is crucial for the AI to assign tasks correctly.
  // Excludes heavy data like interaction logs, history, etc.
  const staffDirectory = staff.map(s => ({
    name: s.name,
    id: s.id,
    role: s.role,
  }));

  // 3. "Diet" Events: Return only the titles of today's and tomorrow's events.
  // Provides immediate context without the bulk of the entire schedule.
  const todayEvents = events.map(event => event.title);

  return {
    existingTaskTitles,
    staffDirectory,
    todayEvents,
  };
};
