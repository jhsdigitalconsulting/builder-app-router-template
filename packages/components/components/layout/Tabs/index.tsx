"use client";

import {
  Blocks,
  type BuilderBlock,
  type BuilderContextInterface,
} from "@builder.io/sdk-react";
import { useState } from "react";
import { Themeable, getThemeClasses, Heroic, Stylable, LinkValue } from "@repo/types";
import { resolveLinkHref } from "../../../utils/links";

export interface TabItem {
  headline: string;
  content?: { blocks: BuilderBlock[] };
  type: "content" | "link";
  href?: LinkValue;
}

interface TabsProps extends Themeable, Heroic, Stylable {
  tabs: TabItem[];
  builderBlock?: BuilderBlock;
  builderContext?: BuilderContextInterface;
}

export const Tabs = ({ tabs = [], theme = "light", builderBlock, builderContext, headline, isHero = false, className }: TabsProps) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const TitleTag = isHero ? "h1" : "h2";

  if (!tabs || tabs.length === 0) {
    return (
      <section className={`tabs w-full ${getThemeClasses(theme)}`}>
        <div className="container mx-auto py-8 lead">
          {headline && (
            <TitleTag>
              {headline}
            </TitleTag>
          )}
          <div className="text-center text-theme-text">
            No tabs configured. Please add tabs in the Builder.io editor.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`tabs w-full ${getThemeClasses(theme)} ${className}`}>
      <div className="container mx-auto py-8">
        {headline && (
          <TitleTag>
            {headline}
          </TitleTag>
        )}
        {/* Always show horizontal tabs */}
        <div className="mb-8">
          <div role="tablist" className="flex flex-wrap border-b border-theme-btn-outlined-border bg-theme-bg justify-start items-start">
            {tabs.map((tab, index) =>
              tab.type === "link" ? (
                <a
                  key={index}
                  href={resolveLinkHref(tab.href)}
                  className="px-6 py-4 text-sm font-medium whitespace-nowrap text-theme-text hover:text-theme-heading transition-colors duration-200"
                >
                  {tab.headline}
                </a>
              ) : (
                <button
                  key={index}
                  role="tab"
                  onClick={() => setActiveTab(index)}
                  aria-label={tab.headline}
                  aria-selected={activeTab === index}
                  className={`px-6 py-1 h-auto self-center text-sm font-medium whitespace-nowrap border-b-2 rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-theme-focus
                    ${
                      activeTab === index
                        ? "border-theme-btn-bg text-theme-btn-text bg-theme-btn-bg font-semibold shadow-sm"
                        : "border-transparent text-theme-text hover:text-theme-btn-hover-text hover:border-theme-btn-outlined-border hover:bg-theme-btn-hover-bg"
                    }`}
                >
                  {tab.headline}
                </button>
              )
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="min-h-[200px]">
          {tabs.map(
            (tab, index) =>
              tab.type === "content" && (
                <div
                  key={index}
                  role="tabpanel"
                  aria-hidden={activeTab !== index}
                  className={`tab-content transition-opacity duration-300 ${
                    activeTab === index ? "block opacity-100" : "hidden opacity-0"
                  }`}
                >
                  <Blocks
                    parent={builderBlock?.id}
                    path={`component.options.tabs.${index}.content.blocks`}
                    blocks={tab.content?.blocks || []}
                    context={builderContext}
                  />
                </div>
              )
          )}
        </div>
      </div>
    </section>
  );
};

export default Tabs;
