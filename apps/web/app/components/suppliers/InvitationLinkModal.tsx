import { useState } from "react";
import { X, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface InvitationLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitationToken: string;
  supplierUser?: {
    id: string;
    email: string;
    fullName: string;
  };
}

export function InvitationLinkModal({
  isOpen,
  onClose,
  invitationToken,
  supplierUser,
}: InvitationLinkModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build invitation link
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const invitationLink = `${appUrl}/auth/accept-invitation?token=${invitationToken}`;

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close pattern on the dialog container; see SUP-8 for a proper focus-trap rewrite
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Supplier Created Successfully
              </h3>
              <p className="text-sm text-gray-600">
                Platform access enabled for supplier user
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Information */}
          {supplierUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                User Account Created
              </h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>
                  <strong>Name:</strong> {supplierUser.fullName}
                </p>
                <p>
                  <strong>Email:</strong> {supplierUser.email}
                </p>
                <p>
                  <strong>Role:</strong> Supplier User
                </p>
              </div>
            </div>
          )}

          {/* Invitation Link */}
          <div>
            <Label htmlFor="invitationLink" className="text-base font-semibold">
              Invitation Link
            </Label>
            <p className="text-sm text-gray-600 mt-1 mb-3">
              Copy this link and send it to{" "}
              {supplierUser ? supplierUser.fullName : "the supplier contact"} to
              activate their account.
            </p>

            <div className="flex space-x-2">
              <Input
                id="invitationLink"
                type="text"
                value={invitationLink}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                onClick={handleCopy}
                variant={copied ? "default" : "outline"}
                className="flex items-center space-x-2"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Important Information */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800 space-y-1">
                <p className="font-medium">Important Information:</p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li>
                    This invitation link is valid for <strong>48 hours</strong>
                  </li>
                  <li>The link can only be used once</li>
                  <li>
                    The supplier will need to set a password to activate their
                    account
                  </li>
                  <li>
                    You can resend the invitation from the &quot;Pending
                    Invitations&quot; page if needed
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button onClick={onClose} className="px-6">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
