import type { DemoState, Professional, Service } from "@velora/types";
export const CONTEXT = { tenantId: "velora-demo", branchId: "orchard" };
export const DATE = "2025-04-16";
export const SERVICES: Service[] = [
  {
    id: "haircut",
    name: "Haircut",
    category: "Hair",
    description: "Professional cut & styling for a fresh new look.",
    duration: 60,
    buffer: 5,
    price: 80,
    image: "hair",
  },
  {
    id: "beard",
    name: "Beard Trim",
    category: "Grooming",
    description: "Precision grooming & styling.",
    duration: 30,
    buffer: 5,
    price: 40,
    image: "grooming",
  },
  {
    id: "spa",
    name: "Hair Spa",
    category: "Hair",
    description: "Deep nourishment for healthier hair.",
    duration: 60,
    buffer: 10,
    price: 90,
    image: "hair-spa",
  },
  {
    id: "facial",
    name: "Facial",
    category: "Beauty",
    description: "Rejuvenating skincare treatment for glowing skin.",
    duration: 60,
    buffer: 5,
    price: 100,
    image: "facial",
  },
  {
    id: "colour",
    name: "Balayage Colour",
    category: "Hair",
    description: "Beautiful, dimensional colour tailored to you.",
    duration: 120,
    buffer: 15,
    price: 180,
    image: "hair",
  },
  {
    id: "body",
    name: "Body Spa",
    category: "Spa",
    description: "Relaxation, body care & wellness.",
    duration: 90,
    buffer: 10,
    price: 140,
    image: "spa",
  },
];
export const STAFF: Professional[] = [
  {
    id: "ava",
    name: "Ava Chen",
    title: "Creative Director",
    image: "ava",
    rating: 4.9,
    reviews: 120,
    services: ["haircut", "spa", "colour", "body"],
    shift: [540, 1260],
    breaks: [[780, 810]],
  },
  {
    id: "rohan",
    name: "Rohan Mehta",
    title: "Men’s Grooming Specialist",
    image: "rohan",
    rating: 4.8,
    reviews: 98,
    services: ["haircut", "beard", "spa"],
    shift: [540, 1260],
    breaks: [[780, 810]],
  },
  {
    id: "elena",
    name: "Elena Park",
    title: "Senior Beauty Therapist",
    image: "elena",
    rating: 4.9,
    reviews: 76,
    services: ["facial", "body", "spa", "haircut"],
    shift: [540, 1260],
    breaks: [[780, 810]],
  },
  {
    id: "mei",
    name: "Mei Wong",
    title: "Nail Specialist",
    image: "ava",
    rating: 4.8,
    reviews: 76,
    services: ["facial", "body"],
    shift: [540, 1080],
    breaks: [[780, 810]],
  },
];
export const config = {
  name: "Velora Aesthetica Lane",
  address: "123 Aesthetica Lane",
  city: "Singapore 238001",
  phone: "+65 8123 4567",
  email: "hello@velora.sg",
  currency: "SGD",
  timezone: "Asia/Singapore",
  open: 540,
  close: 1260,
  cancelHours: 12,
};
export function seed(): DemoState {
  const names = [
    "Nicole Tan",
    "Daniel Wong",
    "Priya Sharma",
    "Alicia Kwan",
    "Ethan Lim",
    "Rachel Lee",
  ];
  return {
    version: 1,
    nextToken: 24,
    revision: 0,
    audit: [],
    appointments: [
      ["Olivia Park", "ava", "colour", 840],
      ["Jason Lee", "rohan", "beard", 660],
      ["Megan Lui", "elena", "facial", 870],
      ["Darren Ng", "ava", "spa", 1020],
    ].map(([name, staffId, serviceId, start], i) => ({
      ...CONTEXT,
      id: "appointment-" + i,
      name: String(name),
      phone: "+65 8123 45" + i + "5",
      serviceIds: [String(serviceId)],
      staffId: String(staffId),
      date: DATE,
      start: Number(start),
      status: "CONFIRMED",
    })),
    queue: [
      ...names.map((name, i) => ({
        ...CONTEXT,
        id: "queue-" + i,
        token: "A" + String(18 + i).padStart(3, "0"),
        name,
        phone: "+65 9123 45" + i + "7",
        serviceIds: [["haircut", "beard", "facial", "body", "spa", "body"][i]],
        staffId: ["ava", "rohan", "elena", "mei", "rohan", "elena"][i],
        status: "WAITING" as const,
        joined: i,
      })),
      ...["Chloe Ng", "Marcus Teo", "Isabella Chen", "Sarah Khan"].map(
        (name, i) => ({
          ...CONTEXT,
          id: "active-" + i,
          token: "A00" + (i + 1),
          name,
          phone: "+65 8234 5678",
          serviceIds: [["facial", "beard", "colour", "body"][i]],
          staffId: ["elena", "rohan", "ava", "mei"][i],
          status: "IN_SERVICE" as const,
          joined: -4 + i,
          remaining: [20, 20, 20, 25][i],
        }),
      ),
    ],
    notices: [
      {
        id: "welcome",
        entryId: "queue-5",
        title: "Queue Confirmed",
        body: "You’re now in the queue. Token A023.",
        time: "2:14 PM",
      },
    ],
  };
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: config.currency,
    maximumFractionDigits: 0,
  }).format(n);
export const time = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const duration = (ids: string[], buffer = false) =>
  ids.reduce((sum, id) => {
    const s = SERVICES.find((x) => x.id === id);
    return sum + (s?.duration ?? 0) + (buffer ? (s?.buffer ?? 0) : 0);
  }, 0);
export const price = (ids: string[]) =>
  ids.reduce(
    (sum, id) => sum + (SERVICES.find((s) => s.id === id)?.price ?? 0),
    0,
  );
export const compatible = (ids: string[]) =>
  STAFF.filter((s) => ids.every((id) => s.services.includes(id)));
