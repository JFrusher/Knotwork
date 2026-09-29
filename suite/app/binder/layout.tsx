import { StoreHydrator } from "@/lib/store/StoreHydrator";

/**
 * The Binder stands apart from the planning app: no header of tools, nothing
 * to edit — the wedding on a phone, on the day. It loads the wedding as the
 * app does, from this phone first and then from the account when there is
 * signal.
 */
export default function BinderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreHydrator />
      {children}
    </>
  );
}
