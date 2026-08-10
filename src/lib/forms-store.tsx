"use client";

// A session-only, in-memory store for forms. There's no backend yet, so a
// form created via the Form Builder flow lives only in this React context —
// it shows up immediately across Form Builder, Entries, and Dashboard for
// the rest of the session, but won't survive a full page reload.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { forms as seedForms } from "@/lib/mock-data";
import type { FormDefinition, FormStatus } from "@/types";

interface FormsStore {
  forms: FormDefinition[];
  addForm: (form: FormDefinition) => void;
  updateForm: (id: string, patch: Partial<FormDefinition>) => void;
  setFormStatus: (id: string, status: FormStatus) => void;
  getFormByFormId: (formId: string) => FormDefinition | undefined;
}

const FormsContext = createContext<FormsStore | null>(null);

export function FormsProvider({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<FormDefinition[]>(seedForms);

  const value = useMemo<FormsStore>(
    () => ({
      forms,
      addForm: (form) => setForms((prev) => [...prev, form]),
      updateForm: (id, patch) =>
        setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))),
      setFormStatus: (id, status) =>
        setForms((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status, updatedAt: new Date().toISOString() } : f
          )
        ),
      getFormByFormId: (formId) => forms.find((f) => f.formId === formId),
    }),
    [forms]
  );

  return <FormsContext.Provider value={value}>{children}</FormsContext.Provider>;
}

export function useFormsStore(): FormsStore {
  const ctx = useContext(FormsContext);
  if (!ctx) throw new Error("useFormsStore must be used within <FormsProvider>");
  return ctx;
}
