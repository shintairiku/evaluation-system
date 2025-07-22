import Header from "@/components/display/header";
import Sidebar from "@/components/display/sidebar";

export default function EvaluationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main className="ml-[64px] min-w-0">
        <div className="mt-[45px]">
          {children}
        </div>
      </main>
    </div>
  );
}