import React from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Logo from './Logo';

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function MobileNav({ isOpen, onToggle, children }: MobileNavProps) {
  const location = useLocation();

  // Close menu when route changes
  React.useEffect(() => {
    if (isOpen) {
      onToggle();
    }
  }, [location.pathname]);

  return (
    <>
      {/* Header with logo and hamburger */}
      <div className="lg:hidden fixed top-0 right-0 left-0 h-16 bg-white shadow-md z-40 flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center">
          <Logo className="h-10 w-auto" />
        </div>

        {/* Hamburger button */}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label={isOpen ? 'סגור תפריט' : 'פתח תפריט'}
        >
          {isOpen ? (
            <X className="h-6 w-6 text-gray-900" />
          ) : (
            <Menu className="h-6 w-6 text-gray-900" />
          )}
        </button>
      </div>

      {/* Mobile navigation overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="absolute inset-0 bg-gray-800 opacity-50" onClick={onToggle} />
        <div 
          className="absolute inset-y-0 right-0 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out pt-20"
        >
          {children}
        </div>
      </div>
    </>
  );
}