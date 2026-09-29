import type { Metadata, Viewport } from "next";
import { Binder } from "@/components/binder/Binder";

export const metadata: Metadata = {
  title: "Binder",
  description: "The wedding on the day, on a phone: what is on now, who to ring, where a guest sits, the shots to take.",
};

// The page colour, so the phone's own bar matches it.
export const viewport: Viewport = { themeColor: "#fdfbf7" };

export default function BinderPage() {
  return <Binder />;
}
