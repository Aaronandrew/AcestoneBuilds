import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Hammer, DollarSign, Eye, Phone, Play, Download, RefreshCw, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, JOB_TYPE_LABELS } from "@/lib/pricing";
import type { Lead } from "@shared/schema";

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [statusFilter, setStatusFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage customer leads and quotes</p>
        </div>
        <Button onClick={onLogout} variant="secondary">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

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
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-800"
                              onClick={() => handleStatusUpdate(lead.id, "contacted")}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-accent hover:text-accent/80"
                              onClick={() => handleStatusUpdate(lead.id, "in-progress")}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Play className="h-4 w-4" />
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
    </div>
  );
}
