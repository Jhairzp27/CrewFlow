import { createClient } from "@/utils/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AppNavbar } from "@/components/AppNavbar";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user?.email} role="employee" />
      <AppNavbar role="employee" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
