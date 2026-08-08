"use client";

import { useState } from "react";
import { Building2, Mic, Mail, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { organization } from "@/lib/mock-data";

const sections = [
  { id: "general", label: "General", icon: Building2 },
  { id: "voice", label: "Voice & AI", icon: Mic },
  { id: "email", label: "Email", icon: Mail },
  { id: "pdf", label: "PDF", icon: FileText },
] as const;

type SectionId = (typeof sections)[number]["id"];

export default function SettingsPage() {
  const [active, setActive] = useState<SectionId>("general");

  return (
    <div className="flex flex-col gap-5 pt-6 pb-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Organization, voice, email, and document configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === active;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-[17px]" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-border/60 bg-card p-6">
          {active === "general" && <GeneralSection />}
          {active === "voice" && <VoiceSection />}
          {active === "email" && <EmailSection />}
          {active === "pdf" && <PdfSection />}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SaveBar() {
  return (
    <div className="mt-8 flex justify-end border-t border-border/60 pt-5">
      <Button className="rounded-full">Save Changes</Button>
    </div>
  );
}

function GeneralSection() {
  return (
    <div>
      <SectionHeader
        title="General"
        description="Organization identity and defaults."
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Organization Name">
          <Input defaultValue={organization.name} className="rounded-xl" />
        </Field>
        <Field label="Default Email">
          <Input defaultValue={organization.defaultEmail} className="rounded-xl" />
        </Field>
        <Field label="Timezone">
          <Select defaultValue={organization.timezone}>
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
              <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
              <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
              <SelectItem value="America/New_York">America/New_York (ET)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Organization Logo">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground">
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
            <Button variant="secondary" size="sm" className="rounded-full">
              Upload
            </Button>
          </div>
        </Field>
      </div>
      <SaveBar />
    </div>
  );
}

function VoiceSection() {
  return (
    <div>
      <SectionHeader
        title="Voice & AI"
        description="Tune how the assistant listens and interprets answers."
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Voice Language">
          <Select defaultValue="en-IN">
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-IN">English (India)</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="hi-IN">Hindi</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Confidence Threshold">
          <Input type="number" defaultValue={85} min={0} max={100} className="rounded-xl" />
        </Field>
      </div>
      <div className="mt-5">
        <Field label="AI Configuration Notes">
          <Textarea
            className="rounded-xl"
            rows={4}
            defaultValue="Ask clarifying questions when confidence is below the threshold. Never guess sensitive fields like license numbers."
          />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <div>
          <div className="text-sm font-medium text-foreground">
            Ask for confirmation on low-confidence answers
          </div>
          <div className="text-xs text-muted-foreground">
            Recommended — avoids silently guessing critical information.
          </div>
        </div>
        <Switch defaultChecked />
      </div>
      <SaveBar />
    </div>
  );
}

function EmailSection() {
  return (
    <div>
      <SectionHeader
        title="Email"
        description="Sender identity used across all form email configurations."
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Sender Name">
          <Input defaultValue={organization.name} className="rounded-xl" />
        </Field>
        <Field label="Sender Email">
          <Input defaultValue={organization.defaultEmail} className="rounded-xl" />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <div>
          <div className="text-sm font-medium text-foreground">
            Auto-retry failed deliveries
          </div>
          <div className="text-xs text-muted-foreground">
            Retries once after 15 minutes before marking as failed.
          </div>
        </div>
        <Switch defaultChecked />
      </div>
      <SaveBar />
    </div>
  );
}

function PdfSection() {
  return (
    <div>
      <SectionHeader
        title="PDF"
        description="Default document layout applied unless a form overrides it."
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Header Text">
          <Input defaultValue={`${organization.name} — Submission`} className="rounded-xl" />
        </Field>
        <Field label="Footer Text">
          <Input defaultValue="Generated by Voxform" className="rounded-xl" />
        </Field>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
          <span className="text-sm font-medium text-foreground">Show organization logo</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
          <span className="text-sm font-medium text-foreground">Page numbering</span>
          <Switch defaultChecked />
        </div>
      </div>
      <SaveBar />
    </div>
  );
}
