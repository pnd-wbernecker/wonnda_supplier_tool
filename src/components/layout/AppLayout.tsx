import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Sidebar />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
