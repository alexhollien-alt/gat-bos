"use client";

import { createClient } from "@/lib/supabase/client";
import { DesignAsset } from "@/lib/types";
import { DESIGN_ASSET_TYPE_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

export function DesignAssetCard({
  asset,
  onUpdate,
  showContact = false,
}: {
  asset: DesignAsset;
  onUpdate: () => void;
  showContact?: boolean;
}) {
  const supabase = createClient();

  async function handleDelete() {
    const { error } = await supabase
      .from("design_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", asset.id);
    if (error) {
      toast.error("Failed to remove asset");
    } else {
      toast.success("Asset removed");
      onUpdate();
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-slate-800 truncate">
            {asset.name}
          </p>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
            {DESIGN_ASSET_TYPE_LABELS[asset.asset_type]}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {showContact && asset.contacts && (
            <Link
              href={`/contacts/${asset.contacts.id}`}
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >
              {asset.contacts.first_name} {asset.contacts.last_name}
            </Link>
          )}
          {asset.listing_address && (
            <span className="text-xs text-slate-400">
              {asset.listing_address}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {format(new Date(asset.created_at), "MMM d, yyyy")}
          </span>
        </div>
      </div>
      <a
        href={asset.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-400 hover:text-blue-600 transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
