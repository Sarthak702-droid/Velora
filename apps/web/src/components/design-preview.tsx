"use client";
import { useSearchParams } from "next/navigation";
import { VeloraApp } from "./velora-app";
import layouts from "@/lib/capture-layouts.json";
export function DesignPreview() {
  const p = useSearchParams();
  const width = p.get("width") === "768" ? 768 : 390;
  const route = p.get("route") ?? "/";
  return (
    <div className="design-capture" style={{ width, background: "#fcfaf6" }}>
      <style>{layouts[String(width) as keyof typeof layouts]}</style>
      <VeloraApp route={route} />
    </div>
  );
}
