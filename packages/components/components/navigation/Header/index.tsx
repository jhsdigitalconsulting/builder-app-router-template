"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ModelReference, Navigation, Themeable } from "@repo/types";
import { getNavItems } from "../../../utils/navigation";
import { useSiteContext } from "../../../contexts/SiteContextProvider";
import { HeaderNavItem } from "./HeaderNavItem";
import { MobileMenu } from "./MobileMenu";

interface HeaderProps extends Themeable {
  logo?: string;
  navigation?: ModelReference;
}

const defaultNavigation: Navigation = {
  data: {
    level1: [
      { text: "Home", href: "/" },
      { text: "About", href: "/about" },
      { text: "Services", href: "/services" },
      { text: "Blog", href: "/blog" },
      { text: "Contact", href: "/contact" },
    ],
  },
  ownerId: "",
  lastUpdateBy: null,
  createdDate: 0,
  id: "default",
  "@version": 1,
  name: "Default Navigation",
  modelId: "navigation",
  published: "published",
  priority: 0,
  query: [],
  lastUpdated: 0,
  firstPublished: 0,
  testRatio: 0,
  createdBy: "",
  lastUpdatedBy: "",
};

const Header = ({ navigation, logo, theme = "light" }: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = getNavItems(navigation, defaultNavigation);

  const { siteContext } = useSiteContext();

  // An unset logo binds to the Site context's logo, then a placeholder. The
  // Builder SDK passes "" for an unset input, which bypasses JS default
  // parameters, so coalesce with `||` and never hand next/image an empty src.
  const logoSrc =
    logo ||
    siteContext?.data?.logo ||
    "https://placehold.co/400x100.png?text=Logo";

  return (
    <header
      data-theme={theme}
      className="font-primary border-b border-gray-200"
      style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)" }}
    >
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo (left) */}
          <Link href="/" className="block shrink-0">
            <div className="relative w-[160px] h-[44px]">
              <Image
                src={logoSrc}
                alt={`${siteContext?.data?.siteName} Logo`}
                width={160}
                height={44}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation (right) */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <HeaderNavItem
                key={item.text}
                item={item}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </nav>

          {/* Hamburger (mobile) */}
          <button
            className="lg:hidden p-2"
            style={{ color: "var(--theme-text)" }}
            aria-label="Menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  isMobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                }
              />
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        <MobileMenu
          items={navItems}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      </div>
    </header>
  );
};

export { Header };
export default Header;
