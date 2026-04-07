import Link from "next/link";
import { Contact, Tag } from "@/lib/types";
import { RelationshipBadge } from "@/components/relationship-badge";
import { TagChip } from "@/components/tags/tag-chip";
import { Building, Mail, Phone } from "lucide-react";

export function ContactCard({
  contact,
  tags,
}: {
  contact: Contact;
  tags: Tag[];
}) {
  return (
    <Link href={`/contacts/${contact.id}`}>
      <div className="border border-border rounded-lg p-4 bg-card hover:border-white/[0.12] transition-all">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-foreground">
              {contact.first_name} {contact.last_name}
            </h3>
            {contact.company && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {contact.title ? `${contact.title}, ` : ""}
                  {contact.company}
                </span>
              </div>
            )}
          </div>
          <RelationshipBadge relationship={contact.relationship} />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {contact.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
