"use client";

import Link from "next/link";
import { useState } from "react";
import { Level1Item, Level2Item } from "@repo/types";
import { resolveLinkHref } from "../../../utils/links";

interface MobileMenuProps {
  items: Level1Item[];
  isOpen: boolean;
  onClose: () => void;
}

const linkClasses =
  "block font-bold text-[11px] tracking-[2.2px] uppercase transition-colors";

const MobileMenu = ({ items, isOpen, onClose }: MobileMenuProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subExpanded, setSubExpanded] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const toggle = (text: string) =>
    setExpanded((current) => (current === text ? null : text));
  const toggleSub = (text: string) =>
    setSubExpanded((current) => (current === text ? null : text));

  const chevron = (open: boolean) => (
    <svg
      className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
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
  );

  return (
    <nav className="lg:hidden border-t pt-4 pb-4">
      <ul className="flex flex-col space-y-1">
        {items.map((item) => {
          const hasDropdown = !!(item.level2 && item.level2.length > 0);
          const isItemOpen = expanded === item.text;

          return (
            <li key={item.text}>
              {hasDropdown ? (
                <>
                  <button
                    onClick={() => toggle(item.text)}
                    aria-expanded={isItemOpen}
                    className={`${linkClasses} w-full flex items-center justify-between py-2`}
                    style={{ color: "var(--theme-text)" }}
                  >
                    {item.text}
                    {chevron(isItemOpen)}
                  </button>
                  {isItemOpen && (
                    <ul className="pl-4 flex flex-col space-y-1">
                      {item.level2!.map((level2Item: Level2Item) => {
                        const hasSub =
                          level2Item.level3 && level2Item.level3.length > 0;
                        const isSubOpen = subExpanded === level2Item.text;

                        return (
                          <li key={level2Item.text}>
                            {hasSub ? (
                              <>
                                <button
                                  onClick={() => toggleSub(level2Item.text)}
                                  aria-expanded={isSubOpen}
                                  className="w-full flex items-center justify-between py-2 text-sm transition-colors"
                                  style={{ color: "var(--theme-text)" }}
                                >
                                  {level2Item.text}
                                  {chevron(isSubOpen)}
                                </button>
                                {isSubOpen && (
                                  <ul className="pl-4 flex flex-col space-y-1">
                                    {level2Item.level3!.map((level3Item) => (
                                      <li key={level3Item.text}>
                                        <Link
                                          href={resolveLinkHref(level3Item.href)}
                                          className="block py-2 text-sm transition-colors"
                                          style={{ color: "var(--theme-text)" }}
                                          onClick={onClose}
                                        >
                                          {level3Item.text}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            ) : (
                              <Link
                                href={resolveLinkHref(level2Item.href)}
                                className="block py-2 text-sm transition-colors"
                                style={{ color: "var(--theme-text)" }}
                                onClick={onClose}
                              >
                                {level2Item.text}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  href={resolveLinkHref(item.href, "/")}
                  className={`${linkClasses} py-2`}
                  style={{ color: "var(--theme-text)" }}
                  onClick={onClose}
                >
                  {item.text}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export { MobileMenu };
export default MobileMenu;
