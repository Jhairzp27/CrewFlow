import { createClient } from "@/utils/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AppNavbar } from "@/components/AppNavbar";
import { AdminOnboarding } from "@/components/AdminOnboarding";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let onboardingDismissed = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_dismissed")
      .eq("id", user.id)
      .single();
    onboardingDismissed = profile?.onboarding_dismissed ?? false;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user?.email} role="admin" />
      <AppNavbar role="admin" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      <AdminOnboarding dismissed={onboardingDismissed} />
    </div>
  );
}
