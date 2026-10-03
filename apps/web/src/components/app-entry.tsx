import { VeloraApp } from "./velora-app";
import { LiveApp } from "./live-app";
export function AppEntry() {
  return process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? (
    <VeloraApp />
  ) : (
    <LiveApp />
  );
}
