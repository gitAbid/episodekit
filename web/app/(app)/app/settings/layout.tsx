import Link from "next/link";

const TABS = [
  { href: "/app/settings/show", label: "Show" },
  { href: "/app/settings/voice", label: "Voice" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings/account", label: "Account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <nav className="flex gap-4 border-b text-sm" aria-label="Settings sections">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="pb-2">
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
