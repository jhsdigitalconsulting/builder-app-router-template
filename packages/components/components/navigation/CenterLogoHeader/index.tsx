"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Navigation, Level1Item, Level2Item } from "@repo/types";
import { resolveLinkHref } from "../../../utils/links";
import { useSiteContext } from "../../../contexts/SiteContextProvider";

interface CenterLogoHeaderProps {
  logo?: string;
  navigation1?: Navigation;
  navigation2?: Navigation;
}

const defaultNavAttributes = {
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

const defaultPrimaryNav: Navigation = {
  data: {
    level1: [
      { text: "Home", href: "/" },
      { text: "About", href: "/about" },
      { text: "Services", href: "/services" },
    ],
  },
  ...defaultNavAttributes,
};

const defaultSecondaryNav: Navigation = {
  data: {
    level1: [
      { text: "Blog", href: "/blog" },
      { text: "Contact", href: "/contact" },
    ],
  },
  ...defaultNavAttributes,
};

const CenterLogoHeader = ({
  navigation1: primaryNav = defaultPrimaryNav,
  navigation2: secondaryNav = defaultSecondaryNav,
  logo,
}: CenterLogoHeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openSubDropdown, setOpenSubDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get navigation items for both sides with fallbacks
  const leftNavItems = (primaryNav || defaultPrimaryNav).data.level1;
  const rightNavItems = (secondaryNav || defaultSecondaryNav).data.level1;

  // Combine items for mobile menu
  const mobileNavItems = [...leftNavItems, ...rightNavItems];

  // The Builder SDK passes "" for an unset string input, which bypasses JS
  // default parameters (those only apply to `undefined`). Coalesce any
  // empty/undefined value so next/image never receives an empty src.
  const logoSrc = logo || "https://placehold.co/400x100.png?text=Logo";

  const { siteContext } = useSiteContext();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
        setOpenSubDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDropdownToggle = (itemText: string) => {
    setOpenDropdown(openDropdown === itemText ? null : itemText);
    setOpenSubDropdown(null);
  };

  const handleSubDropdownToggle = (itemText: string) => {
    setOpenSubDropdown(openSubDropdown === itemText ? null : itemText);
  };

  const renderNavItem = (item: Level1Item, side: "left" | "right") => {
    const hasDropdown = item.level2 && item.level2.length > 0;
    const isOpen = openDropdown === item.text;

    return (
      <div key={item.text} className="relative group">
        {hasDropdown ? (
          <button
            onClick={() => handleDropdownToggle(item.text)}
            className="flex items-center font-bold text-[11px] tracking-[2.2px] uppercase transition-colors"
            style={{ color: 'var(--theme-text)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-link)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
          >
            {item.text}
            <svg
              className={`ml-1 w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        ) : (
          <Link
            href={resolveLinkHref(item.href, "/")}
            className="font-bold text-[11px] tracking-[2.2px] uppercase transition-colors"
            style={{ color: 'var(--theme-text)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-link)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
          >
            {item.text}
          </Link>
        )}

        {hasDropdown && isOpen && (
          <div
            className={`absolute top-full mt-2 bg-white border border-gray-200 shadow-lg rounded-md min-w-[280px] z-[9999] ${
              side === "right" ? "right-0" : "left-0"
            }`}
          >
            {item.level2!.map((level2Item: Level2Item) => {
              const hasSubDropdown =
                level2Item.level3 && level2Item.level3.length > 0;
              const isSubOpen = openSubDropdown === level2Item.text;

              return (
                <div key={level2Item.text} className="relative">
                  {hasSubDropdown ? (
                    <>
                      <button
                        onClick={() => handleSubDropdownToggle(level2Item.text)}
                        className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: 'var(--theme-text)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-link)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
                      >
                        {level2Item.text}
                        <svg
                          className={`w-4 h-4 transition-transform ${isSubOpen ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                      {isSubOpen && (
                        <div
                          className={`absolute top-0 bg-white border border-gray-200 shadow-lg rounded-md min-w-[280px] z-[9999] ${
                            side === "right"
                              ? "right-full mr-2"
                              : "left-full ml-2"
                          }`}
                        >
                          {level2Item.level3!.map((level3Item) => (
                            <Link
                              key={level3Item.text}
                              href={resolveLinkHref(level3Item.href)}
                              className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                              style={{ color: 'var(--theme-text)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-link)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
                              onClick={() => {
                                setOpenDropdown(null);
                                setOpenSubDropdown(null);
                              }}
                            >
                              {level3Item.text}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={resolveLinkHref(level2Item.href)}
                      className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                      style={{ color: 'var(--theme-text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-link)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
                      onClick={() => {
                        setOpenDropdown(null);
                        setOpenSubDropdown(null);
                      }}
                    >
                      {level2Item.text}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <header data-theme="light" className="font-primary border-b-[5px] border-gray-200" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="max-w-[1200px] mx-auto px-4">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between h-20">
          {/* Hamburger Menu Button */}
          <button
            className="p-2"
            style={{ color: 'var(--theme-text)' }}
            aria-label="Menu"
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

          {/* Mobile Logo */}
          <Link href="/" className="block">
            <div className="relative w-32 h-[40px]">
              <Image
                src={logoSrc}
                alt={`${siteContext?.data?.siteName} Logo`}
                width={128}
                height={40}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                priority
              />
            </div>
          </Link>

          <div className="w-10"></div>
        </div>

        {/* Desktop Header */}
        <div
          className="hidden lg:flex items-center justify-center h-[89px] relative"
          ref={dropdownRef}
        >
          {/* Left Navigation */}
          <nav className="absolute left-0 flex items-center space-x-8">
            {leftNavItems.map((item) => renderNavItem(item, "left"))}
          </nav>

          {/* Center Logo */}
          <Link href="/" className="block">
            <div className="relative w-[200px] h-[60px]">
              <Image
                src={logoSrc}
                alt={`${siteContext?.data?.siteName} Logo`}
                width={200}
                height={60}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
                priority
              />
            </div>
          </Link>

          {/* Right Navigation */}
          <nav className="absolute right-0 flex items-center space-x-8">
            {rightNavItems.map((item) => renderNavItem(item, "right"))}
          </nav>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav className="lg:hidden border-t pt-4 pb-4">
            <ul className="flex flex-col space-y-4">
              {mobileNavItems.map((item) => (
                <li key={item.text}>
                  <Link
                    href={resolveLinkHref(item.href, "/")}
                    className="block font-bold text-[11px] tracking-[2.2px] uppercase transition-colors"
                    style={{ color: 'var(--theme-text)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-link)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
};

export { CenterLogoHeader };
export default CenterLogoHeader;
