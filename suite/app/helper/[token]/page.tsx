import type { Metadata } from "next";
import { HelperPage } from "@/components/helpers/HelperPage";
import { Footer } from "@/components/shell/Footer";

export const metadata: Metadata = {
  title: "Your day",
  description: "The run of the day, your jobs, the boxes, the photos and the numbers to ring.",
  // A helper's link is not for a search index, and the fragment that
  // decrypts it would never reach one anyway.
  robots: { index: false, follow: false },
};

export default async function HelperRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <HelperPage token={token} />
      {/* What a helper's link holds, and what it keeps back, is in the policy. */}
      <Footer />
    </>
  );
}
