import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Cashier from "@/pages/cashier";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Customers from "@/pages/customers";
import Suppliers from "@/pages/suppliers";
import Employees from "@/pages/employees";
import Invoices from "@/pages/invoices";
import Categories from "@/pages/categories";
import Payroll from "@/pages/payroll";
import Finance from "@/pages/finance";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Cashier} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/customers" component={Customers} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/employees" component={Employees} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/categories" component={Categories} />
      <Route path="/payroll" component={Payroll} />
      <Route path="/finance" component={Finance} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <div dir="rtl" className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
              <Router />
            </div>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
