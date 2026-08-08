// Core domain types — mirrors the entities defined in scope.md
// (Organization → Users → Forms → FormVersions → Entries → Answers)

export type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "phone"
  | "email"
  | "date"
  | "yes_no"
  | "single_select"
  | "multi_select";

export type EntryStatus =
  | "draft"
  | "in_progress"
  | "awaiting_review"
  | "submitted"
  | "pdf_generated"
  | "email_sent"
  | "email_failed";

export type EmailStatus = "sent" | "pending" | "failed" | "not_sent";

export type PdfStatus = "not_generated" | "generating" | "generated";

export type UserRole = "admin" | "user";

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  timezone: string;
  defaultEmail: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface ConditionalRule {
  dependsOnFieldName: string;
  equals: string | boolean;
}

export interface FormQuestion {
  id: string;
  order: number;
  fieldName: string;
  questionText: string;
  fieldType: FieldType;
  required: boolean;
  helpText?: string;
  options?: QuestionOption[];
  voiceGuidance?: string;
  conditional?: ConditionalRule;
}

export interface FormSection {
  id: string;
  title: string;
  order: number;
  questions: FormQuestion[];
}

export type FormStatus = "active" | "draft" | "inactive";

export interface FormVersion {
  id: string;
  version: number;
  sections: FormSection[];
  publishedAt: string;
}

export interface FormDefinition {
  id: string;
  formId: string;
  name: string;
  description: string;
  status: FormStatus;
  currentVersion: number;
  versions: FormVersion[];
  entryListColumns: string[]; // ordered fieldNames shown in Entries table
  accentColor?: string;
  totalEntries: number;
  updatedAt: string;
}

export interface EntryAnswer {
  fieldName: string;
  value: string | number | boolean | string[] | null;
  rawTranscript?: string;
  confidence?: number;
  source: "voice" | "manual";
  manuallyCorrected: boolean;
  timestamp: string;
}

export interface VoiceMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}

export interface VoiceSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  messages: VoiceMessage[];
}

export interface PDFDocument {
  status: PdfStatus;
  url?: string;
  generatedAt?: string;
}

export interface EmailDelivery {
  status: EmailStatus;
  recipient: string;
  sentAt?: string;
  failedReason?: string;
}

export interface AuditEvent {
  id: string;
  type:
    | "session_started"
    | "question_asked"
    | "answer_captured"
    | "answer_corrected"
    | "field_manually_edited"
    | "form_completed"
    | "entry_created"
    | "pdf_generated"
    | "email_sent"
    | "email_failed"
    | "email_resent";
  message: string;
  timestamp: string;
  actor: string;
}

export interface Entry {
  id: string;
  formId: string;
  formName: string;
  formVersion: number;
  status: EntryStatus;
  createdBy: string;
  createdAt: string;
  submittedAt?: string;
  answers: EntryAnswer[];
  pdf: PDFDocument;
  email: EmailDelivery;
  voiceSession?: VoiceSession;
  audit: AuditEvent[];
}

export interface DashboardStats {
  totalEntries: number;
  completedEntries: number;
  pendingEntries: number;
  emailsSent: number;
  emailsFailed: number;
}
