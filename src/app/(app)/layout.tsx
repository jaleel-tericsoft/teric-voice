import { Sidebar } from "@/components/layout/sidebar";
import { IdleLogoutBanner } from "@/components/layout/idle-logout-banner";
import { AmbientVoiceWidget } from "@/components/layout/ambient-voice-widget";
import { FormBuilderDraftProvider } from "@/lib/form-builder-draft-store";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Scoped to the authenticated shell, not the root layout — the
    // form-builder draft only matters while signed in, and this is what
    // lets the ambient widget's form-builder voice tools (mounted below,
    // outside /form-builder/new itself) share the exact same draft state
    // the page renders, rather than two copies that could drift apart.
    <FormBuilderDraftProvider>
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
        {/* Always-on ambient assistant — present on every authenticated page,
         * distinct from the form-filling agent that takes over once a voice
         * session actually starts on /voice/[entryId] (outside this layout,
         * so the two never run at once). Reconnects to a third agent while
         * on /form-builder/new for voice-driven form building. */}
        <AmbientVoiceWidget />
      </div>
    </FormBuilderDraftProvider>
  );
}
