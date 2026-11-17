import Image from "next/image";

type CollabLogoProps = {
  className?: string;
  eager?: boolean;
  sizes?: string;
};

export function CollabLogo({
  className = "",
  eager = false,
  sizes = "(max-width: 640px) 10rem, 14rem",
}: CollabLogoProps) {
  return (
    <Image
      src="/brand/collab-logo.png"
      alt="COLLAB Lumiar"
      width={437}
      height={135}
      loading={eager ? "eager" : "lazy"}
      sizes={sizes}
      className={`h-auto ${className}`}
    />
  );
}
