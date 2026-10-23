import { FC } from "react";
import { Themeable, LinkValue } from "@repo/types";
import { resolveLinkHref, shouldOpenInNewTab } from "../../../utils/links";
import { ThemeProvider } from "../../common/ThemeProvider";

interface ButtonProps extends Themeable {
  label: string;
  href?: LinkValue;
  className?: string;
  onClick?: () => void;
  outlined?: boolean;
}

const Button: FC<ButtonProps> = ({
  label,
  href,
  className = "",
  theme,
  inheritTheme = true,
  outlined = false,
  onClick,
}) => {
  const resolvedHref = resolveLinkHref(href);
  const newTabProps = shouldOpenInNewTab(href)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  const buttonClasses = outlined 
    ? "btn btn-outlined"
    : "btn btn-primary";

  // Only use ThemeProvider when explicitly requested with inheritTheme=false
  if (inheritTheme !== false) {
    // Inherit theme from parent - no ThemeProvider wrapper needed
    return (
      <a
        href={resolvedHref}
        {...newTabProps}
        className={`${buttonClasses} ${className}`}
        onClick={onClick}
      >
        {label}
      </a>
    );
  }

  // Use ThemeProvider only when inheritTheme is explicitly false
  return (
    <ThemeProvider theme={theme} inheritTheme={false}>
      <a
        href={resolvedHref}
        {...newTabProps}
        className={`${buttonClasses} ${className}`}
        onClick={onClick}
      >
        {label}
      </a>
    </ThemeProvider>
  );
};

export { Button };
export default Button;
