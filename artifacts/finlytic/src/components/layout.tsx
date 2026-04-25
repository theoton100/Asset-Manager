import { Link, useLocation } from "wouter";
import { BarChart3, GitCompare } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/40 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground font-semibold hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="tracking-tight text-xl">Finlytic</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm font-medium text-muted-foreground">
            <Link
              href="/"
              className={`px-2 py-1 hover:text-foreground transition-colors ${
                location === "/" ? "text-foreground" : ""
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/compare"
              className={`px-2 py-1 hover:text-foreground transition-colors flex items-center gap-1.5 ${
                location.startsWith("/compare") ? "text-foreground" : ""
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 print:py-4 print:max-w-none">
        {children}
      </main>
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground print:hidden">
        <div className="max-w-6xl mx-auto px-4">
          <p>Finlytic Workspace &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
