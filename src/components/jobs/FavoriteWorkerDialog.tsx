import { useState } from "react";
import { Star, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FavoriteWorkerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  workerName: string;
  existingNote?: string | null;
  isRemoving?: boolean;
}

export function FavoriteWorkerDialog({
  isOpen,
  onClose,
  onConfirm,
  workerName,
  existingNote,
  isRemoving = false,
}: FavoriteWorkerDialogProps) {
  const [note, setNote] = useState(existingNote || "");

  const handleConfirm = () => {
    onConfirm(note);
    setNote("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className={`w-5 h-5 ${isRemoving ? "text-muted-foreground" : "text-amber-500 fill-amber-500"}`} />
            {isRemoving ? "Remove from Favorites" : "Save Worker to Favorites"}
          </DialogTitle>
          <DialogDescription>
            {isRemoving
              ? `Are you sure you want to remove ${workerName} from your favorites?`
              : `Save ${workerName} to your favorites so you can easily find them for future jobs.`}
          </DialogDescription>
        </DialogHeader>

        {!isRemoving && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              Add a note (optional)
            </label>
            <Textarea
              placeholder="e.g. Great worker, very reliable, punctual. Good for cleaning jobs."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isRemoving ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {isRemoving ? "Remove" : "Save to Favorites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
