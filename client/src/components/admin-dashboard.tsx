import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Hammer, DollarSign, Eye, Phone, ArrowRightLeft, Download, RefreshCw, LogOut, FileText, Calendar, CheckCircle, Send, Clock, XCircle, LayoutGrid, Table2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, JOB_TYPE_LABELS } from "@/lib/pricing";
import { CrmPipeline } from "./crm-pipeline";
import type { Lead } from "@shared/schema";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-yellow-100 text-yellow-800" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-800" },
  { value: "in-progress", label: "In Progress", color: "bg-orange-100 text-orange-800" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
];

const CONTRACT_STATUSES = [
  { value: "draft", label: "Draft", icon: FileText },
  { value: "sent", label: "Sent to Customer", icon: Send },
  { value: "signed", label: "Signed", icon: CheckCircle },
  { value: "active", label: "Active / In Progress", icon: Clock },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [statusFilter, setStatusFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractStatus, setContractStatus] = useState("draft");
  const [contractAmount, setContractAmount] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractNotes, setContractNotes] = useState("");
  const [depositPercent, setDepositPercent] = useState("25");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalLeads: number;
    newLeads: number;
    inProgress: number;
    totalRevenue: number;
  }>({
    queryKey: ["/api/leads/stats"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/leads/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
      toast({
        title: "Status Updated",
        description: "Lead status has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update lead status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "new":
        return "default";
      case "contacted":
        return "secondary";
      case "in-progress":
        return "destructive";
      case "completed":
        return "outline";
      default:
        return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-yellow-100 text-yellow-800";
      case "contacted":
        return "bg-blue-100 text-blue-800";
      case "in-progress":
        return "bg-orange-100 text-orange-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const statusMatch = !statusFilter || statusFilter === 'all' || lead.status === statusFilter;
    const jobTypeMatch = !jobTypeFilter || jobTypeFilter === 'all' || lead.jobType === jobTypeFilter;
    return statusMatch && jobTypeMatch;
  });

  const handleStatusUpdate = (leadId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: leadId, status: newStatus });
  };

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const openContract = (lead: Lead) => {
    setSelectedLead(lead);
    setContractAmount(lead.quote || "");
    setContractStatus("draft");
    setContractStartDate("");
    setContractEndDate("");
    setContractNotes("");
    setDepositPercent("25");
    setContractOpen(true);
  };

  const handleCallPhone = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handleSendContract = () => {
    toast({
      title: "Contract Sent",
      description: `Contract sent to ${selectedLead?.email} for ${formatCurrency(parseFloat(contractAmount))}`,
    });
    setContractStatus("sent");
  };

  const handleMarkSigned = () => {
    setContractStatus("signed");
    if (selectedLead) {
      handleStatusUpdate(selectedLead.id, "in-progress");
    }
    toast({
      title: "Contract Signed",
      description: "Contract marked as signed. Lead status updated to In Progress.",
    });
  };

  const handleCompleteContract = () => {
    setContractStatus("completed");
    if (selectedLead) {
      handleStatusUpdate(selectedLead.id, "completed");
    }
    toast({
      title: "Contract Completed",
      description: "Job marked as completed.",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage customer leads and quotes</p>
        </div>
        <Button onClick={onLogout} variant="secondary">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Table2 className="h-4 w-4" /> Leads
          </TabsTrigger>
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" /> CRM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats?.totalLeads || 0}</p>
                )}
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">New This Week</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats?.newLeads || 0}</p>
                )}
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Plus className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats?.inProgress || 0}</p>
                )}
              </div>
              <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                <Hammer className="h-5 w-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Job Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Types</SelectItem>
                  {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await apiRequest("POST", "/api/test/angi-lead", {});
                    queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
                    toast({ title: "Test Angi lead created successfully" });
                  } catch (error) {
                    toast({ title: "Failed to create test lead", variant: "destructive" });
                  }
                }}
              >
                Test Angi Lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await apiRequest("POST", "/api/test/homeadvisor-lead", {});
                    queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
                    toast({ title: "Test HomeAdvisor lead created successfully" });
                  } catch (error) {
                    toast({ title: "Failed to create test lead", variant: "destructive" });
                  }
                }}
              >
                Test HA Lead
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {leadsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Quote</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No leads found. Adjust your filters or check back later.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground">{lead.fullName}</div>
                            <div className="text-sm text-muted-foreground">{lead.email}</div>
                            <div className="text-sm text-muted-foreground">{lead.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground">
                            {JOB_TYPE_LABELS[lead.jobType as keyof typeof JOB_TYPE_LABELS]}
                          </div>
                          <div className="text-sm text-muted-foreground">{lead.squareFootage} sq ft</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {formatCurrency(parseFloat(lead.quote))}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {lead.urgency === "rush" ? "Rush (+15%)" : "Normal"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Badge variant="secondary" className={`
                              ${lead.source === 'angi' ? 'bg-green-100 text-green-800' : ''}
                              ${lead.source === 'homeadvisor' ? 'bg-orange-100 text-orange-800' : ''}
                              ${lead.source === 'website' ? 'bg-blue-100 text-blue-800' : ''}
                              ${lead.source === 'manual' ? 'bg-purple-100 text-purple-800' : ''}
                            `}>
                              {lead.source?.charAt(0).toUpperCase() + lead.source?.slice(1) || 'Website'}
                            </Badge>
                          </div>
                          {lead.externalId && (
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {lead.externalId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80"
                              title="View Details"
                              onClick={() => openDetail(lead)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-800"
                              title={`Call ${formatPhone(lead.phone)}`}
                              onClick={() => handleCallPhone(lead.phone)}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-accent hover:text-accent/80"
                                  title="Change Status"
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {STATUS_OPTIONS.map((opt) => (
                                  <DropdownMenuItem
                                    key={opt.value}
                                    onClick={() => handleStatusUpdate(lead.id, opt.value)}
                                    disabled={lead.status === opt.value}
                                    className={lead.status === opt.value ? "opacity-50" : ""}
                                  >
                                    <Badge className={`${opt.color} mr-2`} variant="secondary">
                                      {opt.label}
                                    </Badge>
                                    {lead.status === opt.value && "(current)"}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-800"
                              title="Manage Contract"
                              onClick={() => openContract(lead)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Lead Detail Dialog (inside Leads tab) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Full information for this lead</DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Full Name</Label>
                  <p className="font-medium">{selectedLead.fullName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div><Badge className={getStatusColor(selectedLead.status)}>{selectedLead.status.charAt(0).toUpperCase() + selectedLead.status.slice(1)}</Badge></div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p><a href={`mailto:${selectedLead.email}`} className="text-primary hover:underline">{selectedLead.email}</a></p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p><a href={`tel:${selectedLead.phone}`} className="text-primary hover:underline">{formatPhone(selectedLead.phone)}</a></p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Job Type</Label>
                  <p>{JOB_TYPE_LABELS[selectedLead.jobType as keyof typeof JOB_TYPE_LABELS]}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Square Footage</Label>
                  <p>{selectedLead.squareFootage} sq ft</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Urgency</Label>
                  <p>{selectedLead.urgency === "rush" ? "Rush (+15%)" : "Normal"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Estimated Quote</Label>
                  <p className="text-lg font-bold text-primary">{formatCurrency(parseFloat(selectedLead.quote))}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Source</Label>
                  <p>{selectedLead.source?.charAt(0).toUpperCase() + selectedLead.source?.slice(1)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Date Submitted</Label>
                  <p>{selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleString() : "N/A"}</p>
                </div>
              </div>
              {selectedLead.message && (
                <div>
                  <Label className="text-muted-foreground text-xs">Message</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedLead.message}</p>
                </div>
              )}
              {selectedLead.photos && selectedLead.photos.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Project Photos ({selectedLead.photos.length})</Label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {selectedLead.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-32 object-cover rounded-md border hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => handleCallPhone(selectedLead.phone)}>
                  <Phone className="mr-2 h-4 w-4" /> Call Customer
                </Button>
                <Button onClick={() => { setDetailOpen(false); openContract(selectedLead); }}>
                  <FileText className="mr-2 h-4 w-4" /> Manage Contract
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Management Dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Management</DialogTitle>
            <DialogDescription>
              {selectedLead ? `${selectedLead.fullName} — ${JOB_TYPE_LABELS[selectedLead.jobType as keyof typeof JOB_TYPE_LABELS]}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-6">
              {/* Contract Status Pipeline */}
              <div>
                <Label className="text-sm font-medium">Contract Status</Label>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {CONTRACT_STATUSES.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = contractStatus === s.value;
                    const isPast = CONTRACT_STATUSES.findIndex(cs => cs.value === contractStatus) > i;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setContractStatus(s.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                          ${isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        <Icon className="h-3 w-3" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Contract Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contract-amount">Contract Amount</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="contract-amount"
                      type="number"
                      value={contractAmount}
                      onChange={(e) => setContractAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="deposit">Deposit (%)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="deposit"
                      type="number"
                      value={depositPercent}
                      onChange={(e) => setDepositPercent(e.target.value)}
                      className="w-20"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-muted-foreground">
                      = {formatCurrency(parseFloat(contractAmount || "0") * (parseFloat(depositPercent || "0") / 100))}
                    </span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">Estimated Completion</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Payment Schedule */}
              <div>
                <Label className="text-sm font-medium">Payment Schedule</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Deposit</span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(parseFloat(contractAmount || "0") * (parseFloat(depositPercent || "0") / 100))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Progress (50% mark)</span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(parseFloat(contractAmount || "0") * ((100 - parseFloat(depositPercent || "0")) / 100) * 0.5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Final Payment</span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(parseFloat(contractAmount || "0") * ((100 - parseFloat(depositPercent || "0")) / 100) * 0.5)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="contract-notes">Scope of Work / Notes</Label>
                <Textarea
                  id="contract-notes"
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  placeholder="Describe the scope of work, materials, timeline, special terms..."
                  rows={4}
                  className="mt-1 resize-none"
                />
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {contractStatus === "draft" && (
                  <Button onClick={handleSendContract} disabled={!contractAmount}>
                    <Send className="mr-2 h-4 w-4" /> Send Contract
                  </Button>
                )}
                {contractStatus === "sent" && (
                  <Button onClick={handleMarkSigned} variant="default">
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark as Signed
                  </Button>
                )}
                {(contractStatus === "signed" || contractStatus === "active") && (
                  <>
                    <Button onClick={() => setContractStatus("active")} variant={contractStatus === "active" ? "secondary" : "default"}>
                      <Clock className="mr-2 h-4 w-4" /> Start Work
                    </Button>
                    <Button onClick={handleCompleteContract} variant="default">
                      <CheckCircle className="mr-2 h-4 w-4" /> Mark Complete
                    </Button>
                  </>
                )}
                {contractStatus !== "cancelled" && contractStatus !== "completed" && (
                  <Button onClick={() => setContractStatus("cancelled")} variant="destructive">
                    <XCircle className="mr-2 h-4 w-4" /> Cancel Contract
                  </Button>
                )}
                {(contractStatus === "cancelled" || contractStatus === "completed") && (
                  <Button onClick={() => setContractStatus("draft")} variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset to Draft
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="crm">
          <CrmPipeline />
        </TabsContent>
      </Tabs>
    </div>
  );
}
