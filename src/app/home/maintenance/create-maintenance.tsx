"use client";

import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import MaintenanceFormDialog from "./maintenance-form-dialog";

export default function CreateMaintenance() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <CardContent>
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Create New Maintenance Task</h3>
          <p className="text-sm text-muted-foreground">
            Set up a maintenance schedule for your vehicles. Track service intervals
            based on distance, time, or engine hours.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Create Maintenance Task
        </Button>
      </div>

      <MaintenanceFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        task={null}
        onSuccess={() => setIsFormOpen(false)}
      />
    </CardContent>
  );
}


