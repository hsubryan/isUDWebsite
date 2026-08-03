import ProjectTable from "@/components/ProjectTable";
import AdminPendingApprovalsBanner from "@/components/AdminPendingApprovalsBanner";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-96px-200px)] flex flex-col items-center justify-start bg-slate-50">
      <AdminPendingApprovalsBanner />
      <ProjectTable />
    </div>
  );
}
