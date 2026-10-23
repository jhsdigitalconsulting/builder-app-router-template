import React from "react";
import Link from "next/link";
import { ThemeProvider } from "../../common/ThemeProvider";
import type { CMSLinkProps, LinkValue, Themeable, Stylable } from "@repo/types";
import { resolveLinkHref, shouldOpenInNewTab, isExternalHref } from "../../../utils/links";

interface DynamicLinkComponentProps extends Themeable, Stylable {
  link?: LinkValue;
  label?: string;
  children?: React.ReactNode;
  openInNewTab?: boolean;
  title?: string;
  ariaLabel?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const DynamicLink = ({
  link,
  label,
  children,
  className = "",
  openInNewTab,
  title,
  ariaLabel,
  onClick,
  theme = "light",
  inheritTheme = true,
}: DynamicLinkComponentProps) => {
  const href = resolveLinkHref(link);
  const newTab = shouldOpenInNewTab(link, openInNewTab);
  const isExternal = isExternalHref(href);

  const linkProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
    className,
    title,
    onClick,
    ...(ariaLabel && { "aria-label": ariaLabel }),
    ...(newTab || isExternal
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {}),
  };

  const content = label ?? children;

  const linkElement = (
    <Link href={href} {...linkProps}>
      {content}
    </Link>
  );

  if (inheritTheme !== false) return linkElement;

  return (
    <ThemeProvider theme={theme} inheritTheme={false}>
      {linkElement}
    </ThemeProvider>
  );
};

export default DynamicLink;
export type { DynamicLinkComponentProps as DynamicLinkProps, CMSLinkProps };
