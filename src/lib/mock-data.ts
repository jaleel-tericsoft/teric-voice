import type {
  AppUser,
  DashboardStats,
  Entry,
  FormDefinition,
  Organization,
} from "@/types";

export const organization: Organization = {
  id: "org_1",
  name: "Northwind Logistics",
  timezone: "Asia/Kolkata",
  defaultEmail: "ops@northwind.example",
};

export const currentUser: AppUser = {
  id: "user_1",
  name: "Priya Sharma",
  email: "priya@northwind.example",
  phone: "+91 90000 11223",
  role: "admin",
  organizationId: organization.id,
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const employeeInfoForm: FormDefinition = {
  id: "form_employee_info",
  formId: "employee-information",
  name: "Employee Information Form",
  description:
    "Collects personal, employment, and address details for new employees.",
  status: "active",
  currentVersion: 2,
  entryListColumns: ["full_name", "phone", "email", "employment_status"],
  totalEntries: 3,
  updatedAt: "2026-08-02T10:00:00Z",
  versions: [
    {
      id: "fv_employee_1",
      version: 1,
      publishedAt: "2026-05-01T09:00:00Z",
      sections: [],
    },
    {
      id: "fv_employee_2",
      version: 2,
      publishedAt: "2026-08-02T10:00:00Z",
      sections: [
        {
          id: "sec_personal",
          title: "Personal Information",
          order: 1,
          questions: [
            {
              id: "q_full_name",
              order: 1,
              fieldName: "full_name",
              questionText: "What is your full name?",
              fieldType: "short_text",
              required: true,
              voiceGuidance: "Capture the complete name as spoken.",
            },
            {
              id: "q_dob",
              order: 2,
              fieldName: "date_of_birth",
              questionText: "What is your date of birth?",
              fieldType: "date",
              required: true,
            },
            {
              id: "q_gender",
              order: 3,
              fieldName: "gender",
              questionText: "What is your gender?",
              fieldType: "single_select",
              required: false,
              options: [
                { id: "o1", label: "Male", value: "male" },
                { id: "o2", label: "Female", value: "female" },
                { id: "o3", label: "Other", value: "other" },
              ],
            },
            {
              id: "q_phone",
              order: 4,
              fieldName: "phone",
              questionText: "What is your phone number?",
              fieldType: "phone",
              required: true,
            },
            {
              id: "q_email",
              order: 5,
              fieldName: "email",
              questionText: "What is your email address?",
              fieldType: "email",
              required: true,
            },
          ],
        },
        {
          id: "sec_employment",
          title: "Employment Information",
          order: 2,
          questions: [
            {
              id: "q_employment_status",
              order: 1,
              fieldName: "employment_status",
              questionText: "What is your employment status?",
              fieldType: "single_select",
              required: true,
              options: [
                { id: "es1", label: "Employed", value: "employed" },
                { id: "es2", label: "Self-employed", value: "self_employed" },
                { id: "es3", label: "Unemployed", value: "unemployed" },
                { id: "es4", label: "Student", value: "student" },
              ],
            },
            {
              id: "q_company",
              order: 2,
              fieldName: "company_name",
              questionText: "What is your company name?",
              fieldType: "short_text",
              required: false,
            },
            {
              id: "q_experience",
              order: 3,
              fieldName: "years_experience",
              questionText: "How many years of experience do you have?",
              fieldType: "number",
              required: false,
            },
          ],
        },
        {
          id: "sec_address",
          title: "Address",
          order: 3,
          questions: [
            {
              id: "q_address",
              order: 1,
              fieldName: "address",
              questionText: "What is your address?",
              fieldType: "long_text",
              required: true,
            },
            {
              id: "q_city",
              order: 2,
              fieldName: "city",
              questionText: "Which city do you live in?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_state",
              order: 3,
              fieldName: "state",
              questionText: "Which state is that in?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_pin",
              order: 4,
              fieldName: "pin_code",
              questionText: "What is the PIN code?",
              fieldType: "short_text",
              required: true,
            },
          ],
        },
        {
          id: "sec_conditional",
          title: "Conditional Information",
          order: 4,
          questions: [
            {
              id: "q_has_license",
              order: 1,
              fieldName: "has_driving_license",
              questionText: "Do you have a driving license?",
              fieldType: "yes_no",
              required: true,
              voiceGuidance:
                "Accept variations like 'yes', 'yeah', 'I do', 'I currently have one'.",
            },
            {
              id: "q_license_no",
              order: 2,
              fieldName: "driving_license_number",
              questionText: "What is your driving license number?",
              fieldType: "short_text",
              required: false,
              conditional: {
                dependsOnFieldName: "has_driving_license",
                equals: true,
              },
            },
          ],
        },
      ],
    },
  ],
};

export const driverRegistrationForm: FormDefinition = {
  id: "form_driver_registration",
  formId: "driver-registration",
  name: "Driver Registration",
  description: "Registers a new driver with license and contact details.",
  status: "active",
  currentVersion: 1,
  entryListColumns: ["full_name", "phone", "license_no", "email"],
  totalEntries: 2,
  updatedAt: "2026-07-20T10:00:00Z",
  versions: [
    {
      id: "fv_driver_1",
      version: 1,
      publishedAt: "2026-07-01T09:00:00Z",
      sections: [
        {
          id: "sec_driver_personal",
          title: "Driver Details",
          order: 1,
          questions: [
            {
              id: "q_driver_name",
              order: 1,
              fieldName: "full_name",
              questionText: "What is the driver's full name?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_driver_phone",
              order: 2,
              fieldName: "phone",
              questionText: "What is the driver's phone number?",
              fieldType: "phone",
              required: true,
            },
            {
              id: "q_driver_license",
              order: 3,
              fieldName: "license_no",
              questionText: "What is the driving license number?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_driver_email",
              order: 4,
              fieldName: "email",
              questionText: "What is the driver's email address?",
              fieldType: "email",
              required: false,
            },
          ],
        },
      ],
    },
  ],
};

export const vehicleInspectionForm: FormDefinition = {
  id: "form_vehicle_inspection",
  formId: "vehicle-inspection",
  name: "Vehicle Inspection",
  description: "Captures inspection results for a fleet vehicle.",
  status: "active",
  currentVersion: 1,
  entryListColumns: ["vehicle_number", "inspector_name", "inspection_result"],
  totalEntries: 1,
  updatedAt: "2026-08-05T10:00:00Z",
  versions: [
    {
      id: "fv_vehicle_1",
      version: 1,
      publishedAt: "2026-08-01T09:00:00Z",
      sections: [
        {
          id: "sec_vehicle",
          title: "Inspection Details",
          order: 1,
          questions: [
            {
              id: "q_vehicle_number",
              order: 1,
              fieldName: "vehicle_number",
              questionText: "What is the vehicle registration number?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_inspector_name",
              order: 2,
              fieldName: "inspector_name",
              questionText: "What is the inspector's name?",
              fieldType: "short_text",
              required: true,
            },
            {
              id: "q_inspection_result",
              order: 3,
              fieldName: "inspection_result",
              questionText: "What is the inspection result?",
              fieldType: "single_select",
              required: true,
              options: [
                { id: "r1", label: "Pass", value: "pass" },
                { id: "r2", label: "Fail", value: "fail" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const forms: FormDefinition[] = [
  employeeInfoForm,
  driverRegistrationForm,
  vehicleInspectionForm,
];

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export const entries: Entry[] = [
  {
    id: "ENT-001",
    formId: driverRegistrationForm.id,
    formName: driverRegistrationForm.name,
    formVersion: 1,
    status: "email_sent",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-08T05:12:00Z",
    submittedAt: "2026-08-08T05:20:00Z",
    answers: [
      { fieldName: "full_name", value: "Ahmed Khan", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:13:00Z", confidence: 0.97 },
      { fieldName: "phone", value: "9876543210", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:14:00Z", confidence: 0.95 },
      { fieldName: "license_no", value: "DL1234", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T05:15:00Z", confidence: 0.9 },
      { fieldName: "email", value: "ahmed@example.com", source: "manual", manuallyCorrected: true, timestamp: "2026-08-08T05:19:00Z" },
    ],
    pdf: { status: "generated", url: "#", generatedAt: "2026-08-08T05:21:00Z" },
    email: { status: "sent", recipient: "ahmed@example.com", sentAt: "2026-08-08T05:22:00Z" },
    voiceSession: {
      id: "vs_ent001",
      startedAt: "2026-08-08T05:12:00Z",
      endedAt: "2026-08-08T05:19:00Z",
      messages: [
        { id: "m1", role: "assistant", text: "What is your full name?", timestamp: "2026-08-08T05:12:05Z" },
        { id: "m2", role: "user", text: "My name is Ahmed Khan.", timestamp: "2026-08-08T05:12:10Z" },
        { id: "m3", role: "assistant", text: "What is your phone number?", timestamp: "2026-08-08T05:12:20Z" },
        { id: "m4", role: "user", text: "9876543210", timestamp: "2026-08-08T05:12:28Z" },
        { id: "m5", role: "assistant", text: "What is your driving license number?", timestamp: "2026-08-08T05:12:40Z" },
        { id: "m6", role: "user", text: "DL1234", timestamp: "2026-08-08T05:12:48Z" },
      ],
    },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-08T05:12:00Z", actor: "Priya Sharma" },
      { id: "a2", type: "entry_created", message: "Entry created", timestamp: "2026-08-08T05:20:00Z", actor: "Priya Sharma" },
      { id: "a3", type: "pdf_generated", message: "PDF generated", timestamp: "2026-08-08T05:21:00Z", actor: "System" },
      { id: "a4", type: "email_sent", message: "Email sent to ahmed@example.com", timestamp: "2026-08-08T05:22:00Z", actor: "System" },
    ],
  },
  {
    id: "ENT-002",
    formId: driverRegistrationForm.id,
    formName: driverRegistrationForm.name,
    formVersion: 1,
    status: "email_failed",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-08T06:02:00Z",
    submittedAt: "2026-08-08T06:10:00Z",
    answers: [
      { fieldName: "full_name", value: "Ravi Kumar", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:03:00Z", confidence: 0.96 },
      { fieldName: "phone", value: "9988776655", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:04:00Z", confidence: 0.94 },
      { fieldName: "license_no", value: "DL5678", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:05:00Z", confidence: 0.88 },
      { fieldName: "email", value: "ravi@example.com", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T06:06:00Z", confidence: 0.7 },
    ],
    pdf: { status: "generated", url: "#", generatedAt: "2026-08-08T06:11:00Z" },
    email: { status: "failed", recipient: "ravi@example.com", failedReason: "Mailbox unavailable" },
    audit: [
      { id: "a1", type: "session_started", message: "Voice session started", timestamp: "2026-08-08T06:02:00Z", actor: "Priya Sharma" },
      { id: "a2", type: "entry_created", message: "Entry created", timestamp: "2026-08-08T06:10:00Z", actor: "Priya Sharma" },
      { id: "a3", type: "pdf_generated", message: "PDF generated", timestamp: "2026-08-08T06:11:00Z", actor: "System" },
      { id: "a4", type: "email_failed", message: "Email delivery failed — mailbox unavailable", timestamp: "2026-08-08T06:12:00Z", actor: "System" },
    ],
  },
  {
    id: "ENT-003",
    formId: employeeInfoForm.id,
    formName: employeeInfoForm.name,
    formVersion: 2,
    status: "email_sent",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-07T09:00:00Z",
    submittedAt: "2026-08-07T09:14:00Z",
    answers: [
      { fieldName: "full_name", value: "Ahmed Khan", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:01:00Z", confidence: 0.97 },
      { fieldName: "date_of_birth", value: "1995-08-15", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:02:00Z", confidence: 0.93 },
      { fieldName: "phone", value: "9876543210", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:03:00Z", confidence: 0.95 },
      { fieldName: "email", value: "ahmed@example.com", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:04:00Z", confidence: 0.9 },
      { fieldName: "employment_status", value: "employed", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:05:00Z", confidence: 0.92 },
      { fieldName: "has_driving_license", value: true, source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:06:00Z", confidence: 0.98 },
      { fieldName: "driving_license_number", value: "DL9098", source: "voice", manuallyCorrected: false, timestamp: "2026-08-07T09:07:00Z", confidence: 0.85 },
    ],
    pdf: { status: "generated", url: "#", generatedAt: "2026-08-07T09:15:00Z" },
    email: { status: "sent", recipient: "ahmed@example.com", sentAt: "2026-08-07T09:16:00Z" },
    audit: [],
  },
  {
    id: "ENT-004",
    formId: employeeInfoForm.id,
    formName: employeeInfoForm.name,
    formVersion: 2,
    status: "awaiting_review",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-08T07:40:00Z",
    answers: [
      { fieldName: "full_name", value: "Meera Nair", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T07:41:00Z", confidence: 0.96 },
      { fieldName: "phone", value: "9822011223", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T07:42:00Z", confidence: 0.91 },
    ],
    pdf: { status: "not_generated" },
    email: { status: "not_sent", recipient: "" },
    audit: [],
  },
  {
    id: "ENT-005",
    formId: vehicleInspectionForm.id,
    formName: vehicleInspectionForm.name,
    formVersion: 1,
    status: "pdf_generated",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-06T11:00:00Z",
    submittedAt: "2026-08-06T11:10:00Z",
    answers: [
      { fieldName: "vehicle_number", value: "KA05 AB1234", source: "voice", manuallyCorrected: false, timestamp: "2026-08-06T11:01:00Z", confidence: 0.93 },
      { fieldName: "inspector_name", value: "Suresh Menon", source: "voice", manuallyCorrected: false, timestamp: "2026-08-06T11:02:00Z", confidence: 0.9 },
      { fieldName: "inspection_result", value: "pass", source: "voice", manuallyCorrected: false, timestamp: "2026-08-06T11:03:00Z", confidence: 0.95 },
    ],
    pdf: { status: "generated", url: "#", generatedAt: "2026-08-06T11:11:00Z" },
    email: { status: "pending", recipient: "fleet@northwind.example" },
    audit: [],
  },
  {
    id: "ENT-006",
    formId: driverRegistrationForm.id,
    formName: driverRegistrationForm.name,
    formVersion: 1,
    status: "in_progress",
    createdBy: "Priya Sharma",
    createdAt: "2026-08-08T08:05:00Z",
    answers: [
      { fieldName: "full_name", value: "Farhan Ali", source: "voice", manuallyCorrected: false, timestamp: "2026-08-08T08:06:00Z", confidence: 0.94 },
    ],
    pdf: { status: "not_generated" },
    email: { status: "not_sent", recipient: "" },
    audit: [],
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

export const dashboardStats: DashboardStats = {
  totalEntries: entries.length,
  completedEntries: entries.filter((e) =>
    ["submitted", "pdf_generated", "email_sent", "email_failed"].includes(
      e.status
    )
  ).length,
  pendingEntries: entries.filter((e) =>
    ["draft", "in_progress", "awaiting_review"].includes(e.status)
  ).length,
  emailsSent: entries.filter((e) => e.email.status === "sent").length,
  emailsFailed: entries.filter((e) => e.email.status === "failed").length,
};
