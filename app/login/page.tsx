"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Guilloche } from "../../components/Registro";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="plate relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <Guilloche
        size={1000}
        rings={4}
        opacity={0.12}
        className="pointer-events-none absolute -right-72 -top-72 h-[1000px] w-[1000px]"
      />
      <Guilloche
        size={760}
        rings={3}
        opacity={0.09}
        className="pointer-events-none absolute -bottom-72 -left-64 h-[760px] w-[760px]"
      />
      <div className="relative w-full max-w-[380px]">{children}</div>
    </div>
  );
}

function LoginFallback() {
  return (
    <Plate>
      <p className="column-label text-center">Opening the register…</p>
    </Plate>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  const field =
    "w-full border border-paper-edge bg-transparent px-3 py-2.5 text-sm text-paper-foreground outline-none transition-colors placeholder:text-paper-foreground-soft focus:border-engraving-ink";

  return (
    <Plate>
      {/* The register's title page: a document, signed into. */}
      <div className="paper border border-paper-edge">
        <div className="border-b-[3px] border-double border-paper-edge px-8 pb-5 pt-7 text-center">
          <p className="column-label column-label-paper">Registro delle decisioni</p>
          <h1 className="document-title mt-2 text-[26px] text-paper-foreground">GGO Med</h1>
        </div>

        <div className="px-8 py-7">
          <button
            onClick={() => signIn("google", { callbackUrl })}
            type="button"
            className="flex w-full items-center justify-center gap-2.5 border border-paper-edge px-3 py-2.5 text-sm font-medium text-paper-foreground transition-colors hover:border-engraving-ink"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-paper-edge" />
            <span className="column-label column-label-paper">or</span>
            <span className="h-px flex-1 bg-paper-edge" />
          </div>

          <form onSubmit={handleCredentials}>
            <label className="column-label column-label-paper mb-1.5 block" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={field}
            />

            <label
              className="column-label column-label-paper mb-1.5 mt-4 block"
              htmlFor="login-password"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={field}
            />

            {error && (
              <p role="alert" className="mt-3 border border-seal px-3 py-2 text-[13px] text-seal">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="act-seal mt-6 w-full">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <div className="perforation-x" />
        <p className="px-8 py-3 text-center text-[11px] text-paper-foreground-soft">
          Every act in this register is attributable.
        </p>
      </div>
    </Plate>
  );
}
