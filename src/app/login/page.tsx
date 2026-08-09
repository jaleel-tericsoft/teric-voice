import Link from "next/link";
import { Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-canvas p-3">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl bg-background shadow-sm ring-1 ring-black/[0.03] lg:grid-cols-2">
        {/* Brand side */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b1f33] p-10 text-white lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,0.1), transparent 60%)",
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-lime text-lime-foreground">
              <Mic className="size-4" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-bold tracking-tight">
              TericVoice
            </span>
          </div>
          <div className="relative flex flex-col gap-3">
            <div className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-white/5">
              <Mic className="size-6 text-white/70" />
            </div>
            <h2 className="text-2xl font-bold leading-snug">
              Forms that fill
              <br />
              themselves — by voice.
            </h2>
            <p className="max-w-xs text-sm text-white/50">
              Ask the questions once. Let the assistant listen, interpret,
              and populate the form in real time.
            </p>
          </div>
          <p className="relative text-xs text-white/30">
            © 2026 TericVoice. All rights reserved.
          </p>
        </div>

        {/* Form side */}
        <div className="flex flex-col justify-center gap-6 p-8 sm:p-12">
          <div className="flex flex-col gap-1.5 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-lime text-lime-foreground">
                <Mic className="size-4" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] font-bold tracking-tight">
                TericVoice
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your organization workspace.
            </p>
          </div>

          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                defaultValue="priya@northwind.example"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Password
                </Label>
                <Link href="#" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                defaultValue="••••••••"
                className="h-11 rounded-xl"
              />
            </div>
            <Button asChild className="mt-2 h-11 rounded-full text-sm">
              <Link href="/dashboard">Sign in</Link>
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an organization yet?{" "}
            <Link href="#" className="font-medium text-foreground hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
