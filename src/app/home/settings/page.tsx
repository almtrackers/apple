
"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import TokenContentPage from "./token-content"
import GeofenceContentPage from "./geofence-content"
import PinContentPage from "./pin-content"
import NotificationPreferencesComponent from "@/components/home/notification-preferences"
import OfflineMapManager from "@/components/home/offline-map-manager"
import ReportsContentPage from "./reports-content"
import { KeyRound, MapPin, Lock, Bell, Download, LineChart } from "lucide-react"

export default function SettingsPage() {
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Manage application and device settings.</CardDescription>
            </CardHeader>
            <Tabs defaultValue="notifications" className="w-full">
                <div className="overflow-x-auto tabs-scroll-container px-1">
                    <TabsList className="inline-flex w-max min-w-full">
                        <TabsTrigger value="notifications" className="flex-shrink-0">
                            <Bell className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Notifications</span>
                            <span className="sm:hidden">Notify</span>
                        </TabsTrigger>
                        <TabsTrigger value="offline" className="flex-shrink-0">
                            <Download className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Offline Maps</span>
                            <span className="sm:hidden">Offline</span>
                        </TabsTrigger>
                        <TabsTrigger value="token" className="flex-shrink-0">
                            <KeyRound className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">API Token</span>
                            <span className="sm:hidden">Token</span>
                        </TabsTrigger>
                        <TabsTrigger value="geofences" className="flex-shrink-0">
                            <MapPin className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Geofences</span>
                            <span className="sm:hidden">Zones</span>
                        </TabsTrigger>
                        <TabsTrigger value="pin" className="flex-shrink-0">
                            <Lock className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">PIN Settings</span>
                            <span className="sm:hidden">PIN</span>
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="flex-shrink-0">
                            <LineChart className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Reports</span>
                            <span className="sm:hidden">Reports</span>
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="notifications">
                    <NotificationPreferencesComponent />
                </TabsContent>
                <TabsContent value="offline">
                    <OfflineMapManager />
                </TabsContent>
                <TabsContent value="token">
                    <TokenContentPage />
                </TabsContent>
                <TabsContent value="geofences">
                    <GeofenceContentPage />
                </TabsContent>
                <TabsContent value="pin">
                    <PinContentPage />
                </TabsContent>
                <TabsContent value="reports">
                    <ReportsContentPage />
                </TabsContent>
            </Tabs>
        </Card>
    )
}
