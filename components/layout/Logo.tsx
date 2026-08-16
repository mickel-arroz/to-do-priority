import Image from "next/image";

/** Project brand mark (public/logo.png). Size it with a `size-*` class. */
export function Logo({
  className,
  size = 24,
}: {
  className?: string;
  /** Intrinsic px rendered by next/image; also set a matching size-* class */
  size?: number;
}) {
  return (
    <Image
      src="/logo.png"
      alt="To-Do Priority"
      width={size}
      height={size}
      className={className}
    />
  );
}
