import { AuthButton } from "@/components/AuthButton";
import { Link } from "wouter";

// Safari-compatible SVG logo component
const Learn3Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg 
    viewBox="0 0 40 40" 
    className={`${className} rounded-lg shadow-lg`}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#3B82F6' }} />
        <stop offset="50%" style={{ stopColor: '#8B5CF6' }} />
        <stop offset="100%" style={{ stopColor: '#06B6D4' }} />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="8" fill="url(#logoGradient)" />
    <text 
      x="20" 
      y="28" 
      textAnchor="middle" 
      fill="white" 
      fontSize="18" 
      fontWeight="bold" 
      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    >
      L3
    </text>
  </svg>
);

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <Link href="/">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer">
              <Learn3Logo className="w-8 h-8 sm:w-10 sm:h-10" />
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">Learn3</h1>
            </div>
          </Link>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}