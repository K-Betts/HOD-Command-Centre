// Utility to parse CSV files for weekly timetable
// Expected CSV format:
// Day,StartTime,EndTime,Title,Description,Location
// Monday,09:00,10:00,Maths,Year 11 Maths,Room B12
// Tuesday,10:00,11:00,English,GCSE English,Room A3

export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have header and at least one row');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dayIndex = headers.indexOf('day');
  const startTimeIndex = headers.indexOf('starttime');
  const endTimeIndex = headers.indexOf('endtime');
  const titleIndex = headers.indexOf('title');
  const descriptionIndex = headers.indexOf('description');
  const locationIndex = headers.indexOf('location');

  if (dayIndex === -1 || startTimeIndex === -1 || endTimeIndex === -1 || titleIndex === -1) {
    throw new Error('CSV must include Day, StartTime, EndTime, and Title columns');
  }

  const events = [];
  const dayMap = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5,
    saturday: 6, sunday: 0,
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(',').map(c => c.trim());
    const day = cells[dayIndex]?.toLowerCase() || '';
    const startTime = cells[startTimeIndex] || '';
    const endTime = cells[endTimeIndex] || '';
    const title = cells[titleIndex] || '';
    const description = descriptionIndex !== -1 ? cells[descriptionIndex] : '';
    const location = locationIndex !== -1 ? cells[locationIndex] : '';

    if (!day || !startTime || !endTime || !title) {
      continue; // skip incomplete rows
    }

    // Create a date for this week (use next Monday as base, then calculate day offset)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() + daysUntilMonday);
    baseDate.setHours(0, 0, 0, 0);

    const targetDay = dayMap[day];
    if (targetDay === undefined) continue;

    const eventDate = new Date(baseDate);
    eventDate.setDate(baseDate.getDate() + (targetDay - 1));

    // Parse time
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startDateTime = new Date(eventDate);
    startDateTime.setHours(startHour, startMin, 0, 0);

    const endDateTime = new Date(eventDate);
    endDateTime.setHours(endHour, endMin, 0, 0);

    events.push({
      uid: `csv-${day}-${startTime}-${i}`, // unique per row
      title,
      description,
      location,
      startTime: startDateTime,
      endTime: endDateTime,
    });
  }

  if (events.length === 0) {
    throw new Error('No valid events found in CSV');
  }

  return events;
}
