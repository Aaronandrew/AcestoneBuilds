import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Calendar, Phone, Mail, CheckCircle, Clock,
  Camera, FileText, Star, ChevronRight, MessageSquare,
  Hammer, ClipboardCheck, User, MapPin, ImageIcon, ExternalLink, RefreshCw,
} from "lucide-react";
import { formatCurrency, JOB_TYPE_LABELS } from "@/lib/pricing";
import {
  CRM_STAGES, CRM_STAGE_LABELS, CRM_STAGE_COLORS,
  type Lead, type CrmData, type CrmStage, type CrmTimelineEvent,
} from "@shared/schema";

interface CrmLeadDetailProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCrmUpdate: (leadId: string, crmData: CrmData) => void;
}

function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CrmLeadDetail({ lead, open, onOpenChange, onCrmUpdate }: CrmLeadDetailProps) {
  const { toast } = useToast();
  const crm: CrmData = lead.crmData || { crmStatus: "new_lead", timeline: [] };
  const currentStage = crm.crmStatus || "new_lead";
  const currentIndex = CRM_STAGES.indexOf(currentStage);

  // Local form state for stage-specific inputs
  const [calendlyLink, setCalendlyLink] = useState(crm.calendlyLink || "");
  const [meetingDate, setMeetingDate] = useState(crm.meetingDate || "");
  const [meetingNotes, setMeetingNotes] = useState(crm.meetingNotes || "");
  const [meetingTranscript, setMeetingTranscript] = useState(crm.meetingTranscript || "");
  const [detailedEstimate, setDetailedEstimate] = useState(crm.detailedEstimate || lead.quote || "");
  const [contractAmount, setContractAmount] = useState(crm.contractAmount || lead.quote || "");
  const [contractDepositPercent, setContractDepositPercent] = useState(crm.contractDepositPercent || "25");
  const [contractNotes, setContractNotes] = useState(crm.contractNotes || "");
  const [jobStartDate, setJobStartDate] = useState(crm.jobStartDate || "");
  const [jobEndDate, setJobEndDate] = useState(crm.jobEndDate || "");
  const [assignedWorker, setAssignedWorker] = useState(crm.assignedWorker || "");
  const [completionNotes, setCompletionNotes] = useState(crm.completionNotes || "");
  const [surveyRating, setSurveyRating] = useState(crm.surveyRating || 0);
  const [surveyFeedback, setSurveyFeedback] = useState(crm.surveyFeedback || "");
  const [resendConfirm, setResendConfirm] = useState<string | null>(null);

  // Sync local state when lead changes
  useEffect(() => {
    const c = lead.crmData || { crmStatus: "new_lead", timeline: [] };
    setCalendlyLink(c.calendlyLink || "");
    setMeetingDate(c.meetingDate || "");
    setMeetingNotes(c.meetingNotes || "");
    setMeetingTranscript(c.meetingTranscript || "");
    setDetailedEstimate(c.detailedEstimate || lead.quote || "");
    setContractAmount(c.contractAmount || lead.quote || "");
    setContractDepositPercent(c.contractDepositPercent || "25");
    setContractNotes(c.contractNotes || "");
    setJobStartDate(c.jobStartDate || "");
    setJobEndDate(c.jobEndDate || "");
    setAssignedWorker(c.assignedWorker || "");
    setCompletionNotes(c.completionNotes || "");
    setSurveyRating(c.surveyRating || 0);
    setSurveyFeedback(c.surveyFeedback || "");
  }, [lead]);

  // Helper to build updated CRM with new timeline event
  function buildCrm(
    updates: Partial<CrmData>,
    eventText: string,
    actor: string = "admin"
  ): CrmData {
    const newEvent: CrmTimelineEvent = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      date: new Date().toISOString(),
      stage: (updates.crmStatus || currentStage) as CrmStage,
      event: eventText,
      actor,
    };
    return {
      ...crm,
      ...updates,
      timeline: [...(crm.timeline || []), newEvent],
    };
  }

  function save(updates: Partial<CrmData>, eventText: string, toastMsg?: string) {
    const updated = buildCrm(updates, eventText);
    onCrmUpdate(lead.id, updated);
    if (toastMsg) toast({ title: toastMsg });
  }

  // === STAGE ACTIONS ===

  const handleSendCalendly = () => {
    if (!calendlyLink) {
      toast({ title: "Enter Calendly link first", variant: "destructive" });
      return;
    }
    save(
      { crmStatus: "calendly_sent", calendlyLink, calendlySentAt: new Date().toISOString() },
      `Calendly link sent to ${lead.email}`,
      "Calendly link sent"
    );
  };

  const handleBookMeeting = () => {
    if (!meetingDate) {
      toast({ title: "Set meeting date first", variant: "destructive" });
      return;
    }
    save(
      { crmStatus: "meeting_booked", meetingDate, meetingBookedAt: new Date().toISOString() },
      `Meeting booked for ${new Date(meetingDate).toLocaleString()}`,
      "Meeting booked"
    );
  };

  const handleCompleteMeeting = () => {
    save(
      { crmStatus: "meeting_completed", meetingNotes, meetingTranscript },
      "Meeting completed — notes saved",
      "Meeting marked complete"
    );
  };

  const handleSendEstimate = () => {
    save(
      { crmStatus: "estimate_sent", detailedEstimate, estimateSentAt: new Date().toISOString() },
      `Detailed estimate of ${formatCurrency(parseFloat(detailedEstimate))} sent`,
      "Estimate sent"
    );
  };

  const handleSendContract = () => {
    save(
      {
        crmStatus: "contract_sent",
        contractAmount, contractDepositPercent, contractNotes,
        contractSentAt: new Date().toISOString(),
      },
      `Contract for ${formatCurrency(parseFloat(contractAmount))} sent for signature`,
      "Contract sent"
    );
  };

  const handleContractSigned = () => {
    save(
      { crmStatus: "contract_signed", contractSignedAt: new Date().toISOString(), jobStartDate, jobEndDate },
      "Customer signed the contract",
      "Contract signed!"
    );
  };

  const handleStartJob = () => {
    save(
      { crmStatus: "job_in_progress", assignedWorker, jobStartDate: jobStartDate || new Date().toISOString().split("T")[0] },
      `Job started${assignedWorker ? ` — assigned to ${assignedWorker}` : ""}`,
      "Job started"
    );
  };

  const handleCompleteJob = () => {
    save(
      { crmStatus: "job_completed", completionNotes, completionDate: new Date().toISOString() },
      "Job completed — pending survey",
      "Job marked complete"
    );
  };

  const handleRequestSurvey = () => {
    save(
      { crmStatus: "pending_survey" },
      `Survey request sent to ${lead.email}`,
      "Survey requested"
    );
  };

  const handleSubmitSurvey = () => {
    save(
      { crmStatus: "closed", surveyRating, surveyFeedback, surveyCompletedAt: new Date().toISOString() },
      `Survey completed — ${surveyRating}/5 stars`,
      "Job closed successfully!"
    );
  };

  const handleMoveToStage = (stage: CrmStage) => {
    save(
      { crmStatus: stage },
      `Manually moved to ${CRM_STAGE_LABELS[stage]}`
    );
  };

  const handleResend = (stage: string) => {
    switch (stage) {
      case "calendly_sent":
        save(
          { crmStatus: "calendly_sent", calendlyLink, calendlySentAt: new Date().toISOString() },
          `Calendly link resent to ${lead.email}`,
          "Calendly link resent"
        );
        break;
      case "estimate_sent":
        save(
          { crmStatus: "estimate_sent", detailedEstimate, estimateSentAt: new Date().toISOString() },
          `Estimate resent to ${lead.email}`,
          "Estimate resent"
        );
        break;
      case "contract_sent":
        save(
          { crmStatus: "contract_sent", contractAmount, contractDepositPercent, contractNotes, contractSentAt: new Date().toISOString() },
          `Contract resent to ${lead.email}`,
          "Contract resent"
        );
        break;
      case "pending_survey":
        save(
          { crmStatus: "pending_survey" },
          `Survey resent to ${lead.email}`,
          "Survey resent"
        );
        break;
    }
    setResendConfirm(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{lead.fullName}</SheetTitle>
          <SheetDescription>
            {JOB_TYPE_LABELS[lead.jobType as keyof typeof JOB_TYPE_LABELS]} · {lead.squareFootage} sq ft · {formatCurrency(parseFloat(lead.quote))}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info Bar */}
          <div className="flex flex-wrap gap-3">
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors">
              <Phone className="h-3 w-3" /> {formatPhone(lead.phone)}
            </a>
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
              <Mail className="h-3 w-3" /> {lead.email}
            </a>
            {lead.source && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full">
                <ExternalLink className="h-3 w-3" /> {lead.source.charAt(0).toUpperCase() + lead.source.slice(1)}
              </span>
            )}
          </div>

          {/* Pipeline Progress */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Pipeline Stage</Label>
            <div className="flex flex-wrap gap-1">
              {CRM_STAGES.map((stage, i) => {
                const isActive = stage === currentStage;
                const isPast = i < currentIndex;
                const color = CRM_STAGE_COLORS[stage];
                return (
                  <button
                    key={stage}
                    onClick={() => handleMoveToStage(stage)}
                    className={`text-[10px] px-2 py-1 rounded-full font-medium transition-all border
                      ${isActive ? `${color} ring-2 ring-offset-1 ring-primary/30` : isPast ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"}`}
                    title={`Move to ${CRM_STAGE_LABELS[stage]}`}
                  >
                    {CRM_STAGE_LABELS[stage]}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Stage-Specific Actions */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Current Stage Actions
              <Badge className={CRM_STAGE_COLORS[currentStage]} variant="secondary">
                {CRM_STAGE_LABELS[currentStage]}
              </Badge>
            </h4>

            {/* NEW LEAD */}
            {currentStage === "new_lead" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Send a Calendly link to schedule a consultation.</p>
                  <div>
                    <Label htmlFor="calendly-link" className="text-xs">Calendly URL</Label>
                    <Input
                      id="calendly-link"
                      value={calendlyLink}
                      onChange={(e) => setCalendlyLink(e.target.value)}
                      placeholder="https://calendly.com/your-link"
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleSendCalendly} size="sm">
                    <Send className="mr-2 h-3 w-3" /> Send Calendly Link
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* CALENDLY SENT */}
            {currentStage === "calendly_sent" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Calendly link sent{crm.calendlySentAt ? ` on ${new Date(crm.calendlySentAt).toLocaleString()}` : ""}. Set the meeting date when the customer books.
                  </p>
                  <div>
                    <Label htmlFor="meeting-date" className="text-xs">Meeting Date & Time</Label>
                    <Input
                      id="meeting-date"
                      type="datetime-local"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleBookMeeting} size="sm">
                      <Calendar className="mr-2 h-3 w-3" /> Mark Meeting Booked
                    </Button>
                    <Button onClick={() => setResendConfirm("calendly_sent")} size="sm" variant="outline">
                      <RefreshCw className="mr-2 h-3 w-3" /> Resend Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* MEETING BOOKED */}
            {currentStage === "meeting_booked" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Meeting scheduled for {crm.meetingDate ? new Date(crm.meetingDate).toLocaleString() : "TBD"}.
                    After the meeting, add notes and optionally a transcript.
                  </p>
                  <div>
                    <Label htmlFor="meeting-notes" className="text-xs">Meeting Notes</Label>
                    <Textarea
                      id="meeting-notes"
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="Job details discussed, customer preferences, site conditions..."
                      rows={3}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div>
                    <Label htmlFor="meeting-transcript" className="text-xs">Recording Transcript (optional)</Label>
                    <Textarea
                      id="meeting-transcript"
                      value={meetingTranscript}
                      onChange={(e) => setMeetingTranscript(e.target.value)}
                      placeholder="Paste Calendly/Zoom transcript here..."
                      rows={3}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <Button onClick={handleCompleteMeeting} size="sm">
                    <CheckCircle className="mr-2 h-3 w-3" /> Complete Meeting
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* MEETING COMPLETED */}
            {currentStage === "meeting_completed" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Meeting completed. Review notes and send a detailed estimate.
                  </p>
                  {crm.meetingNotes && (
                    <div className="p-2 bg-muted rounded text-xs">
                      <strong>Notes:</strong> {crm.meetingNotes}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="detailed-estimate" className="text-xs">Detailed Estimate ($)</Label>
                    <Input
                      id="detailed-estimate"
                      type="number"
                      value={detailedEstimate}
                      onChange={(e) => setDetailedEstimate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleSendEstimate} size="sm">
                    <Send className="mr-2 h-3 w-3" /> Send Estimate
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ESTIMATE SENT */}
            {currentStage === "estimate_sent" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Estimate of {formatCurrency(parseFloat(crm.detailedEstimate || lead.quote))} sent. Prepare and send contract for digital signature.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="contract-amt" className="text-xs">Contract Amount ($)</Label>
                      <Input id="contract-amt" type="number" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="deposit-pct" className="text-xs">Deposit %</Label>
                      <Input id="deposit-pct" type="number" value={contractDepositPercent} onChange={(e) => setContractDepositPercent(e.target.value)} className="mt-1" min="0" max="100" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="scope" className="text-xs">Scope of Work / Terms</Label>
                    <Textarea id="scope" value={contractNotes} onChange={(e) => setContractNotes(e.target.value)} placeholder="Materials, labor breakdown, timeline, payment terms..." rows={3} className="mt-1 resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSendContract} size="sm">
                      <FileText className="mr-2 h-3 w-3" /> Send Contract
                    </Button>
                    <Button onClick={() => setResendConfirm("estimate_sent")} size="sm" variant="outline">
                      <RefreshCw className="mr-2 h-3 w-3" /> Resend Estimate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CONTRACT SENT */}
            {currentStage === "contract_sent" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Contract for {formatCurrency(parseFloat(crm.contractAmount || lead.quote))} sent{crm.contractSentAt ? ` on ${new Date(crm.contractSentAt).toLocaleString()}` : ""}. Waiting for customer signature.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="start-date" className="text-xs">Job Start Date</Label>
                      <Input id="start-date" type="date" value={jobStartDate} onChange={(e) => setJobStartDate(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-xs">Est. Completion</Label>
                      <Input id="end-date" type="date" value={jobEndDate} onChange={(e) => setJobEndDate(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleContractSigned} size="sm">
                      <CheckCircle className="mr-2 h-3 w-3" /> Mark Contract Signed
                    </Button>
                    <Button onClick={() => setResendConfirm("contract_sent")} size="sm" variant="outline">
                      <RefreshCw className="mr-2 h-3 w-3" /> Resend Contract
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CONTRACT SIGNED */}
            {currentStage === "contract_signed" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Contract signed{crm.contractSignedAt ? ` on ${new Date(crm.contractSignedAt).toLocaleDateString()}` : ""}.
                    Assign a worker and start the job. Worker should take before photos on-site.
                  </p>
                  <div>
                    <Label htmlFor="worker" className="text-xs">Assigned Worker</Label>
                    <Input id="worker" value={assignedWorker} onChange={(e) => setAssignedWorker(e.target.value)} placeholder="Worker name" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Job Start</Label>
                      <Input type="date" value={jobStartDate} onChange={(e) => setJobStartDate(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Est. Completion</Label>
                      <Input type="date" value={jobEndDate} onChange={(e) => setJobEndDate(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-md border border-amber-200">
                    <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                      <Camera className="h-3 w-3" /> Reminder: Worker should take BEFORE photos on arrival
                    </p>
                  </div>
                  <Button onClick={handleStartJob} size="sm">
                    <Hammer className="mr-2 h-3 w-3" /> Start Job
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* JOB IN PROGRESS */}
            {currentStage === "job_in_progress" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Job in progress{crm.assignedWorker ? ` — ${crm.assignedWorker}` : ""}.
                    On completion, worker should take after photos and fill out the completion form.
                  </p>
                  {/* Before Photos display */}
                  {crm.beforePhotos && crm.beforePhotos.length > 0 && (
                    <div>
                      <Label className="text-xs">Before Photos ({crm.beforePhotos.length})</Label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {crm.beforePhotos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={`Before ${i + 1}`} className="w-16 h-16 object-cover rounded border" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="completion-notes" className="text-xs">Completion Notes</Label>
                    <Textarea
                      id="completion-notes"
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="Work performed, materials used, issues encountered, warranty info..."
                      rows={4}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div className="p-3 bg-cyan-50 rounded-md border border-cyan-200">
                    <p className="text-xs text-cyan-800 font-medium flex items-center gap-1">
                      <Camera className="h-3 w-3" /> Reminder: Worker should take AFTER photos before leaving
                    </p>
                  </div>
                  <Button onClick={handleCompleteJob} size="sm">
                    <CheckCircle className="mr-2 h-3 w-3" /> Complete Job
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* JOB COMPLETED */}
            {currentStage === "job_completed" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Job completed{crm.completionDate ? ` on ${new Date(crm.completionDate).toLocaleDateString()}` : ""}.
                    Send a satisfaction survey to the customer.
                  </p>
                  {crm.completionNotes && (
                    <div className="p-2 bg-muted rounded text-xs">
                      <strong>Completion Notes:</strong> {crm.completionNotes}
                    </div>
                  )}
                  <Button onClick={handleRequestSurvey} size="sm">
                    <Send className="mr-2 h-3 w-3" /> Send Survey to Customer
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* PENDING SURVEY */}
            {currentStage === "pending_survey" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Waiting for customer survey response. You can also record it manually.
                  </p>
                  <div>
                    <Label className="text-xs">Customer Rating</Label>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setSurveyRating(star)}
                          className={`p-1 rounded transition-colors ${star <= surveyRating ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-300"}`}
                        >
                          <Star className="h-6 w-6 fill-current" />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground self-center">{surveyRating}/5</span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="survey-feedback" className="text-xs">Customer Feedback</Label>
                    <Textarea
                      id="survey-feedback"
                      value={surveyFeedback}
                      onChange={(e) => setSurveyFeedback(e.target.value)}
                      placeholder="Customer comments about the job quality, timeliness, etc..."
                      rows={3}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmitSurvey} size="sm" disabled={surveyRating === 0}>
                      <CheckCircle className="mr-2 h-3 w-3" /> Close Job
                    </Button>
                    <Button onClick={() => setResendConfirm("pending_survey")} size="sm" variant="outline">
                      <RefreshCw className="mr-2 h-3 w-3" /> Resend Survey
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CLOSED */}
            {currentStage === "closed" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-center py-4">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-700">Job Closed</p>
                    {crm.surveyRating && (
                      <div className="flex justify-center gap-0.5 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-5 w-5 ${star <= (crm.surveyRating || 0) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                    )}
                    {crm.surveyFeedback && (
                      <p className="text-xs text-muted-foreground mt-2 italic">"{crm.surveyFeedback}"</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Customer Notes / Message */}
          {lead.message && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Original Message</Label>
              <p className="mt-1 p-3 bg-muted rounded-md text-sm">{lead.message}</p>
            </div>
          )}

          {/* Photos from initial submission */}
          {lead.photos && lead.photos.length > 0 && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Submitted Photos ({lead.photos.length})</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {lead.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-md border hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Timeline */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-3 block">Activity Timeline</Label>
            {(!crm.timeline || crm.timeline.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No activity yet. Take an action above to begin.</p>
            ) : (
              <div className="space-y-0">
                {[...crm.timeline].reverse().map((event, i) => {
                  const isN8n = event.actor === "n8n";
                  return (
                    <div key={event.id || i} className="flex gap-3 pb-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${isN8n ? "bg-orange-500" : i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                        {i < crm.timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-tight">
                          {isN8n && <span className="text-orange-600 mr-1">⚡</span>}
                          {event.event}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(event.date)}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className={`text-[10px] capitalize ${isN8n ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                            {event.actor || "system"}
                          </span>
                          {event.notes && <span className="text-[10px] text-muted-foreground">· {event.notes}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={resendConfirm !== null} onOpenChange={(open) => { if (!open) setResendConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Email?</AlertDialogTitle>
            <AlertDialogDescription>
              This email has already been sent. Do you want to send it again?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resendConfirm && handleResend(resendConfirm)}>
              Yes, Resend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
