import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";
import { AuthGuard } from "@/components/common/AuthGuard";
import { AppSettingsEffects } from "@/components/layout/AppSettingsEffects";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppSettingsEffects />
      <div className="flex h-screen overflow-hidden bg-[#fafbfe]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
          <Footer />
        </div>
      </div>
    </AuthGuard>
  );
}
