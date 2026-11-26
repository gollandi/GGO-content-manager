"use client";

import { Guilloche } from "./Registro";

/** The bare title-page plate used by the sign-in and invitation screens. */
export function Plate({ children }: { children: React.ReactNode }) {
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
