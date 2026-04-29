/**
 * Workflow Templates Management Page
 * Allows admins to view and manage workflow templates, statuses, and types
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { requireAuth } from "~/lib/auth/require-auth";
import {
  createEdenTreatyClient,
  createClientEdenTreatyClient,
} from "~/lib/api-client";
import { withTreatyBranch } from "~/lib/api-helpers";
import { UserRole } from "@supplex/types";
import {
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  MoreVertical,
  Power,
  PowerOff,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useToast } from "~/hooks/use-toast";

interface WorkflowTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  processType: string;
  status: "draft" | "published" | "archived";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowTypeItem {
  id: string;
  name: string;
  supplierStatusId: string | null;
  supplierStatusName: string | null;
}

interface SupplierStatusItem {
  id: string;
  name: string;
}

export async function loader(args: LoaderFunctionArgs) {
  // Require authentication
  const { userRecord, session } = await requireAuth(args);

  // Server-side permission check - Admin only
  if (userRecord.role !== UserRole.ADMIN) {
    return redirect("/");
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Create Eden Treaty client
  const client = createEdenTreatyClient(token);

  try {
    const [templatesResponse, typesResponse, supplierStatusesResponse] =
      await Promise.all([
        client.api["workflow-templates"].get({
          query: { limit: 100, offset: 0 },
        }),
        client.api.admin["workflow-types"].get(),
        client.api.admin["supplier-statuses"].get(),
      ]);

    // The list-templates payload carries `Date` fields; the `unknown` cast
    // sidesteps the structural mismatch and is reconciled by JSON
    // serialization at the loader boundary.
    const templates = (templatesResponse.data?.data ||
      []) as unknown as WorkflowTemplateListItem[];
    const typesPayload = typesResponse.data as {
      success: boolean;
      data?: WorkflowTypeItem[];
    } | null;
    const workflowTypes: WorkflowTypeItem[] = typesPayload?.data ?? [];
    const supplierStatusesPayload = supplierStatusesResponse.data as {
      success: boolean;
      data?: SupplierStatusItem[];
    } | null;
    const supplierStatuses: SupplierStatusItem[] =
      supplierStatusesPayload?.data ?? [];

    return json({
      templates,
      workflowTypes,
      supplierStatuses,
      token,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching workflow templates:", error);
    return json({
      templates: [] as WorkflowTemplateListItem[],
      workflowTypes: [] as WorkflowTypeItem[],
      supplierStatuses: [] as SupplierStatusItem[],
      token,
      error: "Failed to load workflow templates",
    });
  }
}

// Allow programmatic revalidation (useRevalidator) but skip on navigation
export function shouldRevalidate({
  formAction: _formAction,
  defaultShouldRevalidate,
}: {
  formAction: string | null;
  defaultShouldRevalidate: boolean;
}) {
  return defaultShouldRevalidate;
}

function WorkflowTypesTab({ token }: { token: string }) {
  const { workflowTypes, supplierStatuses } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<WorkflowTypeItem | null>(null);
  const [name, setName] = useState("");
  const [supplierStatusId, setSupplierStatusId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingType(null);
    setName("");
    setSupplierStatusId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (wt: WorkflowTypeItem) => {
    setEditingType(wt);
    setName(wt.name);
    setSupplierStatusId(wt.supplierStatusId);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (isSubmitting || !name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${window.ENV?.API_URL || "http://localhost:3001"}/api/admin/workflow-types${editingType ? `/${editingType.id}` : ""}`,
        {
          method: editingType ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: name.trim(), supplierStatusId }),
        }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast({ title: editingType ? "Type Updated" : "Type Created" });
      setIsDialogOpen(false);
      revalidator.revalidate();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `${window.ENV?.API_URL || "http://localhost:3001"}/api/admin/workflow-types/${id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast({ title: "Type Deleted" });
      revalidator.revalidate();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Workflow Types</h2>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Type
        </Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Supplier Status on Completion</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflowTypes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground py-8"
                >
                  No workflow types configured. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              workflowTypes.map((wt) => (
                <TableRow key={wt.id}>
                  <TableCell className="font-medium">{wt.name}</TableCell>
                  <TableCell>
                    {wt.supplierStatusName ? (
                      <Badge variant="outline">{wt.supplierStatusName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        None
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(wt)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === wt.id}
                      onClick={() => handleDelete(wt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Type" : "Create Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Supplier Qualification"
              />
            </div>
            <div>
              <Label>Supplier Status on Completion</Label>
              <Select
                value={supplierStatusId || "__none__"}
                onValueChange={(v) =>
                  setSupplierStatusId(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {supplierStatuses.map((ss) => (
                    <SelectItem key={ss.id} value={ss.id}>
                      {ss.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                When a workflow of this type completes, the supplier will be
                updated to this status.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || !name.trim()}
              onClick={handleSave}
            >
              {editingType ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WorkflowTemplatesPage() {
  const { templates, token } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published" | "archived"
  >("all");
  const [isToggling, setIsToggling] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter templates by status
  const filteredTemplates = templates.filter((template) => {
    if (statusFilter === "all") return true;
    return template.status === statusFilter;
  });

  const handleCreateTemplate = () => {
    navigate("/settings/workflow-templates/new");
  };

  const handleEditTemplate = (templateId: string) => {
    navigate(`/settings/workflow-templates/${templateId}/edit`);
  };

  const handleToggleActive = async (
    templateId: string,
    currentActive: boolean
  ) => {
    if (isToggling) return;
    setIsToggling(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await withTreatyBranch(
        client.api["workflow-templates"]({
          workflowId: templateId,
          templateId,
        }),
        "toggle-active"
      )["toggle-active"].patch();

      if (response.error) {
        throw new Error("Failed to toggle template status");
      }

      toast({
        title: "Template Updated",
        description: `Template is now ${currentActive ? "inactive" : "active"}`,
      });

      revalidator.revalidate();
    } catch (error) {
      console.error("Error toggling template active status:", error);
      toast({
        title: "Error",
        description: "Failed to update template status",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteClick = (templateId: string, templateName: string) => {
    setDeleteTemplateId(templateId);
    setDeleteTemplateName(templateName);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTemplateId || isDeleting) return;
    setIsDeleting(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await withTreatyBranch(
        client.api["workflow-templates"]({
          workflowId: deleteTemplateId,
          templateId: deleteTemplateId,
        }),
        "delete"
      ).delete();

      if (response.error) {
        throw new Error("Failed to delete template");
      }

      toast({
        title: "Template Deleted",
        description: `"${deleteTemplateName}" has been deleted`,
      });

      setDeleteTemplateId(null);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete workflow template",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadgeVariant = (
    status: string
  ): "default" | "secondary" | "outline" | "success" => {
    switch (status) {
      case "published":
        return "success";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Workflow Templates
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and manage workflow templates for your organization
              </p>
            </div>
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="types">Workflow Types</TabsTrigger>
          </TabsList>

          <TabsContent value="types">
            <WorkflowTypesTab token={token} />
          </TabsContent>

          <TabsContent value="templates">
            {/* Status Filter */}
            <div className="mb-6 flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("draft")}
              >
                Draft
              </Button>
              <Button
                variant={statusFilter === "published" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("published")}
              >
                Published
              </Button>
              <Button
                variant={statusFilter === "archived" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("archived")}
              >
                Archived
              </Button>
            </div>

            {/* Templates Grid */}
            {filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No workflow templates found
                  </p>
                  <Button onClick={handleCreateTemplate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${
                      template.status === "published" && !template.active
                        ? "opacity-60 bg-muted/30"
                        : ""
                    }`}
                    onClick={() => handleEditTemplate(template.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg truncate">
                            {template.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 mt-1">
                            {template.description || "No description provided"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(template.status)}
                          className="shrink-0 capitalize"
                        >
                          {template.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Process Type:</span>{" "}
                          {template.processType}
                        </div>
                        <div>
                          <span className="font-medium">Last Updated:</span>{" "}
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </div>
                        {template.status === "published" && (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                template.active
                                  ? "bg-green-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            <span
                              className={
                                template.active
                                  ? "text-green-700"
                                  : "text-amber-600"
                              }
                            >
                              {template.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-3">
                      <div className="flex w-full justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTemplate(template.id);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Template
                            </DropdownMenuItem>
                            {template.status === "published" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={isToggling}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActive(
                                      template.id,
                                      template.active
                                    );
                                  }}
                                >
                                  {template.active ? (
                                    <>
                                      <PowerOff className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(template.id, template.name);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTemplateId}
        onOpenChange={() => setDeleteTemplateId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Workflow Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTemplateName}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTemplateId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
