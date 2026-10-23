type SpinnerSize =
  | "xs"
  | "sm"
  | "md"
  | "lg";

type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
  label?: string;
};

const sizeClasses: Record<
  SpinnerSize,
  string
> = {
  xs: "h-3.5 w-3.5 border-2",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-[3px]",
  lg: "h-10 w-10 border-4",
};

export function Spinner({
  size = "sm",
  className = "",
  label = "Yuklanmoqda",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={[
        "inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent",
        sizeClasses[size],
        className,
      ].join(" ")}
    />
  );
}

export function LoadingLabel({
  children,
}: {
  children: string;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner size="sm" />
      <span>{children}</span>
    </span>
  );
}
