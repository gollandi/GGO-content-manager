import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[280px_1fr] min-h-screen bg-surface-base lg:grid-cols-[280px_1fr] max-lg:grid-cols-1">
      <Sidebar />
      <main className="flex flex-col overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
