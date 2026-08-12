import { Sidebar } from "@/components/layout/sidebar";
import { IdleLogoutBanner } from "@/components/layout/idle-logout-banner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full gap-3 bg-canvas p-3">
      <Sidebar />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background shadow-sm ring-1 ring-black/[0.03]">
        <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-8">
          {children}
        </div>
      </main>
      {/* Idle auto-logout — a device left running (glasses/wearable use)
       * shouldn't stay signed in indefinitely. Not mounted on
       * /voice/[entryId], which sits outside this layout entirely. */}
      <IdleLogoutBanner />
    </div>
  );
}
