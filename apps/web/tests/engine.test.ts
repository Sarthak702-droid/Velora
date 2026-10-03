import { describe, it, expect } from "vitest";
import { seed, DATE, duration, compatible } from "../src/lib/data";
import {
  availability,
  book,
  join,
  transition,
  estimates,
  checkIn,
  reorder,
} from "../src/lib/engine";
const input = {
  name: "Demo Guest",
  phone: "+65 8123 4567",
  serviceIds: ["haircut"],
  staffId: "ava",
  date: DATE,
  start: 600,
};
describe("shared salon capacity", () => {
  it("combines service duration and buffers", () => {
    expect(duration(["haircut", "spa"])).toBe(120);
    expect(duration(["haircut", "spa"], true)).toBe(135);
  });
  it("shows only compatible professionals", () => {
    expect(compatible(["beard", "facial"])).toHaveLength(0);
    expect(
      availability(seed(), { ...input, serviceIds: ["facial"] }),
    ).toHaveLength(0);
  });
  it("excludes breaks, appointments and out of shift times", () => {
    const slots = availability(seed(), input);
    expect(slots.some((s) => s.start === 780)).toBe(false);
    expect(slots.some((s) => s.start === 840)).toBe(false);
    expect(slots.some((s) => s.start === 600)).toBe(true);
    expect(slots.some((s) => s.start > 1190)).toBe(false);
  });
  it("revalidates a slot to prevent double booking", () => {
    const s = book(seed(), input);
    expect(() => book(s, input)).toThrow("just booked");
  });
  it("reschedules by releasing old capacity", () => {
    const s = book(seed(), input);
    const a = s.appointments.at(-1)!;
    const next = book(s, { ...input, start: 1140 }, a.id);
    expect(next.appointments.filter((x) => x.id === a.id)).toHaveLength(1);
    expect(availability(next, input).some((s) => s.start === 600)).toBe(true);
  });
  it("assigns any available to a compatible professional", () => {
    const s = book(seed(), { ...input, staffId: "any" });
    expect(compatible(input.serviceIds).map((p) => p.id)).toContain(
      s.appointments.at(-1)!.staffId,
    );
  });
  it("checks a booking into the queue only once", () => {
    const s = checkIn(seed(), "appointment-1");
    expect(s.queue.at(-1)?.appointmentId).toBe("appointment-1");
    expect(() => checkIn(s, "appointment-1")).toThrow();
  });
  it("generates unique tokens and updates ETA after completion", () => {
    const original = seed();
    const added = join(original, { ...input, staffId: "rohan" });
    expect(added.queue.at(-1)?.token).toBe("A024");
    expect(join(added, input).queue.at(-1)?.token).toBe("A025");
    const next = transition(original, "active-1", "COMPLETED");
    expect(estimates(next)["queue-1"].eta).toBeLessThan(
      estimates(original)["queue-1"].eta,
    );
  });
  it("rejects invalid transitions and busy staff starts", () => {
    expect(() => transition(seed(), "queue-0", "COMPLETED")).toThrow();
    let s = transition(seed(), "queue-0", "CALLED");
    s = transition(s, "queue-0", "CHECKED_IN");
    expect(() => transition(s, "queue-0", "IN_SERVICE")).toThrow("serving");
  });
  it("requires and audits a manual reorder reason", () => {
    expect(() => reorder(seed(), "queue-5", 1, "")).toThrow("reason");
    const s = reorder(seed(), "queue-5", 1, "Guest returned");
    expect(s.queue.filter((q) => q.status === "WAITING")[0].id).toBe("queue-5");
    expect(s.audit.at(-1)?.reason).toBe("Guest returned");
  });
  it("refuses dates before the reference clock", () =>
    expect(availability(seed(), { ...input, date: "2025-04-15" })).toHaveLength(
      0,
    ));
});
