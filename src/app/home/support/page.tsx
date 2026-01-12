
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { List, ListItem } from "@/components/ui/list";
import { Phone, Mail, MessageSquare } from "lucide-react";

const supportItems = [
  {
    title: "Call Us",
    description: "Speak directly to a support agent.",
    href: "tel:+923111133170",
    icon: <Phone className="h-6 w-6 text-primary" />,
    value: "+92 311 1133170"
  },
  {
    title: "Email Us",
    description: "Get assistance via email.",
    href: "mailto:hello@almtrace.com",
    icon: <Mail className="h-6 w-6 text-primary" />,
    value: "hello@almtrace.com"
  },
  {
    title: "Live Chat",
    description: "Chat with our team on WhatsApp.",
    href: "https://wa.me/923234402200",
    icon: <MessageSquare className="h-6 w-6 text-primary" />,
    value: "Chat on WhatsApp"
  },
];

export default function SupportPage() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Support Center</CardTitle>
        <CardDescription>How can we help you? Choose a contact method below.</CardDescription>
      </CardHeader>
      <CardContent>
        <List>
          {supportItems.map((item) => (
            <ListItem key={item.title}>
              <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 w-full">
                <div className="flex-shrink-0">{item.icon}</div>
                <div className="flex-grow">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="text-sm font-medium text-primary">{item.value}</div>
              </a>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
