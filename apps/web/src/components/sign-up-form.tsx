"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#1877F2"
        d="M24 12c0-6.63-5.37-12-12-12S0 5.37 0 12c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08V12h3.05V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38C19.61 22.95 24 17.99 24 12Z"
      />
    </svg>
  );
}

function SocialButtons() {
  const handleSocial = async (provider: "google" | "facebook") => {
    await authClient.signIn.oauth2(
      { providerId: provider, callbackURL: "/dashboard" },
      {
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => handleSocial("google")}
        >
          <GoogleGlyph />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => handleSocial("facebook")}
        >
          <FacebookGlyph />
          Continue with Facebook
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
      role: "patient" as "patient" | "doctor",
      specialty: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
          role: value.role,
          specialty: value.role === "doctor" ? value.specialty : undefined,
        },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Sign up successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        role: z.enum(["patient", "doctor"]),
        specialty: z.string(),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-[440px] px-4">
      <Card className="rounded-lg ring-border">
        <CardHeader className="items-center gap-2 text-center">
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <CardDescription>Join MediBook as a patient or a doctor</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <SocialButtons />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="role">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>I am a</Label>
                  <select
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value as "patient" | "doctor")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                  </select>
                </div>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.role}>
              {(role) =>
                role === "doctor" ? (
                  <form.Field name="specialty">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Specialty</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          placeholder="e.g. Cardiology"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>

            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Password</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Create account"}
                </Button>
              )}
            </form.Subscribe>

            <p className="text-center text-xs text-muted-foreground">
              New accounts default to the Patient role.
            </p>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button variant="link" size="sm" className="px-0" onClick={onSwitchToSignIn}>
              Sign In
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
