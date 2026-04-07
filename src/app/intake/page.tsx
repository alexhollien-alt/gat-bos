"use client";

import React, { useState, useRef } from "react";
import {
  Smartphone,
  TrendingUp,
  Database,
  Palette,
  PartyPopper,
  ShieldCheck,
  MessageCircle,
  Mail,
  Camera,
  Search,
  Truck,
  Wrench,
  Video,
  ClipboardList,
  Home,
  ChevronLeft,
  ArrowRight,
  X,
  MapPin,
  CalendarDays,
  Target,
  Sparkles,
  FileImage,
  BookOpen,
  Mailbox,
  DoorOpen,
  Share2,
  Monitor,
  UserCircle,
  CheckCircle2,
  Send,
  Quote,
  ExternalLink,
  Loader2,
  Package,
  Mic,
  GraduationCap,
  Heart,
  BadgePercent,
  BookOpenCheck,
  Handshake,
} from "lucide-react";

// ---------------------
// Styles
// ---------------------

const display = { fontFamily: "'Syne', system-ui, sans-serif" };
const body = { fontFamily: "'Inter', system-ui, sans-serif" };
const mono = { fontFamily: "'Space Mono', 'Courier New', monospace" };

// ---------------------
// Portfolio Data -- labels match actual document type
// ---------------------

const PORTFOLIO_ITEMS: { src: string; label: string; agent: string }[] = [
  { src: "/portfolio/chase-reynolds-luxury-brochure.png", label: "Luxury Brochure", agent: "Chase Reynolds" },
  { src: "/portfolio/courtney-cagle-flyer.png", label: "Listing Flyer", agent: "Courtney Cagle" },
  { src: "/portfolio/teri-armijo-luxury-brochure.png", label: "Brochure Spread", agent: "Teri Armijo" },
  { src: "/portfolio/andrea-garcia-brochure.png", label: "Brochure Front", agent: "Andrea Garcia" },
];

// ---------------------
// Discovery Flow
// ---------------------

type Situation =
  | "new_listing"
  | "just_sold"
  | "open_house"
  | "farming"
  | "branding"
  | null;

interface ProductOption {
  icon: React.ReactNode;
  title: string;
  description: string;
  popular?: boolean;
  value: string;
}

const SITUATIONS: { value: Situation; icon: React.ReactNode; title: string; subtitle: string }[] = [
  { value: "new_listing", icon: <MapPin className="h-6 w-6" />, title: "New Listing", subtitle: "I just took a listing" },
  { value: "just_sold", icon: <Sparkles className="h-6 w-6" />, title: "Just Sold", subtitle: "I want to announce a closed deal" },
  { value: "open_house", icon: <CalendarDays className="h-6 w-6" />, title: "Open House", subtitle: "I need event support" },
  { value: "farming", icon: <Target className="h-6 w-6" />, title: "Farming & Prospecting", subtitle: "I want to work a neighborhood" },
  { value: "branding", icon: <Palette className="h-6 w-6" />, title: "Branding & Collateral", subtitle: "I need materials for my business" },
];

const PRODUCT_OPTIONS: Record<NonNullable<Situation>, ProductOption[]> = {
  new_listing: [
    { icon: <FileImage className="h-5 w-5" />, title: "Property Flyer", value: "flyer", description: "Single-page feature sheet with photos, stats, and your branding", popular: true },
    { icon: <BookOpen className="h-5 w-5" />, title: "Multi-Page Brochure", value: "brochure", description: "Folded piece with full photo gallery and neighborhood details" },
    { icon: <Monitor className="h-5 w-5" />, title: "Property Website", value: "other", description: "Dedicated landing page with virtual tour and lead capture" },
    { icon: <Mail className="h-5 w-5" />, title: "Just Listed Postcard", value: "postcard", description: "Mailed announcement to the surrounding neighborhood" },
    { icon: <Share2 className="h-5 w-5" />, title: "Social Media Kit", value: "other", description: "Instagram, Facebook, and story graphics ready to post", popular: true },
    { icon: <ClipboardList className="h-5 w-5" />, title: "Listing Presentation", value: "other", description: "Branded pitch deck for your seller appointments" },
  ],
  just_sold: [
    { icon: <Mail className="h-5 w-5" />, title: "Just Sold Postcard", value: "postcard", description: "Mailed announcement to neighbors and your sphere", popular: true },
    { icon: <Share2 className="h-5 w-5" />, title: "Social Media Kit", value: "other", description: "Branded graphics announcing your closed deal" },
    { icon: <FileImage className="h-5 w-5" />, title: "Just Sold Flyer", value: "flyer", description: "Leave-behind or digital version for your records" },
    { icon: <Mailbox className="h-5 w-5" />, title: "EDDM Mailer", value: "eddm", description: "Every Door Direct Mail to a full carrier route", popular: true },
  ],
  open_house: [
    { icon: <FileImage className="h-5 w-5" />, title: "Open House Flyer", value: "flyer", description: "Event details, property highlights, and your contact info", popular: true },
    { icon: <DoorOpen className="h-5 w-5" />, title: "Door Hangers", value: "door_hanger", description: "Hang on neighboring doors to invite them", popular: true },
    { icon: <Share2 className="h-5 w-5" />, title: "Social Promo Kit", value: "other", description: "Event graphics for Instagram, Facebook, and stories" },
    { icon: <Mail className="h-5 w-5" />, title: "Invite Postcard", value: "postcard", description: "Mailed invitations to the surrounding area" },
    { icon: <ClipboardList className="h-5 w-5" />, title: "Sign-In Sheet", value: "other", description: "Branded sign-in for capturing attendee info" },
  ],
  farming: [
    { icon: <Mailbox className="h-5 w-5" />, title: "EDDM Mailer", value: "eddm", description: "Every Door Direct Mail to saturate a neighborhood", popular: true },
    { icon: <Mail className="h-5 w-5" />, title: "Farming Postcard", value: "postcard", description: "Market update, just sold, or seasonal mailing" },
    { icon: <DoorOpen className="h-5 w-5" />, title: "Door Hangers", value: "door_hanger", description: "Personal touch for targeted streets and blocks", popular: true },
    { icon: <FileImage className="h-5 w-5" />, title: "Community Flyer", value: "flyer", description: "Neighborhood stats, market data, and your positioning" },
    { icon: <Share2 className="h-5 w-5" />, title: "Social Content", value: "other", description: "Neighborhood-focused posts and reels for your farm area" },
  ],
  branding: [
    { icon: <Share2 className="h-5 w-5" />, title: "Social Media Graphics", value: "other", description: "Branded templates for posts, stories, and covers", popular: true },
    { icon: <FileImage className="h-5 w-5" />, title: "Agent Flyer", value: "flyer", description: "About-me or services overview one-pager" },
    { icon: <BookOpen className="h-5 w-5" />, title: "Capabilities Brochure", value: "brochure", description: "Multi-page piece showcasing your full service offering" },
    { icon: <ClipboardList className="h-5 w-5" />, title: "Listing Presentation", value: "other", description: "Seller pitch deck branded to your colors and style", popular: true },
    { icon: <Monitor className="h-5 w-5" />, title: "Agent Website Page", value: "other", description: "Personal landing page with bio, testimonials, and CTA" },
  ],
};

function DiscoveryFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [situation, setSituation] = useState<Situation>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", brokerage: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const handleSelect = (s: Situation) => { setSituation(s); setSelectedProducts([]); setStep(2); };

  const toggleProduct = (value: string, title: string) => {
    const key = `${value}:${title}`;
    setSelectedProducts((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || selectedProducts.length === 0) return;
    setSubmitting(true);
    try {
      const products = selectedProducts.map((p) => p.split(":")[0]);
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products,
          situation: situation || "general",
          agent: {
            agent_name: formData.name,
            agent_email: formData.email,
            agent_phone: formData.phone || undefined,
            brokerage: formData.brokerage || undefined,
          },
          honeypot: honeypot || undefined,
        }),
      });
      if (res.ok) setSubmitted(true);
    } catch {
      window.location.href = `sms:+14802042983?body=${encodeURIComponent(
        `Hey Alex -- I'm ${formData.name} from ${formData.brokerage || "my brokerage"}. I have a ${SITUATIONS.find((s) => s.value === situation)?.title?.toLowerCase() || "project"} and I'm interested in getting some materials made.`
      )}`;
    } finally {
      setSubmitting(false);
    }
  };

  const options = situation ? PRODUCT_OPTIONS[situation] : [];
  const sitLabel = SITUATIONS.find((s) => s.value === situation)?.title || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#131316", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-[#222228] flex items-center justify-center text-[#71717a] hover:text-[#f4f4f5] transition-colors z-10">
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 sm:p-10">
          {/* Step 1 */}
          {step === 1 && (
            <div className="intake-animate-in">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#e63550] font-semibold mb-3" style={mono}>Step 1 of 3</p>
              <h2 className="text-[24px] sm:text-[28px] text-[#f4f4f5] leading-tight mb-2" style={display}>What are you working on?</h2>
              <p className="text-[13px] text-[#71717a] mb-8" style={body}>Pick one and I'll show you what's available.</p>
              <div className="space-y-3">
                {SITUATIONS.map((s) => (
                  <button key={s.value} onClick={() => handleSelect(s.value)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-[#e63550]/30 hover:bg-[#e63550]/[0.02] text-left transition-all group" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#1a1a1f] flex items-center justify-center text-[#a1a1aa] group-hover:text-[#e63550] group-hover:bg-[#e63550]/[0.06] transition-colors">{s.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-[#f4f4f5] font-semibold mb-0.5" style={body}>{s.title}</div>
                      <div className="text-[12px] text-[#71717a]" style={body}>{s.subtitle}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#27272a] group-hover:text-[#e63550] transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && situation && (
            <div className="intake-animate-in">
              <button onClick={() => { setStep(1); setSituation(null); setSelectedProducts([]); }} className="flex items-center gap-1.5 text-[12px] text-[#71717a] hover:text-[#f4f4f5] transition-colors mb-6" style={body}><ChevronLeft className="h-3.5 w-3.5" />Back</button>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#e63550] font-semibold mb-3" style={mono}>Step 2 of 3 &middot; {sitLabel}</p>
              <h2 className="text-[24px] sm:text-[28px] text-[#f4f4f5] leading-tight mb-2" style={display}>Select what you need</h2>
              <p className="text-[13px] text-[#71717a] mb-8" style={body}>Everything is custom designed and branded to you. Pick all that apply.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {options.map((opt) => {
                  const key = `${opt.value}:${opt.title}`;
                  const isSelected = selectedProducts.includes(key);
                  return (
                    <button key={opt.title} onClick={() => toggleProduct(opt.value, opt.title)} className={`relative p-4 rounded-xl border text-left transition-all ${isSelected ? "border-[#e63550] bg-[#e63550]/[0.03]" : "border-white/[0.06] bg-[#131316] hover:border-white/[0.12]"}`} style={{ boxShadow: isSelected ? "0 2px 8px rgba(230,53,80,0.1)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
                      {opt.popular && <span className="absolute top-3 right-3 text-[8px] uppercase tracking-[0.1em] font-bold text-[#e63550] bg-[#e63550]/[0.08] px-2 py-0.5 rounded-full" style={body}>Popular</span>}
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#e63550]/10 text-[#e63550]" : "bg-[#1a1a1f] text-[#71717a]"}`}>{isSelected ? <CheckCircle2 className="h-4 w-4" /> : opt.icon}</div>
                        <h4 className="text-[13px] text-[#f4f4f5] font-semibold" style={body}>{opt.title}</h4>
                      </div>
                      <p className="text-[11px] text-[#71717a] leading-relaxed pl-11" style={body}>{opt.description}</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(3)} disabled={selectedProducts.length === 0} className="w-full flex items-center justify-center gap-2 bg-[#e63550] hover:bg-[#f04060] disabled:bg-[#27272a] disabled:cursor-not-allowed text-white rounded-xl px-6 py-3.5 transition-colors" style={{ ...body, fontWeight: 600, fontSize: "13px", letterSpacing: "0.03em" }}>Continue<ArrowRight className="h-4 w-4" /></button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && !submitted && (
            <div className="intake-animate-in">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-[12px] text-[#71717a] hover:text-[#f4f4f5] transition-colors mb-6" style={body}><ChevronLeft className="h-3.5 w-3.5" />Back</button>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#e63550] font-semibold mb-3" style={mono}>Step 3 of 3</p>
              <h2 className="text-[24px] sm:text-[28px] text-[#f4f4f5] leading-tight mb-2" style={display}>Tell me about you</h2>
              <p className="text-[13px] text-[#71717a] mb-8" style={body}>I'll reach out within 24 hours to get started on your materials.</p>
              <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="absolute opacity-0 h-0 w-0 pointer-events-none" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[10px] text-[#71717a] font-semibold mb-1.5 uppercase tracking-[0.15em]" style={body}>Full Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Jane Smith" className="w-full px-4 py-3 rounded-xl border border-white/[0.06] bg-[#1a1a1f] text-[14px] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10 transition-all" style={body} />
                </div>
                <div>
                  <label className="block text-[10px] text-[#71717a] font-semibold mb-1.5 uppercase tracking-[0.15em]" style={body}>Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="jane@brokerage.com" className="w-full px-4 py-3 rounded-xl border border-white/[0.06] bg-[#1a1a1f] text-[14px] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10 transition-all" style={body} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-[#71717a] font-semibold mb-1.5 uppercase tracking-[0.15em]" style={body}>Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(480) 555-1234" className="w-full px-4 py-3 rounded-xl border border-white/[0.06] bg-[#1a1a1f] text-[14px] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10 transition-all" style={body} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#71717a] font-semibold mb-1.5 uppercase tracking-[0.15em]" style={body}>Brokerage</label>
                    <input type="text" value={formData.brokerage} onChange={(e) => setFormData({ ...formData, brokerage: e.target.value })} placeholder="Keller Williams, Compass..." className="w-full px-4 py-3 rounded-xl border border-white/[0.06] bg-[#1a1a1f] text-[14px] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e63550]/40 focus:ring-2 focus:ring-[#e63550]/10 transition-all" style={body} />
                  </div>
                </div>
              </div>
              <div className="bg-[#1a1a1f] rounded-xl p-4 mb-6 border border-white/[0.06]">
                <p className="text-[10px] text-[#71717a] uppercase tracking-[0.15em] font-semibold mb-2" style={body}>Selected ({selectedProducts.length})</p>
                <div className="flex flex-wrap gap-2">{selectedProducts.map((p) => (<span key={p} className="text-[11px] text-[#a1a1aa] bg-[#131316] border border-white/[0.06] rounded-full px-3 py-1" style={body}>{p.split(":")[1]}</span>))}</div>
              </div>
              <button onClick={handleSubmit} disabled={!formData.name || !formData.email || submitting} className="w-full flex items-center justify-center gap-2 bg-[#e63550] hover:bg-[#f04060] disabled:bg-[#27272a] disabled:cursor-not-allowed text-white rounded-xl px-6 py-4 transition-colors" style={{ ...body, fontWeight: 600, fontSize: "14px", letterSpacing: "0.03em", boxShadow: "0 4px 14px rgba(230,53,80,0.25)" }}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</> : <><Send className="h-4 w-4" />Submit Request</>}
              </button>
            </div>
          )}

          {/* Success */}
          {submitted && (
            <div className="intake-animate-in text-center py-8">
              <div className="h-16 w-16 rounded-2xl bg-[#e63550]/10 flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="h-8 w-8 text-[#e63550]" /></div>
              <h2 className="text-[24px] sm:text-[28px] text-[#f4f4f5] leading-tight mb-3" style={display}>You're all set</h2>
              <p className="text-[14px] text-[#71717a] leading-relaxed max-w-sm mx-auto mb-8" style={body}>I've got your request and I'll reach out within 24 hours. Looking forward to working together.</p>
              <button onClick={onClose} className="inline-flex items-center gap-2 bg-[#e63550] hover:bg-[#f04060] text-white rounded-xl px-8 py-3.5 transition-colors" style={{ ...body, fontWeight: 600, fontSize: "14px" }}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------
// Service Data
// ---------------------

interface Service {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  accent: string;
  link?: string;
}

const SERVICES: Service[] = [
  { icon: <Smartphone className="h-5 w-5" />, title: "GAT App ONE", tagline: "#1 net sheet and closing cost app", description: "Seller net sheets, buyer estimates, and real estate calculators branded to you.", accent: "#e63550", link: "https://getgatapp.com/AlexHollien" },
  { icon: <Palette className="h-5 w-5" />, title: "Graphic Design", tagline: "Flyers, brochures, postcards, and more", description: "Listing flyers, multi-page brochures, EDDM mailers, door hangers, social graphics, and buyer/seller guides.", accent: "#2563eb" },
  { icon: <TrendingUp className="h-5 w-5" />, title: "Market Ready Tours", tagline: "Branded home tour videos", description: "Professional video walkthroughs delivered ready to post on MLS, social, and email.", accent: "#e63550" },
  { icon: <Package className="h-5 w-5" />, title: "Market Ready Merch", tagline: "Signs, stickers, and branded goods", description: "Metal signs, for-sale signs, open house signs, corrugated plastic, custom golf balls, and stickers.", accent: "#2563eb" },
  { icon: <Search className="h-5 w-5" />, title: "Market Reports & Intel", tagline: "Altos Research, weekly and daily data", description: "CrispData reports, Altos stats, weekly/daily real-time market data, and talking points for your clients.", accent: "#e63550" },
  { icon: <Database className="h-5 w-5" />, title: "FSBO, Expired & Lead Data", tagline: "7 lead sources for prospecting", description: "FSBO, expired, cancelled, and pre-foreclosure leads from seven platforms. Ownership research and mailing lists.", accent: "#2563eb" },
  { icon: <Mic className="h-5 w-5" />, title: "Podcast Studio", tagline: "In-house recording studio", description: "Record your own podcast, market updates, or get featured on The Great American Title Podcast.", accent: "#e63550" },
  { icon: <GraduationCap className="h-5 w-5" />, title: "CRM Training", tagline: "Streamline your workflow", description: "One-on-one CRM training to help you manage leads, automate follow-ups, and boost productivity.", accent: "#2563eb" },
  { icon: <PartyPopper className="h-5 w-5" />, title: "Open House Support", tagline: "Drive traffic and generate conversations", description: "Event planning, materials, and promotion that turn open houses into lead gen.", accent: "#e63550" },
  { icon: <Handshake className="h-5 w-5" />, title: "GAT Concierge", tagline: "Trusted vendors for your clients", description: "Roofing, insurance, moving, cleaning, landscape, painting, pool, HVAC, solar, and more -- vetted and discounted.", accent: "#2563eb" },
  { icon: <BadgePercent className="h-5 w-5" />, title: "Client Discounts", tagline: "20% off escrow for qualifying buyers", description: "First responders, military, seniors, teachers, and first-time homebuyers all receive 20% off basic escrow fees.", accent: "#e63550" },
  { icon: <Heart className="h-5 w-5" />, title: "GAT Cares", tagline: "7.5% donated to Arizona charities", description: "Your clients can direct 7.5% of escrow fees to a pre-approved nonprofit at closing. Over $2.8M donated since 2006.", accent: "#2563eb" },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Transaction Expertise", tagline: "Hands-on support across every step", description: "HOA/CC&R navigation, complex community knowledge, and your dedicated escrow officer.", accent: "#e63550" },
];

const ESCROW_OFFICERS = [
  { name: "Marlene Ruggeri", title: "Paradise Valley / Scottsdale" },
  { name: "Shalene", title: "Glendale" },
  { name: "Kasey Nash", title: "Surprise" },
  { name: "Jim Keith", title: "Gilbert Branch" },
];

interface Partner { icon: React.ReactNode; title: string; description: string; }
const PARTNERS: Partner[] = [
  { icon: <Camera className="h-5 w-5" />, title: "Photographers", description: "Listing photography, twilight shoots, aerial/drone" },
  { icon: <Video className="h-5 w-5" />, title: "Videographers", description: "Property tours, lifestyle reels, social content" },
  { icon: <ClipboardList className="h-5 w-5" />, title: "Inspectors", description: "Home, pool, roof, and specialty inspections" },
  { icon: <Truck className="h-5 w-5" />, title: "Movers", description: "Local and long-distance, white-glove service" },
  { icon: <Wrench className="h-5 w-5" />, title: "Contractors", description: "Renovations, repairs, pre-listing prep" },
  { icon: <Home className="h-5 w-5" />, title: "Stagers", description: "Staging, styling, and furniture rental" },
];

// ---------------------
// Highlight components
// ---------------------

const PRINT_HIGHLIGHTS = [
  "Flyers & feature sheets",
  "Multi-page brochures",
  "Postcards & EDDM mailers",
  "Door hangers",
  "Listing presentations",
  "Property websites",
  "Social media graphics",
  "Proximity maps",
];

// ---------------------
// Portfolio Swipe (mobile only)
// ---------------------

function PortfolioSwipe({ items }: { items: typeof PORTFOLIO_ITEMS }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / items.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(idx, items.length - 1));
  };

  const scrollTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / items.length;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
  };

  return (
    <div className="sm:hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="-mx-6 px-6 overflow-x-auto snap-x snap-mandatory flex gap-3"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl snap-start flex-shrink-0"
            style={{ width: "78vw" }}
          >
            <div className="aspect-[4/3] overflow-hidden bg-[#27272a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={`${item.label} for ${item.agent}`}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-[8px] text-white/60 uppercase tracking-[0.15em] font-semibold" style={body}>{item.label}</p>
              <p className="text-[12px] text-white font-medium" style={body}>{item.agent}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Pagination dots */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className="h-1.5 rounded-full transition-all duration-200"
            style={{
              width: activeIndex === i ? 20 : 6,
              backgroundColor: activeIndex === i ? "#e63550" : "#27272a",
            }}
            aria-label={`View portfolio item ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------
// Toolkit Accordion (mobile only)
// ---------------------

function ToolkitAccordion({ services }: { services: Service[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="sm:hidden divide-y divide-[#27272a]">
      {services.map((service, i) => {
        const isOpen = openIndex === i;
        const isLink = !!service.link;
        return (
          <div key={service.title}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center gap-3 py-3.5 text-left"
            >
              <div
                className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${service.accent}0c`, color: service.accent }}
              >
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[13px] text-[#f4f4f5] font-semibold" style={body}>{service.title}</h4>
                  {isLink && <ExternalLink className="h-3 w-3 text-[#3f3f46] flex-shrink-0" />}
                </div>
                <p className="text-[10px] text-[#71717a] leading-tight mt-0.5" style={body}>{service.tagline}</p>
              </div>
              <div
                className="flex-shrink-0 h-6 w-6 rounded-full bg-[#1a1a1f] flex items-center justify-center transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
              >
                <span className="text-[14px] text-[#71717a] leading-none">+</span>
              </div>
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{ maxHeight: isOpen ? "120px" : "0px", opacity: isOpen ? 1 : 0 }}
            >
              <div className="pl-11 pb-3">
                <p className="text-[12px] text-[#a1a1aa] leading-relaxed" style={body}>{service.description}</p>
                {isLink && (
                  <a
                    href={service.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#e63550] font-medium mt-1.5"
                    style={body}
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------
// Page
// ---------------------

export default function IntakeShowcase() {
  const [showDiscovery, setShowDiscovery] = useState(false);

  return (
    <div>
      {showDiscovery && <DiscoveryFlow onClose={() => setShowDiscovery(false)} />}

      {/* ── How It Works + Portfolio (merged) ── */}
      <div className="mb-10 intake-animate-in" style={{ animationDelay: "100ms" }}>
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#e63550] font-semibold mb-1" style={mono}>How It Works</p>
            <h3 className="text-[22px] sm:text-[26px] text-[#f4f4f5] leading-tight" style={display}>Three steps. Zero guesswork.</h3>
          </div>
          <button
            onClick={() => setShowDiscovery(true)}
            className="hidden sm:inline-flex items-center gap-2 text-[12px] text-[#71717a] hover:text-[#f4f4f5] transition-colors"
            style={body}
          >
            Get Yours Made
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3 steps inline */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { num: "01", title: "Tell me what you need", desc: "Text, email, or use the form on this page.", icon: <MessageCircle className="h-4 w-4" /> },
            { num: "02", title: "I design it, you approve", desc: "Custom materials branded to you. Review, revise, sign off.", icon: <Palette className="h-4 w-4" /> },
            { num: "03", title: "Delivered to a local office", desc: "Picked up at one of 11 offices, or posted and ready.", icon: <Send className="h-4 w-4" /> },
          ].map((step) => (
            <div key={step.num} className="flex items-start gap-3 bg-[#131316] rounded-xl border border-white/[0.06] p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#e63550]/10 flex items-center justify-center text-[#e63550]">{step.icon}</div>
              <div className="flex-1">
                <span className="text-[8px] uppercase tracking-[0.2em] text-[#e63550] font-bold" style={mono}>Step {step.num}</span>
                <h4 className="text-[13px] text-[#f4f4f5] font-semibold mt-0.5" style={body}>{step.title}</h4>
                <p className="text-[11px] text-[#71717a] leading-relaxed mt-0.5" style={body}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Portfolio proof -- swipe on mobile, grid on desktop */}

        {/* Mobile: horizontal scroll with snap */}
        <PortfolioSwipe items={PORTFOLIO_ITEMS} />

        {/* Desktop: flush 4-col grid */}
        <div className="hidden sm:grid grid-cols-4 gap-0">
          {PORTFOLIO_ITEMS.map((item, i) => (
            <div
              key={i}
              className="group relative overflow-hidden cursor-pointer"
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#27272a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt={`${item.label} for ${item.agent}`}
                  className="h-full w-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <p className="text-[8px] text-white/60 uppercase tracking-[0.15em] font-semibold" style={body}>{item.label}</p>
                <p className="text-[11px] text-white font-medium" style={body}>{item.agent}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── What Shows Up Every Week ── */}
      <div className="mb-10 intake-animate-in" style={{ animationDelay: "175ms" }}>
        <div
          className="relative rounded-xl overflow-hidden px-6 sm:px-8 py-6"
          style={{ background: "linear-gradient(135deg, #131316 0%, #1a1a1f 100%)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-semibold mb-4" style={mono}>What shows up without you asking</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 relative">
            {[
              { icon: <Mail className="h-4 w-4" />, title: "Weekly market intel", desc: "The Weekly Edge lands in your inbox every Wednesday with data, trends, and talking points for your market." },
              { icon: <Palette className="h-4 w-4" />, title: "On-demand design production", desc: "Text me what you need. Custom flyers, brochures, postcards, and social graphics -- designed and printed." },
              { icon: <Database className="h-4 w-4" />, title: "Prospecting data and lead lists", desc: "FSBO, expired, cancelled, and pre-foreclosure leads from seven platforms -- delivered ready to work." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-white/[0.08] flex items-center justify-center text-white/60 mt-0.5">{item.icon}</div>
                <div>
                  <h4 className="text-[12px] text-white font-semibold mb-0.5" style={body}>{item.title}</h4>
                  <p className="text-[11px] text-white/35 leading-relaxed" style={body}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-[#27272a] to-transparent mb-10" />

      {/* ── Your Toolkit ── */}
      <div className="mb-10 intake-animate-in" style={{ animationDelay: "200ms" }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#e63550] font-semibold mb-1" style={mono}>Your Toolkit</p>
            <h3 className="text-[22px] sm:text-[26px] text-[#f4f4f5] leading-tight" style={display}>Tools that come with the partnership</h3>
          </div>
        </div>

        {/* Mobile: accordion */}
        <ToolkitAccordion services={SERVICES} />

        {/* Desktop: 2-col list */}
        <div className="hidden sm:grid grid-cols-2 gap-x-8 gap-y-1">
          {SERVICES.map((service) => {
            const isLink = !!service.link;
            const Tag = isLink ? "a" : "div";
            const tagProps = isLink ? { href: service.link, target: "_blank", rel: "noopener noreferrer" } : {};
            return (
              <Tag
                key={service.title}
                {...tagProps}
                className="group flex items-start gap-3 py-3 border-b border-[#27272a] last:border-0 transition-colors hover:bg-[#1a1a1f] -mx-2 px-2 rounded-lg"
              >
                <div
                  className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${service.accent}0c`, color: service.accent }}
                >
                  {service.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[13px] text-[#f4f4f5] font-semibold" style={body}>{service.title}</h4>
                    {isLink && <ExternalLink className="h-3 w-3 text-[#3f3f46] group-hover:text-[#e63550] transition-colors flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[#71717a] leading-relaxed" style={body}>{service.description}</p>
                </div>
              </Tag>
            );
          })}
        </div>
      </div>

      {/* ── Referral Carousel (animated) ── */}
      <div className="mb-10 intake-animate-in" style={{ animationDelay: "250ms" }}>
        <div className="relative overflow-hidden">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#2563eb] font-semibold mb-1" style={mono}>Referral Network</p>
              <h3 className="text-[20px] sm:text-[22px] text-[#f4f4f5] leading-tight" style={display}>People you can confidently refer</h3>
            </div>
          </div>

          <div className="absolute left-0 top-12 bottom-0 w-12 bg-gradient-to-r from-[#09090b] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-12 bottom-0 w-12 bg-gradient-to-l from-[#09090b] to-transparent z-10 pointer-events-none" />

          <div className="flex gap-3 w-max" style={{ animation: "carousel-scroll 25s linear infinite" }} onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.animationPlayState = "running"; }}>
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <div key={`${p.title}-${i}`} className="flex-shrink-0 w-[180px] bg-[#131316] rounded-xl border border-white/[0.06] p-4 hover:shadow-md hover:border-white/[0.12] transition-all" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-2.5" style={{ backgroundColor: i % 2 === 0 ? "#e635500c" : "#2563eb0c", color: i % 2 === 0 ? "#e63550" : "#2563eb" }}>{p.icon}</div>
                <h4 className="text-[13px] text-[#f4f4f5] font-semibold mb-0.5" style={body}>{p.title}</h4>
                <p className="text-[10px] text-[#71717a] leading-relaxed" style={body}>{p.description}</p>
              </div>
            ))}
          </div>

          <style>{`
            @keyframes carousel-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @media (prefers-reduced-motion: reduce) {
              * { animation-name: none !important; }
            }
          `}</style>
        </div>
      </div>

      {/* ── Escrow Team (compact row) ── */}
      <div className="mb-10 intake-animate-in" style={{ animationDelay: "280ms" }}>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#2563eb] font-semibold mb-3" style={mono}>Your Escrow Team</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ESCROW_OFFICERS.map((officer) => (
            <div key={officer.name} className="flex items-center gap-2.5 bg-[#131316] rounded-xl border border-white/[0.06] px-4 py-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="h-8 w-8 rounded-full bg-[#1a1a1f] flex items-center justify-center border border-white/[0.06] flex-shrink-0">
                <UserCircle className="h-4 w-4 text-[#3f3f46]" />
              </div>
              <div>
                <p className="text-[12px] text-[#f4f4f5] font-semibold leading-tight" style={body}>{officer.name}</p>
                <p className="text-[9px] text-[#71717a]" style={body}>{officer.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA -- skinny, bright label ── */}
      <div
        className="relative rounded-2xl overflow-hidden px-6 sm:px-14 py-8 sm:py-10 text-center intake-animate-in"
        style={{
          background: "linear-gradient(160deg, #131316 0%, #1a1a1f 50%, #131316 100%)",
          animationDelay: "300ms",
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(230,53,80,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(37,99,235,0.10) 0%, transparent 50%)" }} />

        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#e63550] font-bold mb-4" style={mono}>The Promise</p>
          <h3 className="text-[20px] sm:text-[24px] text-white leading-[1.3] mb-3 max-w-lg mx-auto tracking-[-0.01em]" style={display}>
            I make sure the transaction you promised your client is the transaction they experience.
          </h3>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Quote className="h-3 w-3 text-white/25" />
            <p className="text-[11px] text-white/40 italic" style={display}>&ldquo;You are truly part of the 1%&rdquo;</p>
            <span className="text-white/15 text-[9px]">&mdash;</span>
            <p className="text-[10px] text-white/30" style={body}>Kristin Nelson, HomeSmart</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setShowDiscovery(true)}
              className="inline-flex items-center gap-2.5 bg-[#e63550] hover:bg-[#f04060] text-white rounded-xl px-7 py-3 transition-colors w-full sm:w-auto justify-center"
              style={{ ...body, fontWeight: 600, fontSize: "13px", letterSpacing: "0.03em", boxShadow: "0 4px 20px rgba(230,53,80,0.35)" }}
            >
              <ArrowRight className="h-4 w-4" />
              Get Started
            </button>
            <a
              href="sms:+14802042983?body=Hey Alex -- I'd like to learn more about working together."
              className="inline-flex items-center gap-2.5 text-white/60 hover:text-white rounded-xl px-7 py-3 border border-white/[0.08] hover:border-white/20 transition-all w-full sm:w-auto justify-center"
              style={{ ...body, fontWeight: 500, fontSize: "13px", letterSpacing: "0.03em" }}
            >
              <MessageCircle className="h-4 w-4" />
              Text Alex Instead
            </a>
          </div>
        </div>
      </div>

      {/* ── Signature + bottom headshot ── */}
      <div className="mt-10 text-center intake-animate-in" style={{ animationDelay: "340ms" }}>
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-16 sm:w-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alex-bottom.jpg" alt="Alex Hollien" className="h-full w-full object-cover object-top headshot-mask-sm" />
          </div>
          <div
            className="text-[24px] sm:text-[40px] text-[#f4f4f5]/70"
            style={{ fontFamily: "'Self Deception', cursive" }}
          >
            Alex Hollien
          </div>
          <p className="text-[9px] sm:text-[10px] text-[#71717a] uppercase tracking-[0.15em]" style={body}>
            (480) 204-2983 &nbsp;&middot;&nbsp; alex@alexhollienco.com
          </p>
        </div>
      </div>
    </div>
  );
}
