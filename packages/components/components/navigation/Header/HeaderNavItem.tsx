"use client";

import Link from "next/link";
import { Level1Item, Level2Item } from "@repo/types";
import { resolveLinkHref } from "../../../utils/links";

interface HeaderNavItemProps {
  item: Level1Item;
  onNavigate: () => void;
}

const linkStyle = {
  color: "var(--theme-text)" as const,
};

const HeaderNavItem = ({ item, onNavigate }: HeaderNavItemProps) => {
  const hasDropdown = !!(item.level2 && item.level2.length > 0);

  const topLinkClass =
    "font-bold text-[11px] tracking-[2.2px] uppercase transition-colors hover:text-[color:var(--theme-link)]";

  return (
    <div className="relative group">
      {hasDropdown ? (
        <button
          className={`flex items-center gap-1 p-0 bg-transparent border-0 cursor-pointer ${topLinkClass}`}
          style={linkStyle}
        >
          <span>{item.text}</span>
          <svg
            className="w-4 h-4 transition-transform group-hover:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <Link
          href={resolveLinkHref(item.href, "/")}
          className={`flex items-center ${topLinkClass}`}
          style={linkStyle}
          onClick={onNavigate}
        >
          {item.text}
        </Link>
      )}

      {hasDropdown && (
        <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md min-w-[220px] z-[9999]">
          {item.level2!.map((level2Item: Level2Item) => {
            const hasLevel3 = !!(level2Item.level3 && level2Item.level3.length > 0);

            return (
              <div key={level2Item.text} className="relative group/sub">
                {hasLevel3 ? (
                  <>
                    <button
                      className="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-gray-50 hover:text-[color:var(--theme-link)]"
                      style={linkStyle}
                    >
                      {level2Item.href ? (
                        <Link href={resolveLinkHref(level2Item.href)} onClick={onNavigate} className="flex-1 text-left">
                          {level2Item.text}
                        </Link>
                      ) : (
                        <span className="flex-1 text-left">{level2Item.text}</span>
                      )}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="hidden group-hover/sub:block absolute top-0 left-full ml-1 bg-white border border-gray-200 shadow-lg rounded-md min-w-[220px] z-[9999]">
                      {level2Item.level3!.map((level3Item) => (
                        <Link
                          key={level3Item.text}
                          href={resolveLinkHref(level3Item.href)}
                          className="block px-4 py-2 text-sm transition-colors hover:bg-gray-50 hover:text-[color:var(--theme-link)]"
                          style={linkStyle}
                          onClick={onNavigate}
                        >
                          {level3Item.text}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <Link
                    href={resolveLinkHref(level2Item.href)}
                    className="block px-4 py-2 text-sm transition-colors hover:bg-gray-50 hover:text-[color:var(--theme-link)]"
                    style={linkStyle}
                    onClick={onNavigate}
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

export { HeaderNavItem };
export default HeaderNavItem;
