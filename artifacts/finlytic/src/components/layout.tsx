import { Link, useLocation } from "wouter";
import { AreaChart, BrainCircuit, Activity, BarChart3, LineChart } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground font-semibold hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="tracking-tight text-xl">Finlytic</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link 
              href="/" 
              className={`hover:text-foreground transition-colors ${location === "/" ? "text-foreground" : ""}`}
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4">
          <p>Finlytic Workspace &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
