"use client";

import { Loader2 } from "@/components/icons";
import { Button } from "@/components/ui/button";

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  /** While true the button disables itself and shows a spinner */
  loading?: boolean;
};

/** Button for actions that hit the network: spinner + disabled while pending */
export function LoadingButton({
  loading = false,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={loading || disabled} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
