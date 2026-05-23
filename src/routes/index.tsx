import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, hydrated, role } = useAuth();
  if (!hydrated) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/login" />;
  if (!role) return <div className="min-h-screen bg-background" />;
  return <Navigate to={role === "admin" ? "/admin" : "/dashboard"} />;
}
