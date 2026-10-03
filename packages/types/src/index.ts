export type Context = { tenantId: string; branchId: string };
export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  buffer: number;
  price: number;
  image: string;
};
export type Professional = {
  id: string;
  name: string;
  title: string;
  image: string;
  rating: number;
  reviews: number;
  services: string[];
  shift: [number, number];
  breaks: [number, number][];
};
export type AppointmentStatus =
  | "CONFIRMED"
  | "CHECKED_IN"
  | "WAITING"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
export type QueueStatus =
  | "WAITING"
  | "CALLED"
  | "CHECKED_IN"
  | "IN_SERVICE"
  | "COMPLETED"
  | "SKIPPED"
  | "CANCELLED"
  | "LEFT";
export type Visit = Context & {
  id: string;
  name: string;
  phone: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  start: number;
  status: AppointmentStatus;
};
export type QueueEntry = Context & {
  id: string;
  token: string;
  name: string;
  phone: string;
  serviceIds: string[];
  staffId: string;
  status: QueueStatus;
  joined: number;
  remaining?: number;
  appointmentId?: string;
};
export type Notice = {
  id: string;
  entryId: string;
  title: string;
  body: string;
  time: string;
};
export type Audit = {
  id: string;
  action: string;
  entityId: string;
  reason?: string;
  at: string;
};
export type DemoState = {
  version: 1;
  appointments: Visit[];
  queue: QueueEntry[];
  notices: Notice[];
  audit: Audit[];
  nextToken: number;
  revision: number;
};
export type BookingInput = {
  name: string;
  phone: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  start: number;
};
export type Slot = { start: number; staffId: string };
export interface DemoService {
  getState(): DemoState;
  availability(
    input: Pick<BookingInput, "date" | "serviceIds" | "staffId">,
    excludeId?: string,
  ): Slot[];
  book(input: BookingInput): Visit;
  join(input: Omit<BookingInput, "date" | "start">): QueueEntry;
}
