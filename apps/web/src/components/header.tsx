"use client";
import { Activity } from "lucide-react";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/doctors", label: "Doctors" },
  ] as const;

  return (
    <header className="border-border border-b bg-card">
      <div className="flex flex-row items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link className="flex items-center gap-2" href="/">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-5" />
            </span>
            <span className="font-bold text-lg">MediBook</span>
          </Link>
          <nav className="flex gap-6 text-sm">
            {links.map(({ to, label }) => {
              return (
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href={to}
                  key={to}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
