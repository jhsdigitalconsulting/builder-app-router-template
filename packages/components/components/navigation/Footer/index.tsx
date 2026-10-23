"use client";

import Image from "next/image";
import Link from "next/link";
import { getNavItems } from "../../../utils/navigation";
import { ModelReference, Navigation, SocialNetwork, Themeable } from "@repo/types";
import { resolveLinkHref } from "../../../utils/links";
import { socialNetworkIconStyles, SocialNetworkName } from "@repo/types/social";
import { useSiteContext } from "../../../contexts/SiteContextProvider";

interface FooterProps extends Themeable {
  logo?: string;
  navigation?: ModelReference;
  socialNetworks?: SocialNetwork[];
}

const defaultNavAttributes = {
  ownerId: "",
  lastUpdateBy: null,
  createdDate: 0,
  id: "default",
  "@version": 1,
  name: "Default Footer Navigation",
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

const defaultFooterNav: Navigation = {
  data: {
    level1: [
      { text: "Terms of Service", href: "/terms" },
      { text: "Privacy Policy", href: "/privacy" },
      { text: "Contact Us", href: "/contact" },
    ],
  },
  ...defaultNavAttributes,
};

const Footer = ({
  inheritTheme = false,
  theme = "dark",
  navigation,
  socialNetworks,
  logo,
}: FooterProps) => {
  const { siteContext } = useSiteContext();

  // An unset logo binds to the Site context's logo, then a placeholder. The
  // Builder SDK passes "" for an unset input, so coalesce with `||`.
  const logoSrc =
    logo ||
    siteContext?.data?.logo ||
    "https://placehold.co/400x100.png?text=Logo";

  const socialNav = socialNetworks || siteContext?.data?.socialNetworks || [];

  // Get navigation items with fallback
  const navItems = getNavItems(navigation, defaultFooterNav);

  return (
    <footer
      data-theme={theme}
      className="py-12 font-sans bg-theme-bg"
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center space-y-8">
          {/* Logo */}
          <Link href="/" className="block">
            <div className="relative w-40 md:w-[200px] h-[60px]">
              <Image
                src={logoSrc}
                alt={`${siteContext?.data?.siteName} Logo`}
                fill
                sizes="(min-width: 768px) 200px, 160px"
                style={{ objectFit: "contain" }}
                priority={false}
              />
            </div>
          </Link>

          {/* Logo and Navigation Row */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
            <nav>
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                {navItems.map((item) => (
                  <div className="disc-none" key={item.text}>
                    <Link
                      className="hover:text-theme-link text-theme-text"
                      href={resolveLinkHref(item.href, "/")}
                    >
                      {item.text}
                    </Link>
                  </div>
                ))}
              </div>
            </nav>
          </div>

          {/* Social Media Icons */}
          {socialNav && socialNav.length > 0 && (
            <div className="flex justify-center space-x-6 mb-8">
              {socialNav.map((social: SocialNetwork) => {
                const iconClass =
                  socialNetworkIconStyles[social.name as SocialNetworkName];
                if (!iconClass) return null; // Skip if network not supported

                return (
                  <a
                    key={social.name}
                    href={resolveLinkHref(social.href)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-theme-link text-theme-text"
                  >
                    <span className="sr-only">{social.name}</span>
                    <i className={`${iconClass} h-6 w-6 text-2xl`} />
                  </a>
                );
              })}
            </div>
          )}

          {/* Copyright */}
          <div className="text-sm text-theme-text">
            © {new Date().getFullYear()} {siteContext?.data?.organization?.name}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
export default Footer;
