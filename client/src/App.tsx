import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import aceImg from "@/assets/ace.jpg";
function Header() {
  const [location] = useLocation();

  return (
    <header className="bg-black shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10  rounded-lg flex items-center justify-center">
                        <img 
                           src={aceImg} 
                           alt="Hard Hat" 
                           className="w-12 h-12 object-contain" 
                        />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold text-foreground">Acestone Development LLC</h1>
              <p className="text-white text-sm text-muted-foreground">Professional Contractors</p>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link href="/">
              <span className={`cursor-pointer ${
                location === "/" 
                  ? "text-primary font-medium border-b-2 border-primary pb-1" 
                  : "text-muted-foreground hover:text-primary transition-colors pb-1"
              }`}>
                Get Quote
              </span>
            </Link>
            <Link href="/admin">
              <span className={`cursor-pointer ${
                location === "/admin" 
                  ? "text-primary font-medium border-b-2 border-primary pb-1" 
                  : "text-muted-foreground hover:text-primary transition-colors pb-1"
              }`}>
                Admin Portal
              </span>
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
               <div className="w-15 h-15 rounded-lg flex items-center justify-center">
                       <img 
                           src={aceImg} 
                           alt="Hard Hat" 
                           className="w-12 h-12 object-contain" 
                        />
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
              <li>Electrical Wiring</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact Info</h4>
            <div className="space-y-2 text-sm text-neutral-400">
              <div>(929) 224-9148</div>
              <div>contact@acestonellc.com</div>
              <div>Licensed & Insured</div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-sm text-neutral-400">
          <p>&copy; 2025 Acestone Development LLC. All rights reserved.</p>
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
