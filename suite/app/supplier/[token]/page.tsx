import type { Metadata } from "next";
import { SupplierSheet } from "@/components/suppliers/SupplierSheet";
import { Footer } from "@/components/shell/Footer";

export const metadata: Metadata = {
  title: "Your call sheet",
  description: "When to arrive, and what you are doing.",
  // A supplier's link is not for a search index, and the fragment that
  // decrypts it would never reach one anyway.
  robots: { index: false, follow: false },
};

export default async function SupplierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <SupplierSheet token={token} />
      {/* What a supplier's link publishes, and what it keeps back, is in the policy. */}
      <Footer />
    </>
  );
}
