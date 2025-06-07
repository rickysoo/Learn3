import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center space-x-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-lg text-slate-600">
          Finding perfect videos for your learning journey...
        </span>
      </div>
    </div>
  );
}
