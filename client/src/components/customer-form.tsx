import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, NotebookPen, Upload, HardHat } from "lucide-react";
import { insertLeadSchema, type InsertLead } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { QuoteDisplay } from "./quote-display";
import { calculateQuote, JOB_TYPE_LABELS, URGENCY_LABELS } from "@/lib/pricing";
import aceImg1 from "@/assets/house.jpeg";
import aceImg2 from "@/assets/ladder.jpeg";

export function CustomerForm() {
  const [calculatedQuote, setCalculatedQuote] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      jobType: undefined,
      squareFootage: undefined,
      urgency: undefined,
      message: "",
      photos: [],
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: InsertLead) => {
      const res = await apiRequest("POST", "/api/leads", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote Request Submitted!",
        description: "We'll respond within 24 hours with a detailed quote.",
      });
      form.reset();
      setCalculatedQuote(0);
      setUploadedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const watchedFields = form.watch(["jobType", "squareFootage", "urgency"]);

  // Update quote when relevant fields change
  useEffect(() => {
    const [jobType, squareFootage, urgency] = watchedFields;
    if (jobType && squareFootage && urgency) {
      const quote = calculateQuote(jobType as any, squareFootage, urgency as any);
      setCalculatedQuote(quote);
    } else {
      setCalculatedQuote(0);
    }
  }, [watchedFields]);

  const onSubmit = async (data: InsertLead) => {
    console.log("Form submitted with data:", data);
    console.log("Calculated quote:", calculatedQuote);
    
    let photoUrls: string[] = [];
    
    // Upload files to S3 if any
    if (uploadedFiles.length > 0) {
      setUploading(true);
      try {
        for (const file of uploadedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
          const { url } = await uploadRes.json();
          photoUrls.push(url);
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Upload Failed",
          description: "Some images failed to upload. Submitting form anyway.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    }
    
    const finalData = {
      ...data,
      quote: calculatedQuote.toString(),
      photos: photoUrls,
    };
    
    console.log("Final data being sent:", finalData);
    createLeadMutation.mutate(finalData);
  };

  const fillDebugData = () => {
    const debugValues: InsertLead = {
      fullName: "Chad Watson",
      email: "chad@example.com",
      phone: "9193828181",
      jobType: "kitchen",
      squareFootage: 650,
      urgency: "rush",
      message: "Kitchen remodel with new cabinets and flooring.",
      photos: [],
      source: "website",
    } as InsertLead;

    form.reset(debugValues);
    const quote = calculateQuote(debugValues.jobType as any, debugValues.squareFootage!, debugValues.urgency as any);
    setCalculatedQuote(quote);
    setUploadedFiles([]);
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    
    const [, area, prefix, line] = match;
    if (line) {
      return `(${area}) ${prefix}-${line}`;
    } else if (prefix) {
      return `(${area}) ${prefix}`;
    } else if (area) {
      return `(${area}`;
    }
    return '';
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isUnder5MB = file.size <= 5 * 1024 * 1024;
      if (!isImage) {
        toast({
          title: "Invalid File",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
      }
      if (!isUnder5MB) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 5MB`,
          variant: "destructive",
        });
      }
      return isImage && isUnder5MB;
    });
    setUploadedFiles(prev => [...prev, ...validFiles]);
  }, [toast]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Transform Your Home with Expert Craftsmanship
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Get an instant quote for your next renovation project. Our experienced team delivers quality results on time and within budget.
        </p>
      </div>

      {/* Gallery Section */}
      <div className="mb-12">
        <h3 className="text-2xl font-semibold text-foreground mb-6 text-center">Our Work</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <img
            src={aceImg1}
            alt="Modern kitchen renovation"
            className="rounded-lg shadow-md w-full h-48 object-cover hover:shadow-lg transition-shadow"
          />
          <img
            src="https://images.unsplash.com/photo-1507089947368-19c1da9775ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
            alt="Luxury bathroom renovation"
            className="rounded-lg shadow-md w-full h-48 object-cover hover:shadow-lg transition-shadow"
          />
          <img
            src="https://images.unsplash.com/photo-1562259949-e8e7689d7828?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
            alt="Professional painting service"
            className="rounded-lg shadow-md w-full h-48 object-cover hover:shadow-lg transition-shadow"
          />
          <img
            src={aceImg2}
            alt="Hardwood flooring installation"
            className="rounded-lg shadow-md w-full h-48 object-cover hover:shadow-lg transition-shadow"
          />
        </div>
      </div>

      {/* Quote Form */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-2xl font-semibold">Get Your Free Estimate</CardTitle>
          {import.meta.env.DEV && (
            <Button type="button" variant="outline" size="sm" onClick={fillDebugData}>
              Auto-fill Debug Data
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form 
              onSubmit={(e) => {
                console.log("Form submit event triggered");
                console.log("Form state:", form.formState);
                console.log("Form errors:", form.formState.errors);
                form.handleSubmit(onSubmit, (errors) => {
                  console.log("Validation errors:", errors);
                  toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields correctly.",
                    variant: "destructive",
                  });
                })(e);
              }} 
              className="space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground border-b border-border pb-2">
                  Contact Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="(555) 123-4567" 
                          value={formatPhoneNumber(field.value || '')}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/\D/g, '');
                            field.onChange(cleaned);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Project Details */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground border-b border-border pb-2">
                  Project Details
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select job type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="squareFootage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="number" 
                              placeholder="Enter square footage" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                              className="pr-16"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">sq ft</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Urgency *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select urgency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground border-b border-border pb-2">
                  Additional Information
                </h4>
                
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us more about your project..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div>
                  <Label>Upload Photos (Optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors mt-2">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground mb-2">Drag and drop files here, or click to browse</p>
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                      Choose Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">Max 5MB per image</p>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="ml-2"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quote Display */}
              {calculatedQuote > 0 && (
                <QuoteDisplay
                  quote={calculatedQuote}
                  jobType={watchedFields[0] ? JOB_TYPE_LABELS[watchedFields[0] as keyof typeof JOB_TYPE_LABELS] : ""}
                  squareFootage={watchedFields[1] || 0}
                  urgency={watchedFields[2] ? URGENCY_LABELS[watchedFields[2] as keyof typeof URGENCY_LABELS] : ""}
                />
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 px-6 h-auto"
                  disabled={createLeadMutation.isPending || uploading}
                >
                  {(createLeadMutation.isPending || uploading) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploading ? 'Uploading Images...' : 'Submitting...'}
                    </>
                  ) : (
                    <NotebookPen className="mr-2 h-4 w-4" />
                  )}
                  Get My Free Estimate
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  We'll respond within 24 hours with a detailed quote
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Features Section */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <HardHat className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground mb-2">Fast Response</h4>
          <p className="text-muted-foreground text-sm">Get your quote within 24 hours</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <HardHat className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground mb-2">Fully Licensed</h4>
          <p className="text-muted-foreground text-sm">Licensed and insured contractors</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <HardHat className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground mb-2">Quality Guaranteed</h4>
          <p className="text-muted-foreground text-sm">100% satisfaction guarantee</p>
        </div>
      </div>
    </div>
  );
}
