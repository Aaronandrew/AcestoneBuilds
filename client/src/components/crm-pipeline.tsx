import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Calendar, Phone, Mail, MapPin, Hammer,
  ChevronRight, Clock, RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, JOB_TYPE_LABELS } from "@/lib/pricing";
import {
  CRM_STAGES, CRM_STAGE_LABELS, CRM_STAGE_COLORS,
  type Lead, type CrmData, type CrmStage, type CrmTimelineEvent,
} from "@shared/schema";
import { CrmLeadDetail } from "./crm-lead-detail";

// Helper to get leads grouped by CRM stage
function groupLeadsByStage(leads: Lead[]): Record<CrmStage, Lead[]> {
  const groups: Record<CrmStage, Lead[]> = {} as any;
  for (const stage of CRM_STAGES) {
    groups[stage] = [];
  }
  for (const lead of leads) {
    const stage = lead.crmData?.crmStatus || "new_lead";
    if (groups[stage]) {
      groups[stage].push(lead);
    } else {
      groups["new_lead"].push(lead);
    }
  }
  return groups;
}

function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

interface CrmPipelineProps {
  onRefresh?: () => void;
}

export function CrmPipeline({ onRefresh }: CrmPipelineProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const updateCrmMutation = useMutation({
    mutationFn: async ({ id, crmData }: { id: string; crmData: CrmData }) => {
      const res = await apiRequest("PATCH", `/api/leads/${id}/crm`, crmData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update CRM data.",
        variant: "destructive",
      });
    },
  });

  const grouped = groupLeadsByStage(leads);

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const handleCrmUpdate = (leadId: string, crmData: CrmData) => {
    updateCrmMutation.mutate({ id: leadId, crmData });
  };

  // Quick action: advance lead to next stage
  const advanceStage = (lead: Lead) => {
    const currentStage = lead.crmData?.crmStatus || "new_lead";
    const currentIndex = CRM_STAGES.indexOf(currentStage);
    if (currentIndex < CRM_STAGES.length - 1) {
      const nextStage = CRM_STAGES[currentIndex + 1];
      const existingCrm = lead.crmData || { crmStatus: "new_lead", timeline: [] };
      const newEvent: CrmTimelineEvent = {
        id: crypto.randomUUID?.() || Date.now().toString(),
        date: new Date().toISOString(),
        stage: nextStage,
        event: `Advanced to ${CRM_STAGE_LABELS[nextStage]}`,
        actor: "admin",
      };
      const updatedCrm: CrmData = {
        ...existingCrm,
        crmStatus: nextStage,
        timeline: [...(existingCrm.timeline || []), newEvent],
      };
      handleCrmUpdate(lead.id, updatedCrm);
      toast({ title: `Moved to ${CRM_STAGE_LABELS[nextStage]}` });
    }
  };

  // CRM stage stats
  const totalInPipeline = leads.filter(l => {
    const s = l.crmData?.crmStatus || "new_lead";
    return s !== "closed";
  }).length;
  const meetingsBooked = grouped["meeting_booked"].length;
  const activeJobs = grouped["job_in_progress"].length;
  const pendingSurveys = grouped["pending_survey"].length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CRM Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In Pipeline</p>
                <p className="text-xl font-bold">{totalInPipeline}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meetings Booked</p>
                <p className="text-xl font-bold">{meetingsBooked}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cyan-100 rounded-full flex items-center justify-center">
                <Hammer className="h-4 w-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
                <p className="text-xl font-bold">{activeJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Surveys</p>
                <p className="text-xl font-bold">{pendingSurveys}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Kanban Pipeline Board */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: `${CRM_STAGES.length * 280}px` }}>
          {CRM_STAGES.map((stage) => {
            const stageLeads = grouped[stage];
            const color = CRM_STAGE_COLORS[stage];
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-[260px]"
              >
                {/* Column Header */}
                <div className={`rounded-t-lg px-3 py-2 border-b-2 ${color}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      {CRM_STAGE_LABELS[stage]}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {stageLeads.length}
                    </Badge>
                  </div>
                </div>

                {/* Column Body */}
                <div className="bg-muted/30 rounded-b-lg min-h-[400px] max-h-[600px] overflow-y-auto p-2 space-y-2">
                  {stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No leads
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="cursor-pointer hover:shadow-md transition-shadow border"
                        onClick={() => openLeadDetail(lead)}
                      >
                        <CardContent className="p-3 space-y-2">
                          {/* Name & Job */}
                          <div>
                            <p className="text-sm font-semibold leading-tight truncate">
                              {lead.fullName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {JOB_TYPE_LABELS[lead.jobType as keyof typeof JOB_TYPE_LABELS]} · {lead.squareFootage} sq ft
                            </p>
                          </div>

                          {/* Quote */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-primary">
                              {formatCurrency(parseFloat(lead.quote))}
                            </span>
                            {lead.urgency === "rush" && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                Rush
                              </Badge>
                            )}
                          </div>

                          {/* Contact Info */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{formatPhone(lead.phone)}</span>
                          </div>

                          {/* Meeting date if booked */}
                          {lead.crmData?.meetingDate && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(lead.crmData.meetingDate).toLocaleDateString()}</span>
                            </div>
                          )}

                          {/* Job dates if set */}
                          {lead.crmData?.jobStartDate && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Hammer className="h-3 w-3" />
                              <span>Starts {new Date(lead.crmData.jobStartDate).toLocaleDateString()}</span>
                            </div>
                          )}

                          {/* Quick advance button */}
                          {stage !== "closed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-7 text-[10px] mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                advanceStage(lead);
                              }}
                              disabled={updateCrmMutation.isPending}
                            >
                              Advance <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Lead Detail Sheet */}
      {selectedLead && (
        <CrmLeadDetail
          lead={selectedLead}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onCrmUpdate={handleCrmUpdate}
        />
      )}
    </div>
  );
}
