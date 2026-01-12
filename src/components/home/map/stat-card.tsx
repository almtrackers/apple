
"use client";

import { Card } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: React.ReactNode;
  value: string;
}

export default function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <Card className="p-2 sm:p-4 text-center bg-card/80 backdrop-blur-sm">
      <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-1 sm:mb-2" />
      <div className="text-lg sm:text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}
