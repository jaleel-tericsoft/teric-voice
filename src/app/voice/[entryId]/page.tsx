import { notFound } from "next/navigation";
import { VoiceExperience } from "@/components/voice/voice-experience";
import { getFormBySlug } from "@/lib/mock-data";

export default async function VoicePage(props: PageProps<"/voice/[entryId]">) {
  const searchParams = await props.searchParams;
  const formParam = Array.isArray(searchParams.form)
    ? searchParams.form[0]
    : searchParams.form;

  const form = getFormBySlug(formParam ?? "employee-information");
  if (!form) notFound();

  return <VoiceExperience form={form} key={form.id} />;
}
