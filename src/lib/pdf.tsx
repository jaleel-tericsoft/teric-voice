import { pdf } from "@react-pdf/renderer";
import { EntryPdfDocument } from "@/components/entries/entry-pdf-document";
import type { Entry, FormDefinition, Organization } from "@/types";

/** Renders the entry as an actual PDF (question/answer detail, org logo
 * mark, timestamped footer) and returns it as a downloadable/viewable Blob. */
export async function generateEntryPdfBlob(
  entry: Entry,
  form: FormDefinition,
  organization: Organization
): Promise<Blob> {
  const instance = pdf(
    <EntryPdfDocument entry={entry} form={form} organization={organization} />
  );
  return instance.toBlob();
}
