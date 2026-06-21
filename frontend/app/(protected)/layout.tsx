import { Sidebar } from "@/components/sidebar";
import { MobileHeader, MobileBottomNav } from "@/components/mobile-nav";

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <MobileHeader />
    <div className="flex flex-1 min-h-0">
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-auto min-w-0 pb-16 md:pb-0">
        {children}
      </main>
    </div>
    <MobileBottomNav />
  </>
);
export default ProtectedLayout;
