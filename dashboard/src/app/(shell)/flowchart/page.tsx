import { redirect } from "next/navigation";

/** Flowchart UI was removed; keep route so old links/builds do not 404 on missing modules. */
export default function FlowchartRedirectPage() {
  redirect("/");
}
