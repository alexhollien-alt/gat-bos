"use client";

// Phase 012: replaces silent today+1 default with explicit date pick.
// Native <input type="date"> avoids new dep; min=today (Phoenix), default=tomorrow.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import styles from "./styles.module.css";

function todayPhoenixDateString(): string {
  const now = new Date();
  const phx = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  const yyyy = phx.getUTCFullYear();
  const mm = String(phx.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(phx.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowPhoenixDateString(): string {
  const now = new Date();
  const phx = new Date(now.getTime() - 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  const yyyy = phx.getUTCFullYear();
  const mm = String(phx.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(phx.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type Props = {
  open: boolean;
  contactName: string;
  onClose: () => void;
  onSubmit: (dueDate: string) => void;
};

export function RescheduleCallModal({
  open,
  contactName,
  onClose,
  onSubmit,
}: Props) {
  const today = todayPhoenixDateString();
  const tomorrow = tomorrowPhoenixDateString();
  const [date, setDate] = useState(tomorrow);

  // Reset to tomorrow each time the modal opens.
  useEffect(() => {
    if (open) setDate(tomorrow);
  }, [open, tomorrow]);

  const valid = date >= today;

  const submit = () => {
    if (!valid) return;
    onSubmit(date);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Queue call</DialogTitle>
          <DialogDescription>
            {contactName ? `Pick a date for ${contactName}.` : "Pick a date."}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.rescheduleField}>
          <label className={styles.rescheduleLabel} htmlFor="reschedule-date">
            Call back on
          </label>
          <input
            id="reschedule-date"
            type="date"
            className={styles.rescheduleInput}
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <button
            type="button"
            className={styles.btnMini}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold}`}
            onClick={submit}
            disabled={!valid}
          >
            Queue call
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
