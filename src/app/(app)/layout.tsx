import { Sidebar } from "@/components/layout/sidebar";

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
    </div>
  );
}
