// Utility to parse ICS files and extract events
import ICAL from 'ical.js';

export function parseICS(icsText) {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents('vevent');
  return vevents.map(event => {
    const e = new ICAL.Event(event);
    return {
      uid: e.uid,
      title: e.summary,
      description: e.description,
      location: e.location,
      startTime: e.startDate.toJSDate(),
      endTime: e.endDate.toJSDate(),
    };
  });
}
