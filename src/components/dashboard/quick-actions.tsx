"use client";

import { useState } from "react";
import { InteractionModal } from "@/components/interactions/interaction-modal";
import { TaskFormModal } from "@/components/tasks/task-form";
import { FollowUpFormModal } from "@/components/follow-ups/follow-up-form";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Phone, CheckSquare, Clock, UserPlus } from "lucide-react";

export function QuickActionsWidget({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  const [showInteraction, setShowInteraction] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => setShowContact(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            New contact
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => setShowInteraction(true)}
          >
            <Phone className="h-4 w-4 mr-2" />
            Log interaction
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => setShowTask(true)}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Add task
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => setShowFollowUp(true)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Follow-up
          </Button>
        </CardContent>
      </Card>

      <InteractionModal
        open={showInteraction}
        onOpenChange={setShowInteraction}
        onSuccess={onRefresh}
      />
      <TaskFormModal
        open={showTask}
        onOpenChange={setShowTask}
        onSuccess={onRefresh}
      />
      <FollowUpFormModal
        open={showFollowUp}
        onOpenChange={setShowFollowUp}
        onSuccess={onRefresh}
      />
      <ContactFormModal
        open={showContact}
        onOpenChange={setShowContact}
        onSuccess={onRefresh}
      />
    </>
  );
}
