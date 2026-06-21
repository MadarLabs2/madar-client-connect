import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, hydrated, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isManageRoute = pathname.startsWith("/manage/");

  if (!hydrated) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/login" />;
  if (!role) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background">
      {!isManageRoute ? <Header /> : null}
      <main className={isManageRoute ? "min-h-screen" : "mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10"}>
        <Outlet />
      </main>
    </div>
  );
}
