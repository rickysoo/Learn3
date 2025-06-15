import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <Link href="/">
            <h1 className="text-xl font-bold text-white hover:text-blue-200 cursor-pointer transition-colors">
              Learn3
            </h1>
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