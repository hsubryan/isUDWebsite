'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function MarketingHeader() {
  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Services', href: '/services' },
    { label: 'Process', href: '/process' },
    { label: 'Resources', href: '/resources' },
    { label: 'About', href: '/about' },
    { label: 'Account', href: '/register' },
  ];

  return (
    <header className="w-full bg-white border-b border-slate-200">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex justify-between items-center h-24">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="isUD - Innovative solutions for Universal Design"
                width={283}
                height={118}
                className="h-14 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Navigation Section */}
          <nav className="hidden md:flex items-center space-x-10">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[15px] font-semibold text-primary hover:text-secondary transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
