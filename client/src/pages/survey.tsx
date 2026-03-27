import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, Loader2 } from "lucide-react";

interface SurveyInfo {
  leadId: string;
  customerName: string;
  jobType: string;
  alreadyCompleted: boolean;
}

export default function Survey() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;

  const [surveyInfo, setSurveyInfo] = useState<SurveyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/survey/${leadId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Survey not found");
        return res.json();
      })
      .then((data) => {
        setSurveyInfo(data);
        if (data.alreadyCompleted) setSubmitted(true);
      })
      .catch(() => setError("This survey link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [leadId]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/survey/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Thank You!</h2>
            <p className="text-muted-foreground">
              We appreciate your feedback, {surveyInfo?.customerName}. Your response helps us improve our services.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const jobLabel = surveyInfo?.jobType
    ? surveyInfo.jobType.charAt(0).toUpperCase() + surveyInfo.jobType.slice(1)
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">How Did We Do?</CardTitle>
          <p className="text-muted-foreground">
            Hi {surveyInfo?.customerName}! We'd love to hear about your {jobLabel} project experience with Acestone Development.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Star Rating */}
          <div className="text-center">
            <p className="text-sm font-medium mb-3">Rate your experience</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="transition-transform hover:scale-110"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
              </p>
            )}
          </div>

          {/* Feedback */}
          <div>
            <p className="text-sm font-medium mb-2">Tell us more (optional)</p>
            <Textarea
              placeholder="What went well? What could we improve?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            disabled={rating === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
