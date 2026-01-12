
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import apiClient from "@/lib/api";

const formSchema = z.object({
  password: z.string().min(1, { message: "Password zaroori hai." }),
});

interface Device {
  id: number;
  expirationTime?: string;
  attributes: {
    devicePassword?: string;
    [key: string]: any;
  };
}

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandType: "engineStop" | "engineResume";
  device: Device;
}

export default function PasswordDialog({ open, onOpenChange, commandType, device }: PasswordDialogProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Prevent commands for expired devices
    if (device?.expirationTime) {
      const t = Date.parse(device.expirationTime);
      if (!Number.isNaN(t) && Date.now() > t) {
        const msg = encodeURIComponent('how can i pay?');
        const url = `https://wa.me/923234402200?text=${msg}`;
        window.open(url, '_blank');
        return;
      }
    }
    const devicePassword = device.attributes?.devicePassword;

    if (!devicePassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Aap ko ya sahulat mayasar nahi",
      });
      return;
    }

    if (values.password !== devicePassword) {
      toast({
        variant: "destructive",
        title: "Nakam",
        description: "Password ghalat hai.",
      });
      return;
    }
    
    try {
        const res = await apiClient.post('/commands/send', {
            deviceId: device.id,
            type: commandType,
        });

        if (res.status === 200 || res.status === 202) {
            toast({
                title: "Kamyab",
                description: `Engine command "${commandType}" bhej diya gaya hai.`,
            });
            handleClose();
        } else {
             const errorData = res.data;
             toast({ variant: "destructive", title: "Error", description: errorData.message || "Command bhejne mein nakami." });
        }
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || "Network ya server ka masla.";
        toast({ variant: "destructive", title: "Error", description: errorMessage });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password likhain</DialogTitle>
          <DialogDescription>
            Is command ko execute karne ke liye apna device password likhain.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Bhejain
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
