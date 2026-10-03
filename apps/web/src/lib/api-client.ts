export type Service = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  buffer: number;
  imageUrl?: string;
  categoryId: string;
};
export type Staff = {
  schedules?: { branchId: string; isWorkingDay: boolean }[];
  id: string;
  name: string;
  title: string;
  photoUrl?: string;
  rating: number;
  reviewCount: number;
  operationalStatus: string;
  services: { serviceId: string }[];
};
export type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email?: string;
  currency: string;
  timezone: string;
  openingTime: string;
  closingTime: string;
  weeklyHolidays: string[];
};
export type Salon = {
  id: string;
  name: string;
  salonProfile: {
    currency: string;
    timezone: string;
    email?: string;
    cancellationWindowHours: number;
  };
  branches: Branch[];
  serviceCategories: { id: string; name: string; services: Service[] }[];
  staffProfiles: Staff[];
};
export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  branchId?: string;
  salon?: { slug: string };
  branch?: { id: string };
};
export type Slot = {
  time: string;
  timestamp: string;
  staffId: string;
  staffName: string;
};
export type Appointment = {
  id: string;
  customerId: string;
  customer: { name: string; phone: string };
  staff?: Staff;
  staffId?: string;
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  totalDuration: number;
  services: { serviceId: string; service: Service }[];
};
export type Entry = {
  id: string;
  tokenNumber: string;
  status: string;
  position: number;
  estimatedWaitMinutes: number;
  serviceIds: string[];
  services?: Service[];
  customer: { name: string; phone: string };
  staff?: Staff;
  staffId?: string;
  totalDuration: number;
  serviceStartAt?: string;
};
export type QueueReceipt = { id: string; tokenNumber: string };
export type QueueStatus = {
  id: string;
  tokenNumber: string;
  status: string;
  position: number;
  guestsAhead: number;
  estimatedWaitMinutes: number;
  services: string[];
  staffName: string;
  branchName: string;
  joinedAt: string;
};
export type Desk = {
  waiting: Entry[];
  inService: Entry[];
  upcoming: Appointment[];
};
export type SearchResults = {
  customers: { id: string; name: string; phone: string }[];
  appointments: Appointment[];
  queueEntries: Entry[];
};
export type Analytics = {
  date: string;
  customersToday: number;
  appointmentsToday: number;
  walkinsToday: number;
  completedServices: number;
  avgWaitMinutes: number;
  avgServiceMinutes: number;
  noShowRate: string;
  cancellationRate: string;
  appointmentRatio: { appointments: number; walkins: number };
  mostBookedService: string;
  serviceDemand: { id: string; name: string; count: number }[];
  staffUtilization: {
    staffId: string;
    name: string;
    utilizationPct: number;
    serviceMinutes: number;
    availableMinutes: number;
  }[];
};
export type VisitInput = {
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceIds: string[];
  notes?: string;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  tenantId?: string,
  options: {
    method?: string;
    body?: unknown;
    staff?: boolean;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  if (options.staff) headers["X-Staff-Session"] = "1";
  if (options.idempotencyKey)
    headers["X-Idempotency-Key"] = options.idempotencyKey;
  const response = await fetch(`/api/v1/${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok || json.success === false) {
    const message = json.error?.message || json.message || "Request failed";
    throw new ApiError(
      Array.isArray(message) ? message.join(". ") : message,
      response.status,
      json.requestId,
    );
  }
  return json.data as T;
}
export const qs = (values: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(values).filter(
      (v): v is [string, string] => v[1] !== undefined,
    ),
  ).toString();
