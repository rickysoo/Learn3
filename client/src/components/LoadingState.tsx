import { Loader2, Search, Brain, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

export function LoadingState() {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { icon: Search, text: "Searching YouTube for educational videos..." },
    { icon: Brain, text: "AI analyzing content for topic relevance..." },
    { icon: CheckCircle, text: "Creating your personalized learning path..." }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center py-16">
      <div className="max-w-md mx-auto">
        <div className="inline-flex items-center space-x-3 mb-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg text-slate-600">
            Creating your learning path...
          </span>
        </div>
        
        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div
                key={index}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-500 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isCompleted
                    ? "bg-green-50 text-green-600"
                    : "text-slate-400"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "animate-pulse" : ""}`} />
                <span className="text-sm font-medium">{step.text}</span>
                {isCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 text-xs text-slate-500">
          This may take 10-15 seconds for the best results
        </div>
      </div>
    </div>
  );
}
