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
