import { describe, expect, it } from "vitest";
import {
  earliestAvailability,
  filterServices,
  matchesTime,
  calendarFile,
  googleCalendarUrl,
  surpriseService,
  departurePlan,
} from "../src/lib/booking-extras";
import type { Appointment, Branch, Service, Slot } from "../src/lib/api-client";
const services = [
  { id: "cut", categoryId: "hair", price: 650, duration: 35 },
  { id: "spa", categoryId: "hair", price: 1000, duration: 60 },
  { id: "facial", categoryId: "skin", price: 900, duration: 45 },
] as Service[];
const slot = (time: string, date: string) =>
  ({
    time,
    timestamp: `${date}T${time}:00Z`,
    staffId: "stylist",
    staffName: "Stylist",
  }) as Slot;
const branch = {
  name: "Branch, Central",
  address: "12 Road; Level 2",
  city: "Mumbai",
  timezone: "Asia/Kolkata",
} as Branch;
const appointment = {
  id: "booking-id",
  startTime: "2026-10-08T04:30:00Z",
  endTime: "2026-10-08T05:05:00Z",
  services: [{ service: { name: "Cut, Style\nConsultation" } }],
  customer: { name: "PRIVATE NAME", phone: "PRIVATE PHONE" },
} as Appointment;
describe("booking extras", () => {
  it("filters by price, duration and category while retaining selected services", () => {
    expect(
      filterServices(services, [], {
        category: "hair",
        budget: "700",
        minutes: "40",
      }).map((s) => s.id),
    ).toEqual(["cut"]);
    expect(
      filterServices(services, ["spa"], {
        category: "skin",
        budget: "1",
        minutes: "1",
      }).map((s) => s.id),
    ).toEqual(["spa"]);
  });
  it("uses non-overlapping morning, afternoon and evening boundaries", () => {
    expect(matchesTime("11:45", "morning")).toBe(true);
    expect(matchesTime("12:00", "morning")).toBe(false);
    expect(matchesTime("12:00", "afternoon")).toBe(true);
    expect(matchesTime("17:00", "afternoon")).toBe(false);
    expect(matchesTime("17:00", "evening")).toBe(true);
  });
  it("searches calendar days across month boundaries and selects the earliest matching time", async () => {
    const calls: string[] = [];
    const result = await earliestAvailability(
      "2026-10-31",
      "afternoon",
      async (date) => {
        calls.push(date);
        return date === "2026-11-01"
          ? [slot("17:00", date), slot("14:00", date), slot("13:00", date)]
          : [slot("09:00", date)];
      },
    );
    expect(calls).toEqual(["2026-10-31", "2026-11-01"]);
    expect(result?.slot.time).toBe("13:00");
  });
  it("limits empty searches to seven days and surfaces backend failures", async () => {
    let count = 0;
    expect(
      await earliestAvailability("2026-10-03", "any", async () => {
        count++;
        return [];
      }),
    ).toBeNull();
    expect(count).toBe(7);
    await expect(
      earliestAvailability("2026-10-03", "any", async () => {
        throw Error("API unavailable");
      }),
    ).rejects.toThrow("API unavailable");
  });
  it("exports actual UTC start/end, escapes text and omits private customer data", () => {
    const file = calendarFile(
      appointment,
      branch,
      new Date("2026-10-03T00:00:00Z"),
    );
    expect(file).toContain(
      "DTSTART:20261008T043000Z\r\nDTEND:20261008T050500Z",
    );
    expect(file).toContain("Cut\\, Style\\nConsultation");
    expect(file).toContain("12 Road\\; Level 2");
    expect(file).not.toContain("PRIVATE");
    const url = new URL(googleCalendarUrl(appointment, branch));
    expect(url.searchParams.get("dates")).toBe(
      "20261008T043000Z/20261008T050500Z",
    );
    expect(url.searchParams.get("ctz")).toBe("Asia/Kolkata");
    expect(url.href).not.toContain("PRIVATE");
  });
  it("folds Unicode calendar lines at 75 UTF-8 bytes without breaking characters", () => {
    const file = calendarFile(
      {
        ...appointment,
        services: [{ service: { name: "美容".repeat(70) } }],
      } as Appointment,
      branch,
    );
    expect(
      file
        .split("\r\n")
        .every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
    expect(file.replace(/\r\n /g, "")).toContain("美容".repeat(70));
  });
});

describe("personal booking helpers", () => {
  it("surprises within filters and compatible service combinations, avoids repeats", () => {
    const filters = { category: "hair", budget: "1100", minutes: "70" };
    expect(
      surpriseService(
        services,
        [],
        filters,
        () => true,
        undefined,
        () => 0,
      )?.id,
    ).toBe("cut");
    expect(
      surpriseService(
        services,
        [],
        filters,
        () => true,
        "cut",
        () => 0,
      )?.id,
    ).toBe("spa");
    expect(
      surpriseService(
        services,
        ["cut"],
        filters,
        (ids) => !ids.includes("spa"),
      ),
    ).toBeNull();
    expect(
      surpriseService(services, [], { ...filters, budget: "1" }, () => true),
    ).toBeNull();
  });
  it("plans departure using the live snapshot and handles zero/elapsed waits", () => {
    const base = Date.parse("2026-10-03T10:00:00Z");
    const plan = departurePlan(base, 40, 15, 5, base);
    expect(plan.leaveAt).toBe(base + 20 * 60000);
    expect(plan.expectedAt).toBe(base + 40 * 60000);
    expect(plan.leaveNow).toBe(false);
    expect(departurePlan(base, 5, 15, 5, base).leaveNow).toBe(true);
    expect(departurePlan(base, 0, 0, 0, base).leaveNow).toBe(true);
    expect(departurePlan(base, 40, 15, 5, base + 25 * 60000).leaveNow).toBe(
      true,
    );
  });
});
