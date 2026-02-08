import Link, { type LinkProps } from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkProps extends LinkProps {
  icon: LucideIcon;
  href: string;
  text: string;
  className?: string;
}

export function NavLink({ icon: Icon, href, text, className, ...props }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2 rounded-sm text-sm transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
        className
      )}
      {...props}
    >
      <Icon />
      {text}
    </Link>
  );
}
