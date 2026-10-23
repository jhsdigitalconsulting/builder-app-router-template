import { FC } from "react";
import Button from "../../ui/Button";
import { Themeable, Alignable, TextAlignments, Heroic, LinkValue } from "@repo/types";
import { ThemeProvider } from "../../common/ThemeProvider";

interface TileCTAProps extends Themeable, Alignable, Heroic {
  eyebrow?: string;
  content?: string;
  buttonLabel?: string;
  buttonHref?: LinkValue;
  className?: string;
  maskOpacity?: number;
}

const alignmentClasses: Record<TextAlignments, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
} as const;

const TileCTA: FC<TileCTAProps> = ({
  eyebrow = "Hey Genius!",
  headline = "Let's Launch Your Day Dream",
  isHero = false,
  content,
  buttonLabel,
  buttonHref = "#",
  alignment = "center",
  theme,
  inheritTheme = false,
  className = "",
  maskOpacity = 0,
}) => {
  return (
    <div className="relative">
      {maskOpacity > 0 && (
        <div
          className={`absolute inset-0 bg-black z-0`}
          style={{ opacity: maskOpacity }}
        />
      )}
      <ThemeProvider
        theme={theme}
        inheritTheme={inheritTheme}
        className={`component-tile ${isHero ? "hero-tile" : ""} flex flex-col p-8 relative z-10 ${alignmentClasses[alignment]} ${className}`}
      >
        {eyebrow && <h5 className="text-theme-heading-alt">{eyebrow}</h5>}
        {isHero ? (
          <h1 className="text-theme-heading">{headline}</h1>
        ) : (
          <h2 className="text-theme-heading">{headline}</h2>
        )}
        {content && (
          <div
            className="mb-8 leading-relaxed text-theme-text"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
        {buttonLabel && (
          <Button href={buttonHref} label={buttonLabel} inheritTheme={true} />
        )}
      </ThemeProvider>
    </div>
  );
};

export { TileCTA };
export default TileCTA;
