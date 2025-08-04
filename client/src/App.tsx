import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HardHat } from "lucide-react";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Header() {
  const [location] = useLocation();

  return (
    <header className="bg-white shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <HardHat className="text-primary-foreground text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Acestone Development LLC</h1>
              <p className="text-sm text-muted-foreground">Professional Contractors</p>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link href="/">
              <a className={`${
                location === "/" 
                  ? "text-primary font-medium border-b-2 border-primary pb-1" 
                  : "text-muted-foreground hover:text-primary transition-colors pb-1"
              }`}>
                Get Quote
              </a>
            </Link>
            <Link href="/admin">
              <a className={`${
                location === "/admin" 
                  ? "text-primary font-medium border-b-2 border-primary pb-1" 
                  : "text-muted-foreground hover:text-primary transition-colors pb-1"
              }`}>
                Admin Portal
              </a>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-neutral-900 text-white py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <HardHat className="text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">Acestone Development LLC</h3>
            </div>
            <p className="text-neutral-400 text-sm mb-4">
              Professional contractors delivering quality home renovations with expert craftsmanship and reliable service.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>Kitchen Remodeling</li>
              <li>Bathroom Renovation</li>
              <li>Interior Painting</li>
              <li>Flooring Installation</li>
              <li>Roofing Services</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact Info</h4>
            <div className="space-y-2 text-sm text-neutral-400">
              <div>(555) 123-STONE</div>
              <div>admin@acestonedev.com</div>
              <div>Licensed & Insured</div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-sm text-neutral-400">
          <p>&copy; 2024 Acestone Development LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
            <Router />
          </main>
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
