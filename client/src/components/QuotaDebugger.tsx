import { useState, useEffect } from "react";

interface QuotaUsage {
  totalUnits: number;
  byKey: Array<{
    keyIndex: number;
    units: number;
    calls: number;
  }>;
}

export function QuotaDebugger() {
  const [quotaData, setQuotaData] = useState<QuotaUsage | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchQuotaData = async () => {
      try {
        const response = await fetch('/api/quota-usage');
        if (response.ok) {
          const data = await response.json();
          setQuotaData(data);
        }
      } catch (error) {
        console.error('Failed to fetch quota data:', error);
      }
    };

    fetchQuotaData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchQuotaData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!quotaData) return null;

  const quotaPercentage = Math.round((quotaData.totalUnits / 40000) * 100);
  const remainingQuota = 40000 - quotaData.totalUnits;

  return (
    <div className="fixed bottom-0 right-0 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-slate-800 text-white text-xs px-2 py-1 rounded-tl-md opacity-30 hover:opacity-70 transition-opacity"
        title="API Quota Debug Info"
      >
        API
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div className="bg-slate-900 text-white text-xs p-3 max-w-xs border-l border-t border-slate-700">
          <div className="mb-2">
            <div className="font-semibold mb-1">Daily YouTube API Quota</div>
            <div className="flex justify-between">
              <span>Used:</span>
              <span className={quotaPercentage > 80 ? 'text-red-400' : quotaPercentage > 60 ? 'text-yellow-400' : 'text-green-400'}>
                {quotaData.totalUnits.toLocaleString()} / 40,000 ({quotaPercentage}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span>{remainingQuota.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-semibold">Per API Key:</div>
            {quotaData.byKey.map((key) => (
              <div key={key.keyIndex} className="flex justify-between text-slate-300">
                <span>Key {key.keyIndex + 1}:</span>
                <span>{key.units} units ({key.calls} calls)</span>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400">
            <div>Search: 100 units | Details: 1 unit/video</div>
            <div>~{Math.floor(remainingQuota / 115)} searches remaining</div>
          </div>
        </div>
      )}
    </div>
  );
}