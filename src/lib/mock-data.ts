import type {
  AppUser,
  DashboardStats,
  Entry,
  FormDefinition,
  Organization,
} from "@/types";

export const organization: Organization = {
  id: "org_1",
  name: "Northwind Motors",
  timezone: "Asia/Kolkata",
  defaultEmail: "service@northwindmotors.example",
};

export const currentUser: AppUser = {
  id: "user_1",
  name: "Priya Sharma",
  email: "priya@northwindmotors.example",
  phone: "+91 90000 11223",
  role: "admin",
  organizationId: organization.id,
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

// The single form the whole app is built around: a vehicle rolling in for
// service — either routine maintenance or a sales/upsell conversation —
// captures the plate, condition, and enough detail for a service advisor to
// act on it without re-asking the customer anything.
export const vehicleServiceForm: FormDefinition = {
  id: "form_vehicle_service",
  formId: "vehicle-service-upsell",
  name: "Vehicle Service & Upsell Intake",
  description:
    "Captures vehicle and customer details when a vehicle comes in for maintenance or an upsell conversation.",
  status: "active",
  currentVersion: 1,
  entryListColumns: [
    "number_plate",
    "vehicle_make",
    "vehicle_model",
    "visit_reason",
    "contact_number",
  ],
  totalEntries: 5,
  updatedAt: "2026-08-10T09:00:00Z",
  versions: [
    {
      id: "fv_vehicle_service_1",
      version: 1,
      publishedAt: "2026-08-10T09:00:00Z",
      sections: [
        {
          id: "sec_vehicle_details",
          title: "Vehicle Details",
          order: 1,
          questions: [
            {
              id: "q_number_plate",
              order: 1,
              fieldName: "number_plate",
              questionText: "What is the vehicle's number plate?",
              fieldType: "short_text",
              required: true,
              voiceGuidance: "Capture the full registration number as spoken, letters and digits.",
            },
            {
              id: "q_vehicle_make",
              order: 2,
              fieldName: "vehicle_make",
              questionText: "What is the vehicle make?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_vehicle_model",
              order: 3,
              fieldName: "vehicle_model",
              questionText: "What is the vehicle model?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_manufacture_year",
              order: 4,
              fieldName: "manufacture_year",
              questionText: "What year was the vehicle manufactured?",
              fieldType: "number",
              required: false,
            },
            {
              id: "q_odometer_reading",
              order: 5,
              fieldName: "odometer_reading",
              questionText: "What is the current odometer reading, in kilometers?",
              fieldType: "number",
              required: true,
            },
          ],
        },
        {
          id: "sec_visit_details",
          title: "Visit Details",
          order: 2,
          questions: [
            {
              id: "q_visit_reason",
              order: 1,
              fieldName: "visit_reason",
              questionText: "Is this visit for maintenance, an upsell inquiry, or both?",
              fieldType: "single_select",
              required: true,
              options: [
                { id: "vr1", label: "Maintenance", value: "maintenance" },
                { id: "vr2", label: "Upsell Inquiry", value: "upsell" },
                { id: "vr3", label: "Both", value: "both" },
              ],
            },
            {
              id: "q_is_scheduled",
              order: 2,
              fieldName: "is_scheduled",
              questionText: "Was this a scheduled appointment?",
              fieldType: "yes_no",
              required: false,
            },
            {
              id: "q_preferred_service_date",
              order: 3,
              fieldName: "preferred_service_date",
              questionText: "What is the preferred date to have the service completed by?",
              fieldType: "date",
              required: false,
            },
          ],
        },
        {
          id: "sec_condition",
          title: "Vehicle Condition",
          order: 3,
          questions: [
            {
              id: "q_vehicle_condition",
              order: 1,
              fieldName: "vehicle_condition",
              questionText: "How would you rate the overall condition of the vehicle?",
              fieldType: "single_select",
              required: true,
              options: [
                { id: "vc1", label: "Excellent", value: "excellent" },
                { id: "vc2", label: "Good", value: "good" },
                { id: "vc3", label: "Fair", value: "fair" },
                { id: "vc4", label: "Poor", value: "poor" },
              ],
            },
            {
              id: "q_warning_lights",
              order: 2,
              fieldName: "warning_lights",
              questionText: "Are any warning lights showing on the dashboard?",
              fieldType: "yes_no",
              required: true,
            },
            {
              id: "q_last_service_date",
              order: 3,
              fieldName: "last_service_date",
              questionText: "When was the vehicle last serviced?",
              fieldType: "date",
              required: false,
            },
            {
              id: "q_known_issues",
              order: 4,
              fieldName: "known_issues",
              questionText: "Are there any known issues or complaints to note?",
              fieldType: "long_text",
              required: false,
            },
          ],
        },
        {
          id: "sec_upsell_contact",
          title: "Upsell & Contact",
          order: 4,
          questions: [
            {
              id: "q_upsell_interest",
              order: 1,
              fieldName: "upsell_interest",
              questionText: "Is the customer interested in any additional services today?",
              fieldType: "yes_no",
              required: true,
            },
            {
              id: "q_upsell_type",
              order: 2,
              fieldName: "upsell_type",
              questionText: "Which additional service are they interested in?",
              fieldType: "single_select",
              required: false,
              options: [
                { id: "ut1", label: "Tyres", value: "tyres" },
                { id: "ut2", label: "AC Service", value: "ac_service" },
                { id: "ut3", label: "Detailing", value: "detailing" },
                { id: "ut4", label: "Insurance Renewal", value: "insurance_renewal" },
              ],
              conditional: { dependsOnFieldName: "upsell_interest", equals: true },
            },
            {
              id: "q_contact_number",
              order: 3,
              fieldName: "contact_number",
              questionText: "What is the best contact number for the customer?",
              fieldType: "phone",
              required: true,
            },
            {
              id: "q_contact_email",
              order: 4,
              fieldName: "contact_email",
              questionText: "What is the customer's email address?",
              fieldType: "email",
              required: false,
            },
          ],
        },
      ],
    },
  ],
};

export const forms: FormDefinition[] = [vehicleServiceForm];

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export const entries: Entry[] = [
  {
    id: "ENT-001",
    formId: vehicleServiceForm.id,
    formName: vehicleServiceForm.name,
    formVersion: 1,
    status: "email_sent",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-08T05:12:00Z",
    submittedAt: "2026-08-08T05:24:00Z",
    answers: [
      { fieldName: "number_plate", value: "KA05 AB1234", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:13:00Z", confidence: 0.95 },
      { fieldName: "vehicle_make", value: "Maruti Suzuki", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:13:20Z", confidence: 0.94 },
      { fieldName: "vehicle_model", value: "Swift", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:13:40Z", confidence: 0.96 },
      { fieldName: "manufacture_year", value: "2021", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:14:00Z", confidence: 0.9 },
      { fieldName: "odometer_reading", value: "42500", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:14:20Z", confidence: 0.92 },
      { fieldName: "visit_reason", value: "maintenance", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:15:00Z", confidence: 0.93 },
      { fieldName: "is_scheduled", value: true, source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:15:20Z", confidence: 0.97 },
      { fieldName: "vehicle_condition", value: "good", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:16:00Z", confidence: 0.91 },
      { fieldName: "warning_lights", value: false, source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:16:20Z", confidence: 0.95 },
      { fieldName: "upsell_interest", value: true, source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:17:00Z", confidence: 0.9 },
      { fieldName: "upsell_type", value: "tyres", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:17:20Z", confidence: 0.88 },
      { fieldName: "contact_number", value: "9876543210", source: "manual", manuallyCorrected: true, timestamp: "2026-08-08T05:20:00Z" },
    ],
    pdf: { status: "generated", url: "#", generatedAt: "2026-08-08T05:25:00Z" },
    email: { status: "sent", recipient: "ahmed@example.com", sentAt: "2026-08-08T05:26:00Z" },
    voiceSession: {
      id: "vs_ent001",
      startedAt: "2026-08-08T05:12:00Z",
      endedAt: "2026-08-08T05:20:00Z",
      messages: [
        { id: "m1", role: "assistant", text: "What is the vehicle's number plate?", timestamp: "2026-08-08T05:12:05Z" },
        { id: "m2", role: "user", text: "K A 0 5 A B 1 2 3 4", timestamp: "2026-08-08T05:12:10Z" },
        { id: "m3", role: "assistant", text: "What is the vehicle make?", timestamp: "2026-08-08T05:12:20Z" },
        { id: "m4", role: "user", text: "Maruti Suzuki", timestamp: "2026-08-08T05:12:28Z" },
      ],
    },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-08T05:12:00Z", actor: "Priya Sharma" },
      { id: "a2", type: "entry_created", message: "Entry submitted", timestamp: "2026-08-08T05:24:00Z", actor: "Priya Sharma" },
      { id: "a3", type: "pdf_generated", message: "PDF generated", timestamp: "2026-08-08T05:25:00Z", actor: "System" },
      { id: "a4", type: "email_sent", message: "Email sent to ahmed@example.com", timestamp: "2026-08-08T05:26:00Z", actor: "System" },
    ],
  },
  {
    id: "ENT-002",
    formId: vehicleServiceForm.id,
    formName: vehicleServiceForm.name,
    formVersion: 1,
    status: "email_failed",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-08T06:02:00Z",
    submittedAt: "2026-08-08T06:14:00Z",
    answers: [
      { fieldName: "number_plate", value: "MH12 CD5678", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:03:00Z", confidence: 0.93 },
      { fieldName: "vehicle_make", value: "Hyundai", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:03:20Z", confidence: 0.95 },
      { fieldName: "vehicle_model", value: "Creta", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:03:40Z", confidence: 0.96 },
      { fieldName: "manufacture_year", value: "2019", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:04:00Z", confidence: 0.89 },
      { fieldName: "odometer_reading", value: "68210", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:04:20Z", confidence: 0.9 },
      { fieldName: "visit_reason", value: "both", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:05:00Z", confidence: 0.87 },
      { fieldName: "vehicle_condition", value: "fair", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:06:00Z", confidence: 0.85 },
      { fieldName: "warning_lights", value: true, source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:06:20Z", confidence: 0.92 },
      { fieldName: "known_issues", value: "Engine warning light on, slight vibration at idle", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:07:00Z", confidence: 0.8 },
      { fieldName: "upsell_interest", value: false, source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:08:00Z", confidence: 0.93 },
      { fieldName: "contact_number", value: "9988776655", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:09:00Z", confidence: 0.94 },
    ],
    pdf: { status: "generated", url: "#", generatedAt: "2026-08-08T06:15:00Z" },
    email: { status: "failed", recipient: "ravi@example.com", failedReason: "Mailbox unavailable" },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-08T06:02:00Z", actor: "Priya Sharma" },
      { id: "a2", type: "entry_created", message: "Entry submitted", timestamp: "2026-08-08T06:14:00Z", actor: "Priya Sharma" },
      { id: "a3", type: "pdf_generated", message: "PDF generated", timestamp: "2026-08-08T06:15:00Z", actor: "System" },
      { id: "a4", type: "email_failed", message: "Email delivery failed — mailbox unavailable", timestamp: "2026-08-08T06:16:00Z", actor: "System" },
    ],
  },
  {
    id: "ENT-003",
    formId: vehicleServiceForm.id,
    formName: vehicleServiceForm.name,
    formVersion: 1,
    status: "awaiting_review",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-07T09:00:00Z",
    submittedAt: "2026-08-07T09:11:00Z",
    answers: [
      { fieldName: "number_plate", value: "DL3C AB9012", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:01:00Z", confidence: 0.9 },
      { fieldName: "vehicle_make", value: "Tata", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:01:20Z", confidence: 0.93 },
      { fieldName: "vehicle_model", value: "Nexon", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:01:40Z", confidence: 0.95 },
      { fieldName: "odometer_reading", value: "15400", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:02:00Z", confidence: 0.91 },
      { fieldName: "visit_reason", value: "upsell", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:02:20Z", confidence: 0.88 },
      { fieldName: "vehicle_condition", value: "excellent", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:03:00Z", confidence: 0.94 },
      { fieldName: "warning_lights", value: false, source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:03:20Z", confidence: 0.96 },
      { fieldName: "upsell_interest", value: true, source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:04:00Z", confidence: 0.9 },
      { fieldName: "upsell_type", value: "detailing", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:04:20Z", confidence: 0.86 },
      { fieldName: "contact_number", value: "9822011223", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:05:00Z", confidence: 0.91 },
    ],
    pdf: { status: "not_generated" },
    email: { status: "not_sent", recipient: "" },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-07T09:00:00Z", actor: "Priya Sharma" },
      { id: "a2", type: "entry_created", message: "Entry submitted, pending review", timestamp: "2026-08-07T09:11:00Z", actor: "Priya Sharma" },
    ],
  },
  {
    id: "ENT-004",
    // Left mid-conversation — only a handful of fields answered before the
    // customer had to step away. Demonstrates Save Draft & Resume: open it
    // from Entries and voice-fill picks up on the first unanswered field.
    formId: vehicleServiceForm.id,
    formName: vehicleServiceForm.name,
    formVersion: 1,
    status: "in_progress",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-09T07:40:00Z",
    answers: [
      { fieldName: "number_plate", value: "KA03 EF3456", source: "voice", manuallyCorrected: false, timestamp: "2026-08-09T07:41:00Z", confidence: 0.92 },
      { fieldName: "vehicle_make", value: "Honda", source: "voice", manuallyCorrected: false, timestamp: "2026-08-09T07:41:20Z", confidence: 0.94 },
      { fieldName: "vehicle_model", value: "City", source: "voice", manuallyCorrected: false, timestamp: "2026-08-09T07:41:40Z", confidence: 0.95 },
    ],
    pdf: { status: "not_generated" },
    email: { status: "not_sent", recipient: "" },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-09T07:40:00Z", actor: "Priya Sharma" },
    ],
  },
  {
    id: "ENT-005",
    // Barely started — just the plate number captured before saving as a
    // draft. A second, sparser example of a resumable entry.
    formId: vehicleServiceForm.id,
    formName: vehicleServiceForm.name,
    formVersion: 1,
    status: "in_progress",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-10T08:05:00Z",
    answers: [
      { fieldName: "number_plate", value: "TN09 GH7890", source: "voice", manuallyCorrected: false, timestamp: "2026-08-10T08:06:00Z", confidence: 0.89 },
    ],
    pdf: { status: "not_generated" },
    email: { status: "not_sent", recipient: "" },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-10T08:05:00Z", actor: "Priya Sharma" },
    ],
  },
];

export function getFormById(formId: string): FormDefinition | undefined {
  return forms.find((f) => f.id === formId);
}

export function getFormBySlug(formSlug: string): FormDefinition | undefined {
  return forms.find((f) => f.formId === formSlug);
}

export function getEntriesForForm(formId: string): Entry[] {
  return entries.filter((e) => e.formId === formId);
}

export function getEntryById(entryId: string): Entry | undefined {
  return entries.find((e) => e.id === entryId);
}

export function computeDashboardStats(entryList: Entry[]): DashboardStats {
  return {
    totalEntries: entryList.length,
    completedEntries: entryList.filter((e) =>
      ["submitted", "pdf_generated", "email_sent", "email_failed", "awaiting_review"].includes(
        e.status
      )
    ).length,
    pendingEntries: entryList.filter((e) => ["draft", "in_progress"].includes(e.status)).length,
    emailsSent: entryList.filter((e) => e.email.status === "sent").length,
    emailsFailed: entryList.filter((e) => e.email.status === "failed").length,
  };
}

export const dashboardStats: DashboardStats = computeDashboardStats(entries);
