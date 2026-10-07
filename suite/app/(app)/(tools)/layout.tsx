import { LandscapeGate } from "@/components/shell/LandscapeGate";

/** The wide tools, each behind the one landscape gate. */
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <LandscapeGate>{children}</LandscapeGate>;
}
