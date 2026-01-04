import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface NavLinkProps {
  icon: LucideIcon;
  href: string;
  text: string;
}

export function NavLink({ icon: Icon, href, text }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-2 rounded-sm text-sm transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
    >
      <Icon />
      {text}
    </Link>
  );
}
