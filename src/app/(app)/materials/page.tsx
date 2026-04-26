import { permanentRedirect } from "next/navigation";

export default function MaterialsRedirectPage(): never {
  permanentRedirect("/tickets");
}
