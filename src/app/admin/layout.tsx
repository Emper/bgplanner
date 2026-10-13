import { redirect, notFound } from "next/navigation";
import { getSession, isSuperadmin } from "@/lib/auth";
import AdminNavbar from "@/components/AdminNavbar";

export const metadata = {
  title: "BG Planner · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // /auth no existe (solo /auth/verify): sin sesión, a entrar y de vuelta aquí
  if (!session) redirect("/login?redirect=/admin");
  if (!(await isSuperadmin(session))) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNavbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
