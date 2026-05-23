import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, profile, role, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="font-display text-2xl tracking-tight text-foreground">
          Madar
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {profile?.name || user.email} · <span className="capitalize">{role}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  nav({ to: "/login" });
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/login" className="text-sm font-medium text-foreground hover:opacity-70">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
