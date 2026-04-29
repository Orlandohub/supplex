/**
 * InviteUserModal Component
 * Modal form for inviting new users to the tenant
 */

import { useState } from "react";
import { UserRole } from "@supplex/types";
import { getErrorMessage } from "~/lib/api-helpers";
import { getRoleDisplayName } from "../../lib/rbac/permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { AlertCircle, UserPlus } from "lucide-react";

export interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: {
    email: string;
    role: UserRole;
    message?: string;
  }) => Promise<void>;
}

export function InviteUserModal({
  isOpen,
  onClose,
  onInvite,
}: InviteUserModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.VIEWER);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onInvite({
        email,
        role,
        message: message || undefined,
      });

      // Reset form and close
      setEmail("");
      setRole(UserRole.VIEWER);
      setMessage("");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send invitation"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <UserPlus className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center">Invite Team Member</DialogTitle>
          <DialogDescription className="text-center">
            Send an invitation email to add a new user to your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-md bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <select
              id="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {getRoleDisplayName(r)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              The user will be assigned this role when they accept the
              invitation.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Welcome Message (Optional)</Label>
            <Textarea
              id="message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              placeholder="Add a personal welcome message..."
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/500 characters
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
