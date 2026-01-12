"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Wrench } from "lucide-react";
import MaintenanceDashboard from "./maintenance-dashboard";
import TireManagement from "./tire-management";

export default function MaintenancePage() {
  return (
    <Card className="shadow-lg h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Maintenance</CardTitle>
        <CardDescription>Manage vehicle maintenance schedules, track service history, and monitor tire mileage.</CardDescription>
      </CardHeader>
      <Tabs defaultValue="dashboard" className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto tabs-scroll-container px-1 flex-shrink-0">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="dashboard" className="flex-shrink-0">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="tires" className="flex-shrink-0">
              <Wrench className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Tire Management</span>
              <span className="sm:hidden">Tires</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard" className="flex-1 overflow-auto pb-24">
          <MaintenanceDashboard />
        </TabsContent>
        <TabsContent value="tires" className="flex-1 overflow-auto pb-24">
          <TireManagement />
        </TabsContent>
      </Tabs>
    </Card>
  );
}


