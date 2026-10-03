import { VeloraApp } from "@/components/velora-app";
export const dynamicParams = false;
export function generateStaticParams() {
  return [
    "services",
    "professionals",
    "book",
    "queue",
    "queue/join",
    "contact",
    "customer/bookings",
    "desk",
    "dashboard",
  ].map((p) => ({ path: p.split("/") }));
}
export default function Page() {
  return <VeloraApp />;
}
