import { useCallback, useState } from "react";
import { Share2, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  createSharedPage,
  SHARE_TTL_DAYS,
  type SharePageType,
} from "@/lib/sharePages";

interface SharePageButtonProps {
  pageType: SharePageType;
  /** Called at click time. Returns the JSON snapshot the public viewer will re-render from. */
  getPayload: () => unknown | Promise<unknown>;
  /** Disables the button (e.g. while data is still loading). */
  disabled?: boolean;
  size?: "sm" | "icon" | "default";
  label?: string;
}

export function SharePageButton({
  pageType,
  getPayload,
  disabled,
  size = "sm",
  label,
}: SharePageButtonProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    setBusy(true);
    try {
      const payload = await getPayload();
      const username = (user?.email || "").replace(/@chrysal\.app$/i, "") || null;
      const { url, expiresAt: exp } = await createSharedPage({
        pageType,
        payload,
        username,
      });
      setShareUrl(url);
      setExpiresAt(exp);
      setOpen(true);
      // Best-effort copy on creation
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        /* user can copy manually */
      }
    } catch (e: any) {
      console.error("Share page failed:", e);
      toast({
        title: "Share failed",
        description: e?.message || "Could not create share link",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [getPayload, pageType, user]);

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        disabled={disabled || busy}
        className="gap-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        {label ?? "Share page"}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCopied(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share link created</DialogTitle>
            <DialogDescription>
              Anyone with this link can view this page until{" "}
              <strong>{expiresAt?.toLocaleString()}</strong>{" "}
              ({SHARE_TTL_DAYS} days). No login required.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl ?? ""} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="icon" onClick={copyToClipboard}>
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The shared view captures a snapshot of the data at the moment you clicked Share. Updates
            after this point are not reflected.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
