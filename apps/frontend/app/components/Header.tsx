import Link from "next/link";

export default function Header() {
  const navItems = [
    { label: "Home", href: "#" },
    { label: "Features", href: "#" },
    { label: "Pricing", href: "#" },
    { label: "Resources", href: "#" },
  ];

  return (
    <header className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 fixed top-0 left-0 right-0 z-50 bg-white">
      <nav className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <div className="flex flex-col text-xl font-bold hover:text-neutral-600 transition-colors cursor-pointer">Likeable</div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-black text-sm lg:text-base font-normal hover:text-neutral-600 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link href="/sign-in">
          <button
          className="px-4 sm:px-5 lg:px-6 py-2 sm:py-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-black text-sm sm:text-base font-normal transition-colors cursor-pointer"
          aria-label="Sign in"
          >
            Sign in
          </button>
        </Link>
      </nav>
    </header>
  );
}

