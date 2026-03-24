/**
 * ChangeRoleModal Component
 * Modal for changing a user's role
 */

import { useState, useEffect } from "react";
import { UserRole, type User } from "@supplex/types";
import { getRoleDisplayName } from "../../lib/rbac/permissions";
import { RoleBadge } from "./RoleBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { AlertCircle, AlertTriangle, Shield } from "lucide-react";

export interface ChangeRoleModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: string, newRole: UserRole) => Promise<void>;
}

export function ChangeRoleModal({
  isOpen,
  user,
  onClose,
  onConfirm,
}: ChangeRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    user?.role || UserRole.VIEWER
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update selected role when user changes
  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await onConfirm(user.id, selectedRole);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  const roleChanged = selectedRole !== user.role;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center">Change User Role</DialogTitle>
          <DialogDescription className="text-center">
            Update the role for <span className="font-medium">{user.fullName}</span> ({user.email})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-md bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Role:</span>
              <RoleBadge role={user.role} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">New Role *</Label>
            <select
              id="new-role"
              required
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {getRoleDisplayName(r)}
                </option>
              ))}
            </select>
          </div>

          {roleChanged && (
            <div className="flex items-start gap-3 rounded-md bg-yellow-50 p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <p className="text-sm text-yellow-800">
                This will immediately change the user&apos;s permissions. They may need to log out and back in to see the changes.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !roleChanged}>
              {isSubmitting ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
