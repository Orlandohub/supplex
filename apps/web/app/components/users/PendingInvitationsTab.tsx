/**
 * Pending Invitations Tab Component
 * Shows all pending user invitations across all roles
 */

import { useState } from "react";
import { Copy, CheckCircle, RefreshCw, Search, AlertCircle, Clock, UserCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { getRoleDisplayName } from "~/lib/rbac/permissions";
import type { UserRole } from "@supplex/types";

export interface PendingInvitation {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  supplierName: string | null;
  supplierId: string | null;
  invitationToken: string;
  invitationStatus: "pending" | "expired";
  expiresAt: Date;
  createdAt: Date;
}

interface PendingInvitationsTabProps {
  invitations: PendingInvitation[];
  onResendInvitation: (userId: string) => void;
}

export function PendingInvitationsTab({
  invitations,
  onResendInvitation,
}: PendingInvitationsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Copy invitation link to clipboard
  const handleCopy = async (token: string) => {
    try {
      const appUrl = window.location.origin;
      const invitationLink = `${appUrl}/auth/accept-invitation?token=${token}`;
      await navigator.clipboard.writeText(invitationLink);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Filter invitations by search term
  const filteredInvitations = invitations.filter((invitation) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      invitation.userName.toLowerCase().includes(searchLower) ||
      invitation.userEmail.toLowerCase().includes(searchLower) ||
      invitation.supplierName?.toLowerCase().includes(searchLower)
    );
  });

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Pending User Invitations
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Users awaiting account activation. Invitations are valid for 48 hours.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name, email, or supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Invitations List */}
      {filteredInvitations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">
            {invitations.length === 0
              ? "No pending invitations"
              : "No invitations match your search"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvitations.map((invitation) => (
            <div
              key={invitation.userId}
              className="bg-white border rounded-lg p-6 hover:border-blue-200 transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* User Info */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                    User
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {invitation.userName}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {invitation.userEmail}
                  </p>
                </div>

                {/* Role */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                    Role
                  </p>
                  <Badge variant="outline">
                    {getRoleDisplayName(invitation.userRole as UserRole)}
                  </Badge>
                </div>

                {/* Supplier Info */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                    Supplier
                  </p>
                  <p className="text-sm text-gray-900">
                    {invitation.supplierName || "—"}
                  </p>
                </div>

                {/* Status & Expiry */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                    Status
                  </p>
                  {invitation.invitationStatus === "expired" ? (
                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                      <AlertCircle className="h-3 w-3" />
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    Expires: {formatDate(invitation.expiresAt)}
                  </p>
                </div>
              </div>

              {/* Invitation Link */}
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Invitation Link
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={`${window.location.origin}/auth/accept-invitation?token=${invitation.invitationToken}`}
                    readOnly
                    className="flex-1 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(invitation.invitationToken)}
                  >
                    {copiedToken === invitation.invitationToken ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isResending}
                    onClick={async () => {
                      if (isResending) return;
                      setIsResending(true);
                      try {
                        await onResendInvitation(invitation.userId);
                      } finally {
                        setIsResending(false);
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resend
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {invitations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-medium text-gray-500">Total Pending</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {invitations.length}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-medium text-gray-500">Expired</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">
              {invitations.filter((i) => i.invitationStatus === "expired").length}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-medium text-gray-500">Valid</p>
            <p className="text-2xl font-semibold text-green-600 mt-1">
              {invitations.filter((i) => i.invitationStatus === "pending").length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

