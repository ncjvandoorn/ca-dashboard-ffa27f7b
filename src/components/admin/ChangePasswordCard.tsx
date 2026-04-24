import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const ChangePasswordCard = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [chrysalPassword, setChrysalPassword] = useState("");
  const [chrysalConfirm, setChrysalConfirm] = useState("");
  const [chrysalLoading, setChrysalLoading] = useState(false);

  const [taPassword, setTaPassword] = useState("");
  const [taConfirm, setTaConfirm] = useState("");
  const [taLoading, setTaLoading] = useState(false);

  const { changePassword } = useAuth();
  const { toast } = useToast();

  const manageCustomerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customers`;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await changePassword(newPassword);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Admin password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleChangeChrysalPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chrysalPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (chrysalPassword !== chrysalConfirm) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setChrysalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "reset_password_by_email",
          email: "chrysal@chrysal.app",
          password: chrysalPassword,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Success", description: "Chrysal password updated successfully" });
      setChrysalPassword("");
      setChrysalConfirm("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setChrysalLoading(false);
    }
  };

  const handleChangeTaPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (taPassword !== taConfirm) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setTaLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "reset_password_by_email",
          email: "ta@chrysal.app",
          password: taPassword,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Success", description: "TA password updated successfully" });
      setTaPassword("");
      setTaConfirm("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setTaLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Change Password</CardTitle>
            <CardDescription>Update the Admin or shared Chrysal account password</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Admin password */}
          <form onSubmit={handleChangePassword} className="space-y-4 border border-border rounded-lg p-4">
            <p className="text-sm font-medium">Admin password</p>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Update Admin Password
            </Button>
          </form>

          {/* Chrysal password */}
          <form onSubmit={handleChangeChrysalPassword} className="space-y-4 border border-border rounded-lg p-4">
            <p className="text-sm font-medium">Chrysal (internal) password</p>
            <div className="space-y-2">
              <Label htmlFor="chrysal-password">New Password</Label>
              <Input
                id="chrysal-password"
                type="password"
                value={chrysalPassword}
                onChange={(e) => setChrysalPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chrysal-confirm">Confirm Password</Label>
              <Input
                id="chrysal-confirm"
                type="password"
                value={chrysalConfirm}
                onChange={(e) => setChrysalConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>
            <Button type="submit" disabled={chrysalLoading} className="gap-2" variant="secondary">
              {chrysalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Update Chrysal Password
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
