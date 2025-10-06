import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "h-12 w-auto" }: LogoProps) {
  return (
    <img
      src="https://ppgfqntelptocxijdhya.supabase.co/storage/v1/object/public/logo//logo.png.png"
      alt="ניקיון ואחזקה בע״מ"
      className={className}
    />
  );
}