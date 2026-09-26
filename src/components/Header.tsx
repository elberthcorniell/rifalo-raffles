"use client";

import { Button } from "@/components/ui/button";
import { Menu, Ticket } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrgBrand } from "@/components/OrgBrandProvider";

const Header = () => {
  const router = useRouter();
  const brand = useOrgBrand();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleVerifyTickets = () => {
    router.push('/verify-tickets');
    setIsMenuOpen(false);
  };

  return (
    <header
      className={brand.theme === 'custom' ? 'border-b sticky top-0 z-50' : 'bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50'}
      style={brand.theme === 'custom' ? { backgroundColor: brand.themeColors.background, borderColor: brand.themeColors.foreground + '29', color: brand.themeColors.foreground } : undefined}
    >
      <div className="container mx-auto px-4 py-3">
        {/* Mobile Layout */}
        <div className="flex items-center justify-between md:hidden">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">Menú</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-6 mt-8">
                <Button 
                  className="justify-start bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  onClick={handleVerifyTickets}
                >
                  <Ticket className="w-4 h-4 mr-2" />
                  Verificar Boletos
                </Button>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Mobile Logo */}
          <div className="flex-1 flex justify-center">
            <img 
              src={brand.logo}
              alt={`${brand.name} Logo`}
              className="h-20 w-auto animate-fade-in"
            />
          </div>

          {/* Spacer for mobile layout balance */}
          <div className="w-10" />
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between">
          {/* Left spacer */}
          <div className="flex-1" />

          {/* Centered Logo */}
          <div className="flex justify-center items-center flex-1">
            <img 
              src={brand.logo}
              alt={`${brand.name} Logo`}
              className="h-16 w-auto animate-fade-in"
            />
          </div>

          {/* Right Buttons */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            <Button 
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary font-semibold"
              onClick={handleVerifyTickets}
            >
              <Ticket className="w-4 h-4 mr-2" />
              Verificar Boletos
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
