"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { VoiceExperience } from "@/components/voice/voice-experience";
import { useFormsStore } from "@/lib/forms-store";

// Forms created via Form Builder only live in the session-scoped FormsStore
// (there's no backend), so this has to read from that context instead of
// the static mock-data lookup — otherwise a freshly-built form 404s here
// even though it shows up everywhere else in the app.
export default function VoicePage() {
  return (
    <Suspense fallback={null}>
      <VoicePageContent />
    </Suspense>
  );
}

function VoicePageContent() {
  const searchParams = useSearchParams();
  const formParam = searchParams.get("form") ?? "employee-information";
  const { getFormByFormId } = useFormsStore();
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

function NoticeScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
        <AlertTriangle className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Link
        href="/form-builder"
        className="text-sm font-medium text-primary hover:underline"
      >
        Back to Form Builder
      </Link>
    </div>
  );
}
