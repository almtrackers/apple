"use client";

import { Card, CardContent } from "@/components/ui/card";
import { List, ListItem } from "@/components/ui/list";
import { ChevronRight, Gauge, Droplets, Route } from "lucide-react";
import Link from "next/link";

const reportItems = [
  {
    title: "Speeding Report",
    description: "Review all speeding incidents for your vehicles.",
    href: "/home/reports/speeding",
    icon: <Gauge className="h-6 w-6 text-primary" />,
  },
  {
    title: "Trip Report",
    description: "View detailed trip histories, including distance and duration.",
    href: "/home/history",
    icon: <Route className="h-6 w-6 text-primary" />,
  },
  {
    title: "Fuel Report",
    description: "Analyze fuel consumption for each trip.",
    href: "/home/reports/fuel",
    icon: <Droplets className="h-6 w-6 text-primary" />,
  },
];

export default function ReportsContentPage() {
  return (
    <CardContent>
      <List>
        {reportItems.map((item) => (
          <ListItem key={item.title}>
            <Link href={item.href} className="flex items-center gap-4 w-full">
              <div className="flex-shrink-0">{item.icon}</div>
              <div className="flex-grow">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </ListItem>
        ))}
      </List>
    </CardContent>
  );
}


