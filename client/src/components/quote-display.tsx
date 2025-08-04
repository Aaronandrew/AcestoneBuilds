import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/pricing";

interface QuoteDisplayProps {
  quote: number;
  jobType: string;
  squareFootage: number;
  urgency: string;
}

export function QuoteDisplay({ quote, jobType, squareFootage, urgency }: QuoteDisplayProps) {
  if (quote <= 0) return null;

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-foreground">Estimated Quote</h4>
            <p className="text-sm text-muted-foreground">Based on your project details</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(quote)}
            </div>
            <p className="text-sm text-muted-foreground">Starting estimate</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-primary/20">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Job Type:</span>
              <div className="font-medium">{jobType}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Square Feet:</span>
              <div className="font-medium">{squareFootage}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Priority:</span>
              <div className="font-medium">{urgency}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
