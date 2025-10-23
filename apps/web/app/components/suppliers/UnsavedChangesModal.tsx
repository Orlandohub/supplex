import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeave: () => void;
}

/**
 * UnsavedChangesModal Component
 * Confirms navigation away from form when unsaved changes exist
 *
 * Features:
 * - Warns user about losing unsaved changes
 * - "Stay" button to remain on form
 * - "Leave" button to navigate away and discard changes
 * - Accessible with proper ARIA labels and keyboard controls
 */
export function UnsavedChangesModal({
  isOpen,
  onClose,
  onLeave,
}: UnsavedChangesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Are you sure you want to leave? Your
            changes will be lost.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Stay
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
