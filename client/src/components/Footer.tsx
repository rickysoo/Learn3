import { Link } from "wouter";

// Safari-compatible SVG logo component
const Learn3Logo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg 
    viewBox="0 0 40 40" 
    className={`${className} rounded-lg shadow-lg`}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="footerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#3B82F6' }} />
        <stop offset="50%" style={{ stopColor: '#8B5CF6' }} />
        <stop offset="100%" style={{ stopColor: '#06B6D4' }} />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="8" fill="url(#footerLogoGradient)" />
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

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
              <Learn3Logo className="w-6 h-6" />
              <h1 className="text-xl font-bold text-white">
                Learn3
              </h1>
            </div>
          </Link>
        </div>
        <p className="text-slate-400 mb-4">
          Your personal video curator for learning anything, fast ⚡
        </p>
        <p className="text-slate-400 text-sm">
          💡 Want to dive deeper into AI? <a href="https://AICoach.my" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Learn AI</a>
        </p>
      </div>
    </footer>
  );
}