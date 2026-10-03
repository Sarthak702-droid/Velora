import { Suspense } from "react";
import { DesignPreview } from "@/components/design-preview";
export default function Design() {
  return (
    <Suspense>
      <DesignPreview />
    </Suspense>
  );
}
