/**
 * Publish Confirmation Modal Component
 * Confirmation dialog before publishing a form template version
 */

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface PublishConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  sectionCount: number;
  fieldCount: number;
}

export function PublishConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  sectionCount,
  fieldCount,
}: PublishConfirmModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);

  const handleConfirm = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      await onConfirm();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish Form Template Version?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Publishing will make this version <strong>immutable</strong>. You
              will not be able to edit, add, or remove sections and fields after
              publishing.
            </p>
            <p className="text-sm">
              This version contains:
            </p>
            <ul className="list-disc list-inside text-sm">
              <li>{sectionCount} section{sectionCount !== 1 ? "s" : ""}</li>
              <li>{fieldCount} field{fieldCount !== 1 ? "s" : ""}</li>
            </ul>
            <p className="text-sm font-medium mt-4">
              Are you sure you want to publish?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPublishing}>
            Yes, Publish Version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

