import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Phone, Landmark, Copy, Check, ArrowLeft, Loader2, Star, Rss, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import type { Store } from "@/data/stores";
import { BOOKABLE_CATEGORIES, REGION_BANK, DEFAULT_BANK } from "@/data/stores";
import type { Region } from "@/data/stores";
import { buildInstagramUrl, buildTikTokUrl, getImageUrl } from "@/lib/utils";

const isBookable = (cat: string) => (BOOKABLE_CATEGORIES as readonly string[]).includes(cat);

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const COUNTRY_OPTIONS = getCountries()
  .map((country) => {
    const code = getCountryCallingCode(country);
    const name = regionNames?.of(country) ?? country;
    return {
      value: country,
      label: `${name} (+${code})`,
      code,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

function makeRef() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return "LKL-" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 6);
}

function normalizePhoneForAlerts(raw: string, country: CountryCode): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const countryCode = getCountryCallingCode(country);

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;

  // If user pasted an international number but forgot "+", accept as-is.
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 6 && digits.length <= 15) {
    return `+${digits}`;
  }

  const localDigits = digits.replace(/^0+/, "");
  if (!localDigits) return null;
  if (localDigits.length < 6 || localDigits.length > 14) return null;
  return `+${countryCode}${localDigits}`;
}

type AvailabilityRow = {
  id: string;
  store_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_bookings_per_slot: number;
};

type StaffRow = {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  active: boolean;
  position: number;
  daily_capacity?: number | null;
  available_days?: number[] | null;
};

const BOOKING_CATEGORIES: string[] = [...BOOKABLE_CATEGORIES];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function generateTimeSlots(startTime: string, endTime: string, durationMins: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  while (minutes + durationMins <= endMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    minutes += durationMins;
  }
  return slots;
}

export function StoreDialog({ store, open, onOpenChange }: { store: Store | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<"browse" | "arrange" | "transfer">("browse");
  const [bookingDepositDue, setBookingDepositDue] = useState<{ amount: number; service: string | null } | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState<CountryCode>("GB");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState(() => makeRef());
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMsgForm, setShowMsgForm] = useState(false);
  const [msgName, setMsgName] = useState("");
  const [msgPhone, setMsgPhone] = useState("");
  const [msgCountryCode, setMsgCountryCode] = useState<CountryCode>("GB");
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Reviews
  type ReviewRow = { id: string; reviewer_name: string; rating: number; body: string | null; created_at: string };
  const [storeReviews, setStoreReviews] = useState<ReviewRow[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewName, setReviewName] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Posts / updates feed
  type PostRow = { id: string; store_id: string; body: string; image_url: string | null; created_at: string };
  const [storePosts, setStorePosts] = useState<PostRow[]>([]);
  const [postsTab, setPostsTab] = useState<"info" | "updates">("info");

  // Follow state
  const [followerId, setFollowerId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCount, setFollowCount] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);

  // Booking state (Barbers / Beauty)
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookService, setBookService] = useState("");
  const [bookStaffId, setBookStaffId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookPhoneCountry, setBookPhoneCountry] = useState<CountryCode>("GB");
  const [bookNote, setBookNote] = useState("");
  const [bookAvailability, setBookAvailability] = useState<AvailabilityRow[]>([]);
  const [bookStaff, setBookStaff] = useState<StaffRow[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Staff ratings (display only — customers rate via email link after appointment)
  const [staffRatings, setStaffRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [staffBookingCounts, setStaffBookingCounts] = useState<Record<string, number>>({});
  const [bookEmail, setBookEmail] = useState("");

  useEffect(() => {
    if (!open || !store) return;
    (supabase as any)
      .from("reviews")
      .select("id, reviewer_name, rating, body, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: ReviewRow[] | null }) => {
        setStoreReviews(data ?? []);
      });
  }, [open, store?.id]);

  // Load posts for this store
  useEffect(() => {
    if (!open || !store) return;
    setStorePosts([]);
    (supabase as any)
      .from("store_posts")
      .select("id, store_id, body, image_url, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }: { data: PostRow[] | null }) => {
        setStorePosts(data ?? []);
      });
  }, [open, store?.id]);

  // Load auth user + follow state
  useEffect(() => {
    if (!open || !store) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setFollowerId(uid);
      if (uid) {
        const { count } = await (supabase as any)
          .from("store_follows")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id);
        setFollowCount(count ?? 0);
        const { data: myFollow } = await (supabase as any)
          .from("store_follows")
          .select("user_id")
          .eq("store_id", store.id)
          .eq("user_id", uid)
          .maybeSingle();
        setIsFollowing(!!myFollow);
      } else {
        const { count } = await (supabase as any)
          .from("store_follows")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id);
        setFollowCount(count ?? 0);
        setIsFollowing(false);
      }
    })();
  }, [open, store?.id]);

  // Load weekly availability for bookable stores
  useEffect(() => {
    if (!open || !store || !BOOKING_CATEGORIES.includes(store.category)) return;
    (supabase as any)
      .from("store_availability")
      .select("*")
      .eq("store_id", store.id)
      .then(({ data }: { data: AvailabilityRow[] | null }) => {
        setBookAvailability(data ?? []);
      });

    (supabase as any)
      .from("store_staff")
      .select("*")
      .eq("store_id", store.id)
      .eq("active", true)
      .order("position", { ascending: true })
      .then(({ data }: { data: StaffRow[] | null }) => {
        setBookStaff(data ?? []);
      });

    // Load staff ratings for this store
    (supabase as any)
      .from("staff_reviews")
      .select("staff_id, rating")
      .eq("store_id", store.id)
      .then(({ data }: { data: Array<{ staff_id: string; rating: number }> | null }) => {
        const sums: Record<string, { total: number; count: number }> = {};
        (data ?? []).forEach((r) => {
          if (!sums[r.staff_id]) sums[r.staff_id] = { total: 0, count: 0 };
          sums[r.staff_id].total += r.rating;
          sums[r.staff_id].count += 1;
        });
        const map: Record<string, { avg: number; count: number }> = {};
        Object.keys(sums).forEach((k) => { map[k] = { avg: sums[k].total / sums[k].count, count: sums[k].count }; });
        setStaffRatings(map);
      });
  }, [open, store?.id]);

  // Load taken slots when date is selected
  useEffect(() => {
    if (!bookDate || !store) {
      setSlotCounts({});
      setStaffBookingCounts({});
      setBookTime("");
      return;
    }
    setLoadingSlots(true);
    (supabase as any)
      .from("store_bookings")
      .select("slot_start, staff_id")
      .eq("store_id", store.id)
      .neq("status", "cancelled")
      .gte("slot_start", `${bookDate}T00:00:00`)
      .lte("slot_start", `${bookDate}T23:59:59`)
      .then(({ data }: { data: Array<{ slot_start: string; staff_id: string | null }> | null }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r) => {
          const time = r.slot_start.slice(11, 16);
          counts[time] = (counts[time] ?? 0) + 1;
        });
        setSlotCounts(counts);
        const sCounts: Record<string, number> = {};
        (data ?? []).forEach((r) => { if (r.staff_id) sCounts[r.staff_id] = (sCounts[r.staff_id] ?? 0) + 1; });
        setStaffBookingCounts(sCounts);
        setBookTime("");
        setLoadingSlots(false);
      })
      .catch(() => {
        setSlotCounts({});
        setStaffBookingCounts({});
        setLoadingSlots(false);
      });
  }, [bookDate, store?.id]);

  useEffect(() => {
    if (!bookStaffId) return;
    if (!bookDate) return;
    const [yr, mo, dy] = bookDate.split("-").map(Number);
    const day = new Date(yr, mo - 1, dy).getDay();
    const selected = bookStaff.find((m) => m.id === bookStaffId);
    if (!selected) return;
    if (!Array.isArray(selected.available_days) || selected.available_days.length === 0) return;
    if (selected.available_days.includes(day)) return;
    setBookStaffId("");
  }, [bookStaffId, bookDate, bookStaff]);

  if (!store) return null;

  const socialLinks = [
    store.instagramHandle ? { label: "Instagram", href: buildInstagramUrl(store.instagramHandle) } : null,
    store.tiktokHandle ? { label: "TikTok", href: buildTikTokUrl(store.tiktokHandle) } : null,
    store.websiteUrl ? { label: "Website", href: store.websiteUrl } : null,
  ].filter((item): item is { label: string; href: string | null } => !!item && !!item.href);


  const items = store.products.map((p) => ({ ...p, qty: qty[p.name] ?? 0 }));
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const hasItems = total > 0;
  const selectedBookingDay = bookDate
    ? (() => {
        const [yr, mo, dy] = bookDate.split("-").map(Number);
        return new Date(yr, mo - 1, dy).getDay();
      })()
    : null;
  const availableBookStaff = selectedBookingDay == null
    ? bookStaff
    : bookStaff.filter((member) => {
        if (!Array.isArray(member.available_days) || member.available_days.length === 0) return true;
        return member.available_days.includes(selectedBookingDay);
      });

  const reset = () => {
    setStep("browse");
    setQty({});
    setName("");
    setPhone("");
    setPhoneCountryCode("GB");
    setEmail("");
    setNote("");
    setReference(makeRef());
    setShowMsgForm(false);
    setMsgName(""); setMsgPhone(""); setMsgCountryCode("GB"); setMsgBody("");
    setShowReviewForm(false);
    setReviewRating(0); setReviewName(""); setReviewBody("");
    setShowBookingForm(false);
    setBookService(""); setBookStaffId(""); setBookDate(""); setBookTime(""); setBookName(""); setBookPhone(""); setBookNote(""); setBookEmail("");
    setBookAvailability([]); setBookStaff([]); setSlotCounts({}); setStaffBookingCounts({});
    setStaffRatings({});
    setStorePosts([]);
    setPostsTab("info");
    setFollowerId(null); setIsFollowing(false); setFollowCount(0);
  };

  const handleConfirmTransfer = async () => {
    const normalizedPhone = normalizePhoneForAlerts(phone, phoneCountryCode);
    if (!normalizedPhone) {
      toast.error("Enter phone in international format", {
        description: "Choose a country and enter your local mobile number.",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).from("orders").insert({
        store_id: store.id,
        reference,
        customer_name: name.trim(),
        customer_phone: normalizedPhone,
        customer_email: email.trim() || null,
        note: note.trim() || null,
        items: items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, price: i.price, qty: i.qty, unit: i.unit })),
        total_gbp: total,
        status: "pending_transfer",
      });
      if (error) throw error;

      // Fire-and-forget email alert to merchant.
      void supabase.functions.invoke("send-whatsapp-alert", {
        body: {
          reference,
          total_gbp: total,
          customer_name: name.trim(),
          store_name: store.name,
          store_id: store.id,
          items: items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
        },
      }).then(({ error: fnError }) => {
        if (fnError) {
          console.error("send-order-alert failed", fnError.message);
        }
      });

      toast.success("Order placed!", {
        description: `Track it at lokalshops.co.uk/order using reference ${reference}`,
        duration: 8000,
      });
      onOpenChange(false);
      setTimeout(reset, 200);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save your order");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!store) return;
    if (!followerId) {
      toast("Sign in to follow stores", { description: "Create a free account to follow your favourite shops." });
      return;
    }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await (supabase as any).from("store_follows").delete().eq("store_id", store.id).eq("user_id", followerId);
        setIsFollowing(false);
        setFollowCount((c) => Math.max(0, c - 1));
        toast.success("Unfollowed");
      } else {
        await (supabase as any).from("store_follows").insert({ store_id: store.id, user_id: followerId });
        setIsFollowing(true);
        setFollowCount((c) => c + 1);
        toast.success(`Following ${store.name}!`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not update follow");
    } finally {
      setFollowLoading(false);
    }
  };

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSendMsg = async () => {
    const normalizedMsgPhone = normalizePhoneForAlerts(msgPhone, msgCountryCode);
    if (!normalizedMsgPhone) {
      toast.error("Enter phone in international format", {
        description: "Choose a country and enter your local mobile number.",
      });
      return;
    }

    setSendingMsg(true);
    try {
      const { error } = await (supabase as any).from("messages").insert({
        store_id: store.id,
        customer_name: msgName.trim(),
        customer_phone: normalizedMsgPhone,
        body: msgBody.trim(),
        direction: "inbound",
      });
      if (error) throw error;
      toast.success("Enquiry sent!", { description: `${store.name} will reply to you on WhatsApp or by phone.` });
      setShowMsgForm(false);
      setMsgName(""); setMsgPhone(""); setMsgBody("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not send message");
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const { error, data } = await (supabase as any).from("reviews").insert({
        store_id: store.id,
        reviewer_name: reviewName.trim(),
        rating: reviewRating,
        body: reviewBody.trim() || null,
      }).select("id, reviewer_name, rating, body, created_at").single();
      if (error) throw error;
      setStoreReviews([data, ...storeReviews]);

      // Fire-and-forget merchant email alert for the new review.
      void supabase.functions.invoke("send-review-alert", {
        body: {
          store_id: store.id,
          store_name: store.name,
          reviewer_name: reviewName.trim(),
          rating: reviewRating,
          body: reviewBody.trim() || null,
        },
      }).then(({ error: fnError }) => {
        if (fnError) {
          console.error("send-review-alert failed", fnError.message);
        }
      });

      setShowReviewForm(false);
      setReviewRating(0); setReviewName(""); setReviewBody("");
      toast.success("Review submitted — thanks!");
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleShareStore = () => {
    if (!store) return;
    const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
    const shareUrl = `${domain}/store/${store.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    toast.success("Share link copied!");
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleBook = async () => {
    const selectedStaff = bookStaff.find((s) => s.id === bookStaffId) ?? null;
    if (selectedStaff && selectedBookingDay != null && Array.isArray(selectedStaff.available_days) && selectedStaff.available_days.length > 0 && !selectedStaff.available_days.includes(selectedBookingDay)) {
      toast.error("Selected team member is unavailable on this day");
      return;
    }
    const normalizedBookPhone = normalizePhoneForAlerts(bookPhone, bookPhoneCountry);
    if (!normalizedBookPhone) {
      toast.error("Enter phone in international format", { description: "Choose a country and enter your local mobile number." });
      return;
    }
    if (!bookDate || !bookTime || !bookName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (bookStaff.length > 0 && !selectedStaff) {
      toast.error("Please choose a team member");
      return;
    }
    const [y, mo, d] = bookDate.split("-").map(Number);
    const avail = bookAvailability.find((a) => a.day_of_week === new Date(y, mo - 1, d).getDay());
    const duration = avail?.slot_duration_mins ?? 30;
    const [th, tm] = bookTime.split(":").map(Number);
    const endMins = th * 60 + tm + duration;
    const slotEnd = `${bookDate}T${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}:00`;
    setSubmittingBooking(true);
    try {
      const { error } = await (supabase as any).from("store_bookings").insert({
        store_id: store!.id,
        customer_name: bookName.trim(),
        customer_phone: normalizedBookPhone,
        customer_email: bookEmail.trim() || null,
        service: bookService || null,
        staff_id: selectedStaff?.id ?? null,
        staff_name: selectedStaff?.name ?? null,
        staff_phone: selectedStaff?.phone ?? null,
        slot_start: `${bookDate}T${bookTime}:00`,
        slot_end: slotEnd,
        status: "pending",
        note: bookNote.trim() || null,
      });
      if (error) throw error;

      // Send confirmation to customer (fire-and-forget)
      if (bookEmail.trim()) {
        void supabase.functions.invoke("send-booking-customer-confirmation", {
          body: {
            store_name: store!.name,
            customer_name: bookName.trim(),
            customer_email: bookEmail.trim(),
            service: bookService || null,
            staff_name: selectedStaff?.name ?? null,
            slot_start: `${bookDate}T${bookTime}:00`,
            customer_phone: normalizedBookPhone,
          },
        });
      }

      // Notify the merchant by email + SMS (fire-and-forget)
      void supabase.functions.invoke("send-booking-alert", {
        body: {
          store_id: store!.id,
          store_name: store!.name,
          customer_name: bookName.trim(),
          customer_phone: normalizedBookPhone,
          service: bookService || null,
          staff_name: selectedStaff?.name ?? null,
          staff_phone: selectedStaff?.phone ?? null,
          slot_start: `${bookDate}T${bookTime}:00`,
          note: bookNote.trim() || null,
        },
      });

      const prettyDate = new Date(y, mo - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      const serviceDeposit = bookService ? store!.products?.find((p) => p.name === bookService)?.deposit : undefined;
      const depositAmount = serviceDeposit ?? store!.deposit_amount ?? null;
      if (depositAmount) {
        setBookingDepositDue({ amount: Number(depositAmount), service: bookService || null });
      } else {
        toast.success("Appointment requested!", {
          description: `${store!.name} will confirm your ${bookTime} slot on ${prettyDate}.`,
          duration: 8000,
        });
      }
      setShowBookingForm(false);
      if (bookingDepositDue) {
        // keep dialog open — deposit panel shows
      }
      setBookService(""); setBookStaffId(""); setBookDate(""); setBookTime(""); setBookName(""); setBookPhone(""); setBookNote(""); setBookEmail("");
      setSlotCounts((prev) => ({ ...prev, [bookTime]: (prev[bookTime] ?? 0) + 1 }));
      if (selectedStaff?.id) {
        setStaffBookingCounts((prev) => ({ ...prev, [selectedStaff.id]: (prev[selectedStaff.id] ?? 0) + 1 }));
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not request booking");
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <div className="relative h-56 overflow-hidden rounded-t-lg">
          <img src={store.image} alt={store.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-background/90 px-2.5 py-1 font-medium backdrop-blur">{store.origin}</span>
              <span className="rounded-full bg-background/90 px-2.5 py-1 font-medium backdrop-blur">{store.category}</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-3xl">{store.name}</DialogTitle>
            <DialogDescription className="text-base">{store.description}</DialogDescription>
          </DialogHeader>

          {/* Follow button */}
          <div className="mt-3 flex items-center gap-3">
            <Button
              size="sm"
              variant={isFollowing ? "default" : "outline"}
              className={isFollowing ? "bg-primary text-primary-foreground gap-1.5" : "gap-1.5"}
              onClick={handleToggleFollow}
              disabled={followLoading}
            >
              {followLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className={`h-3.5 w-3.5${isFollowing ? " fill-current" : ""}`} />}
              {isFollowing ? "Following" : "Follow"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleShareStore}
            >
              {copiedShare ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copiedShare ? "Copied!" : "Share"}
            </Button>
            {followCount > 0 && (
              <span className="text-xs text-muted-foreground">{followCount} follower{followCount !== 1 ? "s" : ""} on Lokal</span>
            )}
          </div>

          {/* Info / Updates tabs */}
          <div className="mt-4 flex gap-1 rounded-lg bg-secondary/60 p-1 w-fit">
            <button
              onClick={() => setPostsTab("info")}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${postsTab === "info" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Info
            </button>
            <button
              onClick={() => setPostsTab("updates")}
              className={`relative rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${postsTab === "updates" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Updates
              {storePosts.length > 0 && postsTab !== "updates" && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{storePosts.length > 9 ? "9+" : storePosts.length}</span>
              )}
            </button>
          </div>

          {postsTab === "updates" && (
            <div className="mt-4 space-y-4">
              {storePosts.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border bg-secondary/30 p-10 text-center">
                  <Rss className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">{store.name} hasn't posted any updates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Follow them to be first to know when they post.</p>
                </div>
              ) : (
                storePosts.map((post) => (
                  <div key={post.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-2">{new Date(post.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="text-sm whitespace-pre-wrap">{post.body}</p>
                    {post.image_url && (
                      <div className="mt-3 overflow-hidden rounded-lg max-h-72 bg-secondary">
                        <img src={getImageUrl(post.image_url) || ""} alt="" className="w-full object-cover" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {postsTab === "info" && (
          <>
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              {(store.address || store.city || store.postcode) ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([store.address, store.city, store.postcode].filter(Boolean).join(", "))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="leading-snug hover:text-primary hover:underline"
                >
                  {[store.address, store.city, store.postcode].filter(Boolean).join(", ")}
                </a>
              ) : (
                <span>Location on request</span>
              )}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-background/70 px-3 py-2 text-foreground shadow-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0" /><span className="font-medium leading-5">{store.hours}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="truncate">{store.phone}</span></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(store.fulfillment === "collection" || store.fulfillment === "both") && (
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🏪 Collection available</span>
            )}
            {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">🚚 Delivery available</span>
            )}
          </div>

          {step === "browse" && (
            <>
              {isBookable(store.category) ? (
                <>
                  {bookingDepositDue && (
                    <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
                      <p className="font-semibold text-amber-900">✅ Booking request sent!</p>
                      <p className="mt-1 text-sm text-amber-800">
                        To confirm your appointment, send a deposit of <strong>£{bookingDepositDue.amount.toFixed(2)}</strong>
                        {bookingDepositDue.service ? ` for ${bookingDepositDue.service}` : ""} to:
                      </p>
                      <div className="mt-3 space-y-1 text-sm font-mono text-amber-900">
                        <div><span className="text-amber-600 not-italic">Bank: </span>{store.bank.name}</div>
                        <div><span className="text-amber-600 not-italic">Name: </span>{store.bank.accountName}</div>
                        <div><span className="text-amber-600 not-italic">Account: </span>{store.bank.accountNumber}</div>
                        {store.bank.sortCode && <div><span className="text-amber-600 not-italic">{(REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel}: </span>{store.bank.sortCode}</div>}
                      </div>
                      <Button size="sm" variant="outline" className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setBookingDepositDue(null)}>
                        Book another appointment
                      </Button>
                    </div>
                  )}
                  {store.products.length > 0 && (
                    <>
                      <h4 className="mt-6 font-display text-xl font-bold">Services</h4>
                      <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                        {store.products.map((p) => (
                          <div key={p.name} className="flex items-center justify-between gap-4 p-4">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-sm font-semibold">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
                    <p className="font-semibold text-sm">📅 Book an appointment</p>
                    {bookAvailability.length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground">This shop hasn't set up online booking yet. Use the enquiry form below to get in touch.</p>
                    ) : (
                      <>
                        {store.products.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Service</label>
                            <Select value={bookService} onValueChange={setBookService}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a service" /></SelectTrigger>
                              <SelectContent>
                                {store.products.map((p) => (
                                  <SelectItem key={p.name} value={p.name}>{p.name} — £{p.price.toFixed(2)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {bookStaff.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Team member *</label>
                            <Select value={bookStaffId} onValueChange={setBookStaffId}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose who you want to book with" /></SelectTrigger>
                              <SelectContent>
                                {availableBookStaff.map((member) => {
                                  const atCapacity = !!bookDate && member.daily_capacity != null && (staffBookingCounts[member.id] ?? 0) >= member.daily_capacity;
                                  const dayLabel = Array.isArray(member.available_days) && member.available_days.length > 0
                                    ? member.available_days.slice().sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(",")
                                    : "All days";
                                  return (
                                    <SelectItem key={member.id} value={member.id} disabled={atCapacity}>
                                      {member.name}{staffRatings[member.id] ? ` · ★ ${staffRatings[member.id].avg.toFixed(1)} (${staffRatings[member.id].count})` : ""}{` · ${dayLabel}`}{atCapacity ? " · Full on selected day" : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {bookDate && availableBookStaff.length === 0 && (
                              <p className="mt-1 text-xs text-amber-600">No team members are available on this day. Pick another date.</p>
                            )}
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Date *</label>
                          <Input
                            type="date"
                            value={bookDate}
                            min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()}
                            max={(() => { const d = new Date(); d.setDate(d.getDate() + 28); return d.toISOString().split("T")[0]; })()}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) { setBookDate(""); setBookTime(""); return; }
                              const [yr, mo, dy] = val.split("-").map(Number);
                              const day = new Date(yr, mo - 1, dy).getDay();
                              if (!bookAvailability.some((a) => a.day_of_week === day)) {
                                toast.error("No availability on this day — pick another date.");
                                return;
                              }
                              setBookDate(val);
                            }}
                            className="mt-1"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Booking days: {[...bookAvailability]
                              .sort((a, b) => a.day_of_week - b.day_of_week)
                              .map((a) => `${DAY_LABELS[a.day_of_week]} ${a.start_time.slice(0, 5)}-${a.end_time.slice(0, 5)}`)
                              .join(", ")}
                          </p>
                        </div>
                        {bookDate && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Time slot *</label>
                            {loadingSlots ? (
                              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading slots…</div>
                            ) : (() => {
                              const [yr, mo, dy] = bookDate.split("-").map(Number);
                              const dayOfWeek = new Date(yr, mo - 1, dy).getDay();
                              const avail = bookAvailability.find((a) => a.day_of_week === dayOfWeek);
                              if (!avail) return null;
                              const allSlots = generateTimeSlots(avail.start_time.slice(0, 5), avail.end_time.slice(0, 5), avail.slot_duration_mins);
                              
                              // Check if date is today
                              const now = new Date();
                              const today = now.toISOString().split("T")[0];
                              const isToday = bookDate === today;
                              const currentHour = now.getHours();
                              const currentMinute = now.getMinutes();

                              // Mark slots as disabled if full or in the past
                              const slotDisabled = (s: string) => {
                                const isFull = (slotCounts[s] ?? 0) >= (avail.max_bookings_per_slot ?? 1);
                                const isPast = isToday && s < `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
                                return isFull || isPast;
                              };
                              
                              const availableSlots = allSlots.filter((s) => !slotDisabled(s));
                              if (availableSlots.length === 0) return <p className="mt-1 text-sm text-amber-600">No available slots on this day — try another date.</p>;
                              return (
                                <Select value={bookTime} onValueChange={setBookTime}>
                                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a time" /></SelectTrigger>
                                  <SelectContent>
                                    {allSlots.map((s) => {
                                      const isFull = (slotCounts[s] ?? 0) >= (avail.max_bookings_per_slot ?? 1);
                                      const isPast = isToday && s < `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
                                      return (
                                        <SelectItem key={s} value={s} disabled={isFull || isPast}>
                                          {s}{isFull && " (Full)"}{isPast && " (Passed)"}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Your name *</label>
                          <Input value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Your phone *</label>
                          <div className="mt-1 grid grid-cols-12 gap-2">
                            <div className="col-span-5 sm:col-span-4">
                              <Select value={bookPhoneCountry} onValueChange={(v) => setBookPhoneCountry(v as CountryCode)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-7 sm:col-span-8">
                              <Input value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} placeholder="Local number" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Email (optional — for rating reminder)</label>
                          <Input value={bookEmail} onChange={(e) => setBookEmail(e.target.value)} placeholder="you@example.com" type="email" className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
                          <Textarea value={bookNote} onChange={(e) => setBookNote(e.target.value)} placeholder="Any special requests?" rows={2} className="mt-1" />
                        </div>
                        {(() => {
                            const serviceDeposit = bookService
                              ? store.products?.find((p) => p.name === bookService)?.deposit
                              : undefined;
                            const depositAmount = serviceDeposit ?? store.deposit_amount;
                            return depositAmount ? (
                              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                                💳 A deposit of <strong>£{Number(depositAmount).toFixed(2)}</strong> is required. Please send it to:
                                <div className="mt-2 space-y-1 text-xs font-mono">
                                  <div><span className="text-amber-600">Bank: </span>{store.bank.name}</div>
                                  <div><span className="text-amber-600">Name: </span>{store.bank.accountName}</div>
                                  <div><span className="text-amber-600">Account: </span>{store.bank.accountNumber}</div>
                                  {store.bank.sortCode && <div><span className="text-amber-600">{(REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel}: </span>{store.bank.sortCode}</div>}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        <Button
                          size="sm"
                          disabled={!bookName.trim() || !bookPhone.trim() || !bookDate || !bookTime || submittingBooking || (bookStaff.length > 0 && (!bookStaffId || (!!bookDate && availableBookStaff.length === 0)))}
                          onClick={handleBook}
                          className="bg-gradient-primary text-primary-foreground"
                        >
                          {submittingBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request booking"}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h4 className="mt-6 font-display text-xl font-bold">Available products</h4>
                  <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                    {store.products.map((p) => {
                      const q = qty[p.name] ?? 0;
                      return (
                        <div key={p.name} className="flex items-center justify-between gap-4 p-4">
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-sm text-muted-foreground">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty({ ...qty, [p.name]: Math.max(0, q - 1) })}>−</Button>
                            <span className="w-6 text-center font-semibold">{q}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty({ ...qty, [p.name]: q + 1 })}>+</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Message store */}
              <div className="mt-5">
                {!showMsgForm ? (
                  <button
                    onClick={() => setShowMsgForm(true)}
                    className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    💬 Have a question? Send {store.name} an enquiry
                  </button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
                    <p className="text-sm font-semibold">Send an enquiry to {store.name}</p>
                    <p className="text-xs text-muted-foreground">They'll reply to you on WhatsApp or by phone.</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Your name</label>
                      <Input value={msgName} onChange={(e) => setMsgName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Your WhatsApp / phone</label>
                      <div className="mt-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5 sm:col-span-4">
                          <Select value={msgCountryCode} onValueChange={(v) => setMsgCountryCode(v as CountryCode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-7 sm:col-span-8">
                          <Input value={msgPhone} onChange={(e) => setMsgPhone(e.target.value)} placeholder="Local number" />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Pick your country, then enter your local number. You can also paste full international format (+...).</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Message</label>
                      <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Do you have plantain available today?" rows={3} className="mt-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowMsgForm(false)}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={!msgName.trim() || !msgPhone.trim() || !msgBody.trim() || sendingMsg}
                        onClick={handleSendMsg}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send enquiry"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

          {/* Reviews section */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-lg font-bold">
                {storeReviews.length > 0
                  ? `Reviews (${storeReviews.length})`
                  : "No reviews yet"}
              </h4>
              {!showReviewForm && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Write a review
                </button>
              )}
            </div>

            {showReviewForm && (
              <div className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">Your review for {store.name}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setReviewHover(n)}
                      onMouseLeave={() => setReviewHover(0)}
                      onClick={() => setReviewRating(n)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          n <= (reviewHover || reviewRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="ml-2 self-center text-sm text-muted-foreground">
                      {["", "Poor", "Fair", "Good", "Very good", "Excellent"][reviewRating]}
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Your name</label>
                  <Input value={reviewName} onChange={(e) => setReviewName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comment (optional)</label>
                  <Textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} placeholder="Great selection and fast response..." rows={3} className="mt-1" maxLength={500} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewName(""); setReviewBody(""); }}>Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!reviewName.trim() || reviewRating === 0 || submittingReview}
                    onClick={handleSubmitReview}
                  >
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
                  </Button>
                </div>
              </div>
            )}

            {storeReviews.length > 0 && (
              <div className="mt-3 space-y-3">
                {storeReviews.map((rv) => (
                  <div key={rv.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{rv.reviewer_name}</span>
                      <span className="flex items-center gap-0.5 text-amber-500 text-xs">
                        {Array.from({ length: rv.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400" />
                        ))}
                      </span>
                    </div>
                    {rv.body && <p className="mt-1 text-sm text-muted-foreground">{rv.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground/60">{new Date(rv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

              {socialLinks.length > 0 && (
                <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Find this merchant elsewhere</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {socialLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {!isBookable(store.category) && (
                <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                    <div className="font-display text-2xl font-bold">£{total.toFixed(2)}</div>
                  </div>
                  <Button
                    size="lg"
                    disabled={!hasItems}
                    onClick={() => setStep("arrange")}
                    className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                  >
                    Arrange order →
                  </Button>
                </div>
              )}
            </>
          )}
          </>
          )}

          {step === "arrange" && (
            <>
              <button onClick={() => setStep("browse")} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back to products
              </button>
              <h4 className="mt-2 font-display text-xl font-bold">Your details</h4>
              <p className="text-sm text-muted-foreground">The merchant will message you to confirm pickup or local delivery.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">Full name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <div className="mt-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5 sm:col-span-4">
                      <Select value={phoneCountryCode} onValueChange={(v) => setPhoneCountryCode(v as CountryCode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-7 sm:col-span-8">
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Local number" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email <span className="text-muted-foreground font-normal">(for order updates)</span></label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Note for merchant (optional)</label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pickup tomorrow around 5pm?" className="mt-1" />
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-secondary/60 p-4 text-sm">
                <div className="mb-2 font-semibold">Order summary</div>
                {items.filter((i) => i.qty > 0).map((i) => (
                  <div key={i.name} className="flex justify-between text-muted-foreground">
                    <span>{i.qty} × {i.name}</span>
                    <span>£{(i.price * i.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span><span>£{total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="mt-5 w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                disabled={!name || !phone || !email}
                onClick={() => setStep("transfer")}
              >
                Continue to bank transfer
              </Button>
            </>
          )}

          {step === "transfer" && (
            <>
              <button onClick={() => setStep("arrange")} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>

              <div className="mt-3 rounded-2xl border-2 border-primary/30 bg-gradient-soft p-6 shadow-card">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <Landmark className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Bank transfer only</span>
                </div>
                <h4 className="font-display text-2xl font-bold">Send £{total.toFixed(2)} to {store.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lokal connects you directly with the merchant — no card fees, no middleman. Use the reference below so they can match your order instantly.
                </p>

                <div className="mt-5 space-y-2">
                  {[
                    { label: "Bank", value: store.bank.name },
                    { label: "Account name", value: store.bank.accountName },
                    { label: "Account number", value: store.bank.accountNumber },
                    ...(store.bank.sortCode ? [{ label: (REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel, value: store.bank.sortCode }] : []),
                    { label: "Reference", value: reference },
                    { label: "Amount", value: `£${total.toFixed(2)}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg bg-card px-4 py-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                        <div className="font-mono font-semibold">{row.value}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copy(row.label, row.value)} className="gap-1.5">
                        {copied === row.label ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                        {copied === row.label ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="mt-5 w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                disabled={saving}
                onClick={handleConfirmTransfer}
              >
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming…</> : "I've made the transfer"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                After sending, track your order at{" "}
                <a href={`/order?ref=${reference}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
                  lokalshops.co.uk/order
                </a>{" "}
                using reference <span className="font-mono font-bold">{reference}</span>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
