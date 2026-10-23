import { FC } from "react";
import Image from "next/image";
import { Themeable, Alignable, TextAlignments, LinkValue } from "@repo/types";
import Button from "../../ui/Button";
import { ThemeProvider } from "../../common/ThemeProvider";

interface CardImageCTAProps extends Themeable, Alignable {
  image: string;
  eyebrow: string;
  title: string;
  buttonLabel?: string;
  buttonHref?: LinkValue;
  className?: string;
}

const alignmentClasses: Record<TextAlignments, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
} as const;

const CardImageCTA: FC<CardImageCTAProps> = ({
  image,
  eyebrow,
  title,
  buttonLabel,
  buttonHref = "#",
  alignment = "center",
  theme = "light",
  inheritTheme = false,
  className = "",
}) => {
  // Helper function to extract URL from Builder.io file object or string
  const getImageUrl = (imageFile: any): string => {
    if (!imageFile) return "";
    if (typeof imageFile === "string") return imageFile;
    if (imageFile && typeof imageFile === "object" && imageFile.url)
      return imageFile.url;
    return imageFile;
  };

  const imageUrl = getImageUrl(image);

  const content = (
    <div
      className={`component-card flex flex-col rounded-lg overflow-hidden bg-theme-bg text-theme-text ${className}`}
    >
      {/* Image */}
      {imageUrl && (
        <div className="aspect-[4/3] w-full overflow-hidden relative">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 380px) 100vw, 380px"
          />
        </div>
      )}

      {/* Content */}
      <div
        className={`p-6 flex flex-col flex-grow ${alignmentClasses[alignment]}`}
      >
        {/* Eyebrow */}
        <h6 className="mb-2 text-sm font-semibold uppercase tracking-wide text-theme-heading-alt">
          {eyebrow}
        </h6>

        {/* Title */}
        <h3 className="mb-4 text-xl font-bold leading-tight flex-grow text-theme-heading">
          {title}
        </h3>

        {/* Button */}
        {buttonLabel && (
          <Button label={buttonLabel} href={buttonHref} inheritTheme={true} />
        )}
      </div>
    </div>
  );

  // Only wrap in ThemeProvider if we have an explicit theme and inheritTheme is false
  if (inheritTheme || !theme) {
    return content;
  }

  return (
    <ThemeProvider theme={theme} inheritTheme={false}>
      {content}
    </ThemeProvider>
  );
};

export { CardImageCTA };
export default CardImageCTA;
