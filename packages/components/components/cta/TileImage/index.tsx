import { FC } from "react";
import Image from "next/image";
import { Themeable, Alignable, TextAlignments, Heroic, LinkValue } from "@repo/types";
import Button from "../../ui/Button";
import { ThemeProvider } from "../../common/ThemeProvider";

interface TileImageProps extends Themeable, Alignable, Heroic {
  image: string;
  content: string;
  buttonLabel?: string;
  buttonHref?: LinkValue;
  className?: string;
}

const alignmentClasses: Record<TextAlignments, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
} as const;

const TileImage: FC<TileImageProps> = ({
  image,
  headline,
  content,
  buttonLabel,
  buttonHref = "#",
  alignment = "center",
  theme = "light",
  inheritTheme = false,
  className = "",
  isHero = false,
}) => {
  // Helper function to extract URL from Builder.io file object or string
  const getImageUrl = (imageFile: any): string => {
    if (!imageFile) return "https://placehold.co/600x400/EEE/31343C.png";
    if (typeof imageFile === "string") return imageFile;
    if (imageFile && typeof imageFile === "object" && imageFile.url)
      return imageFile.url;
    return imageFile;
  };

  const imageUrl = getImageUrl(image);

  const HeadlineTag = isHero ? "h6" : "h1";

  const componentContent = (
    <div
      className={`component-tile ${isHero ? 'hero-tile' : ''} relative overflow-hidden ${className}`}
    >
      {/* Background Image - Full Coverage */}
      <div className="absolute inset-0 m-6">
        <Image
          src={imageUrl}
          alt={headline || "Image Alt Text"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Content Overlay Box - Positioned at Top with Padding */}
      <div className="relative ml-2 mt-10 w-4/5 max-w-96 border-2 shadow-lg">
        <div
          className={`p-6 rounded-lg shadow-lg bg-theme-bg text-theme-text ${alignmentClasses[alignment]}`}
        >
          {/* Title */}
          <HeadlineTag>
            {headline}
          </HeadlineTag>

          {/* Description */}
          <div
            className="mb-4 text-base leading-relaxed text-theme-text"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Button */}
          {buttonLabel && (
            <Button label={buttonLabel} href={buttonHref} inheritTheme={true} />
          )}
        </div>
      </div>
    </div>
  );

  // Only wrap in ThemeProvider if we have an explicit theme and inheritTheme is false
  if (inheritTheme || !theme) {
    return componentContent;
  }

  return (
    <ThemeProvider theme={theme} inheritTheme={false}>
      {componentContent}
    </ThemeProvider>
  );
};

export { TileImage };
export default TileImage;