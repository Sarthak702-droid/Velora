import type { BookingInput, DemoService, DemoState } from "@velora/types";
import { availability, book, join } from "./engine";
/** Synchronous demo boundary; replace with a tenant-scoped /api/v1 adapter in production. */
export function createDemoService(
  read: () => DemoState,
  commit: (next: DemoState) => void,
): DemoService {
  return {
    getState: read,
    availability: (input, excludeId) => availability(read(), input, excludeId),
    book: (input: BookingInput) => {
      const next = book(read(), input);
      commit(next);
      return next.appointments[next.appointments.length - 1];
    },
    join: (input) => {
      const next = join(read(), input);
      commit(next);
      return next.queue[next.queue.length - 1];
    },
  };
}
