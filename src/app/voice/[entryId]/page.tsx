"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { VoiceExperience } from "@/components/voice/voice-experience";
import { useFormsStore } from "@/lib/forms-store";
import { useEntriesStore } from "@/lib/entries-store";

// Forms created via Form Builder only live in the session-scoped FormsStore
// (there's no backend), so this has to read from that context instead of a
// static mock-data lookup — otherwise a freshly-built form 404s here even
// though it shows up everywhere else in the app. Same reasoning for entries:
// entryId "new" starts a fresh session against ?form=; any other entryId is
// an existing draft/in-progress entry to resume from where it left off.
export default function VoicePage(props: PageProps<"/voice/[entryId]">) {
  const { entryId } = use(props.params);
  return (
    <Suspense fallback={null}>
      <VoicePageContent entryId={entryId} />
    </Suspense>
  );
}

function VoicePageContent({ entryId }: { entryId: string }) {
  const searchParams = useSearchParams();
  const { getFormByFormId, forms } = useFormsStore();
  const { getEntryById } = useEntriesStore();

  if (entryId !== "new") {
    const resumeEntry = getEntryById(entryId);
    if (!resumeEntry) {
      return (
        <NoticeScreen
          title="Entry not found"
          message="This entry doesn't exist, or hasn't finished loading. Try again from Entries."
          backHref="/entries"
          backLabel="Back to Entries"
        />
      );
    }
    if (resumeEntry.status !== "draft" && resumeEntry.status !== "in_progress") {
      return (
        <NoticeScreen
          title="This entry is already submitted"
          message="There's nothing left to resume here — view the finished entry instead."
          backHref={`/entries/${resumeEntry.id}`}
          backLabel="View entry"
        />
      );
    }
    const form = forms.find((f) => f.id === resumeEntry.formId);
    if (!form) {
      return (
        <NoticeScreen
          title="Form not found"
          message="The form this entry belongs to no longer exists."
          backHref="/entries"
          backLabel="Back to Entries"
        />
      );
    }
    return <VoiceExperience form={form} resumeEntry={resumeEntry} key={resumeEntry.id} />;
  }

  const formParam = searchParams.get("form") ?? "vehicle-service-upsell";
  const form = getFormByFormId(formParam);

  if (!form) {
    return (
      <NoticeScreen
        title="Form not found"
        message="This form doesn't exist, or hasn't finished loading. Try again from Form Builder."
      />
    );
  }

  // Only a published (active) form can collect new entries — a draft
  // hasn't been finished/published yet, and an inactive form was
  // deliberately turned off.
  if (form.status === "draft") {
    return (
      <NoticeScreen
        title="This form is still a draft"
        message={`"${form.name}" hasn't been published yet. Publish it from Form Builder before collecting entries.`}
      />
    );
  }
  if (form.status === "inactive") {
    return (
      <NoticeScreen
        title="This form is inactive"
        message={`"${form.name}" has been deactivated and isn't accepting new entries. Reactivate it from Form Builder to continue.`}
      />
    );
  }

  return <VoiceExperience form={form} key={form.id} />;
}

function NoticeScreen({
  title,
  message,
  backHref = "/form-builder",
  backLabel = "Back to Form Builder",
}: {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
        <AlertTriangle className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Link href={backHref} className="text-sm font-medium text-primary hover:underline">
        {backLabel}
      </Link>
    </div>
  );
}
