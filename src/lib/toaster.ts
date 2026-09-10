import { OverlayToaster, type ToastProps } from "@blueprintjs/core";

const toasterPromise = OverlayToaster.createAsync({ position: "top-right", maxToasts: 4 });

export async function toast(props: ToastProps) {
  (await toasterPromise).show(props);
}
