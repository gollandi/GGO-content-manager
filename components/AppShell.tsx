import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="plate grid min-h-screen grid-cols-[264px_1fr] max-lg:grid-cols-1">
      <Sidebar />
      <main className="relative flex flex-col overflow-x-hidden overflow-y-auto">{children}</main>
    </div>
  );
}
