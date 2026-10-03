import { AppEntry } from "@/components/app-entry";
export const dynamicParams = false;
export function generateStaticParams() {
  return [
    "services",
    "professionals",
    "book",
    "premium",
    "queue",
    "queue/join",
    "contact",
    "customer/bookings",
    "desk",
    "dashboard",
  ].map((p) => ({ path: p.split("/") }));
}
export default function Page() {
  return <AppEntry />;
}
