import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-12 py-6 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} WeBoard</span>
          <Link href="/changelog" className="hover:text-[var(--primary)] transition-colors">
            Changelog
          </Link>
        </div>
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Powered by BoardGameGeek
        </a>
      </div>
    </footer>
  );
}
