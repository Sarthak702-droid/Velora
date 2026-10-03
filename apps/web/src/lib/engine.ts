import type {
  BookingInput,
  DemoState,
  QueueEntry,
  QueueStatus,
  Slot,
} from "@velora/types";
import {
  CONTEXT,
  DATE,
  STAFF,
  config,
  compatible,
  duration,
  seed,
} from "./data";
export function availability(
  state: DemoState,
  input: Pick<BookingInput, "date" | "serviceIds" | "staffId">,
  excludeId?: string,
): Slot[] {
  if (!input.serviceIds.length || input.date < DATE) return [];
  const total = duration(input.serviceIds, true);
  const staff = compatible(input.serviceIds).filter(
    (s) => input.staffId === "any" || s.id === input.staffId,
  );
  const slots: Slot[] = [];
  for (let start = config.open; start + total <= config.close; start += 30) {
    const person = staff.find((s) => {
      if (start < s.shift[0] || start + total > s.shift[1]) return false;
      const blocks = [
        ...s.breaks,
        ...state.appointments
          .filter(
            (a) =>
              a.tenantId === CONTEXT.tenantId &&
              a.branchId === CONTEXT.branchId &&
              a.id !== excludeId &&
              a.date === input.date &&
              a.staffId === s.id &&
              !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status),
          )
          .map(
            (a) =>
              [a.start, a.start + duration(a.serviceIds, true)] as [
                number,
                number,
              ],
          ),
      ];
      if (input.date === DATE) {
        const active = state.queue.filter(
          (q) => q.staffId === s.id && q.status === "IN_SERVICE",
        );
        if (active.length)
          blocks.push([
            540,
            540 +
              active.reduce(
                (n, q) => n + (q.remaining ?? duration(q.serviceIds, true)),
                0,
              ),
          ]);
      }
      return !blocks.some(([from, to]) => start < to && start + total > from);
    });
    if (person) slots.push({ start, staffId: person.id });
  }
  return slots;
}
export function book(
  state: DemoState,
  input: BookingInput,
  excludeId?: string,
) {
  const slot = availability(state, input, excludeId).find(
    (s) => s.start === input.start,
  );
  if (!slot)
    throw Error(
      "That slot was just booked. Please choose another available time.",
    );
  const visit = {
    ...CONTEXT,
    ...input,
    staffId: slot.staffId,
    id: excludeId ?? crypto.randomUUID(),
    status: "CONFIRMED" as const,
  };
  return {
    ...state,
    appointments: [
      ...state.appointments.filter((a) => a.id !== excludeId),
      visit,
    ],
    audit: [
      ...state.audit,
      {
        id: crypto.randomUUID(),
        action: excludeId ? "BOOKING_RESCHEDULED" : "BOOKING_CREATED",
        entityId: visit.id,
        at: new Date().toISOString(),
      },
    ],
  };
}
const waiting = (q: QueueEntry) =>
  ["WAITING", "CALLED", "CHECKED_IN"].includes(q.status);
export function estimates(state: DemoState) {
  const ready = Object.fromEntries(
    STAFF.map((s) => [
      s.id,
      state.queue
        .filter((q) => q.staffId === s.id && q.status === "IN_SERVICE")
        .reduce((n, q) => n + (q.remaining ?? duration(q.serviceIds, true)), 0),
    ]),
  );
  const result: Record<
    string,
    { eta: number; ahead: number; staffId: string }
  > = {};
  const counts: Record<string, number> = {};
  state.queue.filter(waiting).forEach((q) => {
    const candidates = compatible(q.serviceIds)
      .filter((s) => q.staffId === "any" || q.staffId === s.id)
      .sort((a, b) => ready[a.id] - ready[b.id]);
    const s = candidates[0];
    if (!s) {
      result[q.id] = { eta: 0, ahead: 0, staffId: "" };
      return;
    }
    let start = ready[s.id];
    const total = duration(q.serviceIds, true);
    const reserved = state.appointments
      .filter(
        (a) =>
          a.date === DATE && a.staffId === s.id && a.status === "CONFIRMED",
      )
      .map((a) => [
        a.start - 540,
        a.start - 540 + duration(a.serviceIds, true),
      ]);
    for (const [from, to] of [
      ...s.breaks.map(([a, b]) => [a - 540, b - 540]),
      ...reserved,
    ].sort((a, b) => a[0] - b[0]))
      if (start < to && start + total > from) start = to;
    result[q.id] = { eta: start, ahead: counts[s.id] ?? 0, staffId: s.id };
    ready[s.id] = start + total;
    counts[s.id] = (counts[s.id] ?? 0) + 1;
  });
  return result;
}
export function join(
  state: DemoState,
  input: Omit<BookingInput, "date" | "start">,
) {
  if (
    !input.serviceIds.length ||
    !compatible(input.serviceIds).some(
      (s) => input.staffId === "any" || s.id === input.staffId,
    )
  )
    throw Error("Choose compatible services and a professional.");
  const entry: QueueEntry = {
    ...CONTEXT,
    ...input,
    id: crypto.randomUUID(),
    token: "A" + String(state.nextToken).padStart(3, "0"),
    status: "WAITING",
    joined: Date.now(),
  };
  return {
    ...state,
    nextToken: state.nextToken + 1,
    queue: [...state.queue, entry],
    notices: [
      ...state.notices,
      {
        id: crypto.randomUUID(),
        entryId: entry.id,
        title: "Queue Confirmed",
        body: `You’re now in the queue. Token ${entry.token}.`,
        time: "Just now",
      },
    ],
  };
}
export const transitions: Record<QueueStatus, QueueStatus[]> = {
  WAITING: ["CALLED", "CHECKED_IN", "SKIPPED", "CANCELLED", "LEFT"],
  CALLED: ["CHECKED_IN", "IN_SERVICE", "SKIPPED", "LEFT"],
  CHECKED_IN: ["CALLED", "IN_SERVICE", "CANCELLED"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  SKIPPED: ["WAITING", "LEFT"],
  CANCELLED: [],
  LEFT: [],
};
export function transition(state: DemoState, id: string, status: QueueStatus) {
  const entry = state.queue.find((q) => q.id === id);
  if (!entry || !transitions[entry.status].includes(status))
    throw Error("This queue transition is not available.");
  const assigned =
    entry.staffId === "any" ? estimates(state)[id]?.staffId : entry.staffId;
  if (
    status === "IN_SERVICE" &&
    state.queue.some(
      (q) => q.id !== id && q.staffId === assigned && q.status === "IN_SERVICE",
    )
  )
    throw Error(
      "This professional is serving another guest. Complete that service first.",
    );
  const queue = state.queue.map((q) =>
    q.id === id ? { ...q, status, staffId: assigned ?? q.staffId } : q,
  );
  const appointments = state.appointments.map((a) =>
    a.id === entry.appointmentId
      ? {
          ...a,
          status:
            status === "IN_SERVICE"
              ? ("IN_SERVICE" as const)
              : status === "COMPLETED"
                ? ("COMPLETED" as const)
                : a.status,
        }
      : a,
  );
  const updated = { ...state, queue, appointments };
  const etas = estimates(updated);
  return {
    ...updated,
    audit: [
      ...state.audit,
      {
        id: crypto.randomUUID(),
        action: status,
        entityId: id,
        at: new Date().toISOString(),
      },
    ],
    notices: [
      ...state.notices,
      {
        id: crypto.randomUUID(),
        entryId: id,
        title:
          status === "CALLED" ? "It’s Your Turn!" : status.replaceAll("_", " "),
        body:
          status === "CALLED"
            ? "Please proceed to the front desk."
            : "Your queue status has been updated.",
        time: "Just now",
      },
      ...queue
        .filter(waiting)
        .map((q) => ({
          id: crypto.randomUUID(),
          entryId: q.id,
          title: "Queue Updated",
          body: `${etas[q.id]?.ahead ?? 0} guests ahead. Estimated wait: ${etas[q.id]?.eta ?? 0} minutes.`,
          time: "Just now",
        })),
    ].slice(-100),
  };
}
export function checkIn(state: DemoState, id: string) {
  const a = state.appointments.find((a) => a.id === id);
  if (!a || a.status !== "CONFIRMED")
    throw Error("Appointment is already checked in.");
  const q = join(state, {
    name: a.name,
    phone: a.phone,
    serviceIds: a.serviceIds,
    staffId: a.staffId,
  });
  const last = q.queue[q.queue.length - 1];
  return {
    ...q,
    appointments: q.appointments.map((x) =>
      x.id === id ? { ...x, status: "CHECKED_IN" as const } : x,
    ),
    queue: q.queue.map((x) =>
      x.id === last.id
        ? { ...x, appointmentId: id, status: "CHECKED_IN" as const }
        : x,
    ),
  };
}
export function reorder(
  state: DemoState,
  id: string,
  position: number,
  reason: string,
) {
  if (!reason.trim()) throw Error("Enter a reason for changing the queue.");
  const list = state.queue.filter(waiting);
  const item = list.find((q) => q.id === id);
  if (!item) return state;
  const rest = list.filter((q) => q.id !== id);
  rest.splice(Math.max(0, Math.min(rest.length, position - 1)), 0, item);
  return {
    ...state,
    queue: [...state.queue.filter((q) => !waiting(q)), ...rest],
    audit: [
      ...state.audit,
      {
        id: crypto.randomUUID(),
        action: "QUEUE_POSITION_CHANGED",
        entityId: id,
        reason,
        at: new Date().toISOString(),
      },
    ],
  };
}
export const initialState = seed;
