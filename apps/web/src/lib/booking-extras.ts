import type { Appointment, Branch, Service, Slot } from "./api-client";

export type TimePreference = "any" | "morning" | "afternoon" | "evening";
export function matchesTime(time: string, preference: TimePreference) {
  const hour = Number(time.split(":")[0]);
  return (
    preference === "any" ||
    (preference === "morning"
      ? hour < 12
      : preference === "afternoon"
        ? hour >= 12 && hour < 17
        : hour >= 17)
  );
}
export function filterServices(
  services: Service[],
  selected: string[],
  filters: { category: string; budget: string; minutes: string },
) {
  return services.filter(
    (s) =>
      selected.includes(s.id) ||
      ((!filters.category || s.categoryId === filters.category) &&
        (!filters.budget || s.price <= Number(filters.budget)) &&
        (!filters.minutes || s.duration <= Number(filters.minutes))),
  );
}
export async function earliestAvailability(
  date: string,
  preference: TimePreference,
  load: (date: string) => Promise<Slot[]>,
) {
  // Calendar arithmetic is independent of the browser timezone; the API interprets
  // each date in the selected branch's timezone.
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(`${date}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    const candidate = day.toISOString().slice(0, 10);
    const available = (await load(candidate))
      .filter((s) => matchesTime(s.time, preference))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (available[0]) return { date: candidate, slot: available[0] };
  }
  return null;
}
function utc(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function fold(line: string) {
  const encoder = new TextEncoder();
  let current = "",
    result = "";
  for (const char of line) {
    if (encoder.encode(current + char).length > 75) {
      result += current + "\r\n";
      current = " ";
    }
    current += char;
  }
  return result + current;
}
function eventDetails(a: Appointment, b: Branch) {
  return {
    title: `Velora · ${a.services.map((v) => v.service.name).join(" + ")}`,
    location: `${b.name}, ${b.address}, ${b.city}`,
    description:
      "Salon appointment. Contact the salon to discuss your visit. Calendar reminders are managed by your calendar app.",
  };
}
export function calendarFile(a: Appointment, b: Branch, now = new Date()) {
  const event = eventDetails(a, b);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Velora//Appointments//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${escapeText(a.id)}@velora.local`,
      `DTSTAMP:${utc(now.toISOString())}`,
      `DTSTART:${utc(a.startTime)}`,
      `DTEND:${utc(a.endTime)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `LOCATION:${escapeText(event.location)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
export function googleCalendarUrl(a: Appointment, b: Branch) {
  const event = eventDetails(a, b);
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${utc(a.startTime)}/${utc(a.endTime)}`, details: event.description, location: event.location, ctz: b.timezone })}`;
}

export function surpriseService(
  services: Service[],
  selected: string[],
  filters: { category: string; budget: string; minutes: string },
  qualifies: (ids: string[]) => boolean,
  previous?: string,
  random = Math.random,
) {
  const candidates = filterServices(services, [], filters).filter(
    (s) => !selected.includes(s.id) && qualifies([...selected, s.id]),
  );
  const fresh = candidates.filter((s) => s.id !== previous);
  const options = fresh.length ? fresh : candidates;
  return (
    options[
      Math.min(options.length - 1, Math.floor(random() * options.length))
    ] || null
  );
}
export function departurePlan(
  updatedAt: number,
  waitMinutes: number,
  travelMinutes: number,
  bufferMinutes: number,
  now = Date.now(),
) {
  const expectedAt = updatedAt + Math.max(0, waitMinutes) * 60000;
  const leaveAt =
    expectedAt -
    (Math.max(0, travelMinutes) + Math.max(0, bufferMinutes)) * 60000;
  return { expectedAt, leaveAt, leaveNow: leaveAt <= now };
}
