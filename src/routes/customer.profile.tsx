import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Plus, CheckCircle2, LogOut, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/auth/AuthProvider";

export const Route = createFileRoute("/customer/profile")({
  component: CustomerProfilePage,
  head: () => ({ meta: [{ title: "My profile · Lokal" }] }),
});

type Address = {
  id: string;
  label: string;
  street: string;
  city: string;
  postcode: string;
  notes?: string;
};

type PaymentMethod = {
  id: string;
  type: "card";
  last4: string;
  brand: string;
};

type CustomerProfile = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  addresses: Address[];
  payment_methods: PaymentMethod[];
  notification_preferences: {
    email_alerts: boolean;
    sms_alerts: boolean;
  };
};

type MostVisitedStore = {
  id: string;
  name: string;
  category: string | null;
  visits: number;
};

function CustomerProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "profile">("login");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [ownedStoreId, setOwnedStoreId] = useState<string | null>(null);
  const [mostVisitedStore, setMostVisitedStore] = useState<MostVisitedStore | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({});

  const loadMostVisitedStore = async (customer: CustomerProfile) => {
    try {
      const customerPhone = customer.phone?.trim();
      const [ordersByIdRes, ordersByPhoneRes, bookingsByIdRes, bookingsByPhoneRes] = await Promise.all([
        customer.id
          ? (supabase as any)
              .from("orders")
              .select("store_id, stores(id,name,category)")
              .eq("customer_id", customer.id)
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
        customerPhone
          ? (supabase as any)
              .from("orders")
              .select("store_id, stores(id,name,category)")
              .eq("customer_phone", customerPhone)
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
        customer.id
          ? (supabase as any)
              .from("store_bookings")
              .select("store_id, stores(id,name,category)")
              .eq("customer_id", customer.id)
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
        customerPhone
          ? (supabase as any)
              .from("store_bookings")
              .select("store_id, stores(id,name,category)")
              .eq("customer_phone", customerPhone)
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const queryErr = ordersByIdRes.error ?? ordersByPhoneRes.error ?? bookingsByIdRes.error ?? bookingsByPhoneRes.error;
      if (queryErr) throw queryErr;

      const allRows = [
        ...(ordersByIdRes.data ?? []),
        ...(ordersByPhoneRes.data ?? []),
        ...(bookingsByIdRes.data ?? []),
        ...(bookingsByPhoneRes.data ?? []),
      ] as any[];

      const counts = new Map<string, MostVisitedStore>();
      allRows.forEach((row) => {
        const storeId = row.store_id as string | null;
        const storeObj = Array.isArray(row.stores) ? row.stores[0] : row.stores;
        if (!storeId || !storeObj?.name) return;
        const prev = counts.get(storeId);
        if (prev) {
          prev.visits += 1;
        } else {
          counts.set(storeId, {
            id: storeId,
            name: storeObj.name,
            category: storeObj.category ?? null,
            visits: 1,
          });
        }
      });

      const top = Array.from(counts.values()).sort((a, b) => b.visits - a.visits)[0] ?? null;
      setMostVisitedStore(top);
    } catch {
      setMostVisitedStore(null);
    }
  };

  // Load profile from auth user or localStorage
  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        // Try to load profile linked to auth user
        const { data: authProfile } = await (supabase as any)
          .from("customers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: ownedStore } = await (supabase as any)
          .from("stores")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setOwnedStoreId(ownedStore?.id ?? null);

        if (authProfile) {
          setProfile(authProfile);
          setPhone(authProfile.phone || "");
          setEmail(authProfile.email || "");
          setName(authProfile.name || "");
          setMode("profile");
          void loadMostVisitedStore(authProfile as CustomerProfile);
          localStorage.setItem("lokal_customer_id", authProfile.id);
          localStorage.setItem("lokal_customer_profile", JSON.stringify(authProfile));
        } else {
          // Create new customer profile for auth user
          const { data: newProfile, error } = await (supabase as any)
            .from("customers")
            .insert({
              user_id: user.id,
              email: user.email,
              name: user.user_metadata?.display_name || "",
              phone: "",
            })
            .select()
            .single();

          if (!error && newProfile) {
            setProfile(newProfile);
            setEmail(newProfile.email || "");
            setName(newProfile.name || "");
            setMode("profile");
            void loadMostVisitedStore(newProfile as CustomerProfile);
            localStorage.setItem("lokal_customer_id", newProfile.id);
            localStorage.setItem("lokal_customer_profile", JSON.stringify(newProfile));
          }
        }
        return;
      }

      // Fallback to localStorage for phone-only logins
      const storedProfile = localStorage.getItem("lokal_customer_profile");
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
        setMode("profile");
        const parsed = JSON.parse(storedProfile);
        setPhone(parsed.phone);
        setEmail(parsed.email || "");
        setName(parsed.name || "");
        void loadMostVisitedStore(parsed as CustomerProfile);
      }
    };

    loadProfile();
  }, [user?.id]);

  const loginOrSignup = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;

    setLoading(true);
    try {
      // Try to find or create customer
      let { data: customer, error: fetchErr } = await (supabase as any)
        .from("customers")
        .select("*")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (fetchErr && fetchErr.code !== "PGRST116") throw fetchErr;

      if (!customer) {
        // Create new customer
        const { data: newCustomer, error: createErr } = await (supabase as any)
          .from("customers")
          .insert({ phone: cleanPhone, email: email || null, name: name || null })
          .select()
          .single();
        if (createErr) throw createErr;
        customer = newCustomer;
        toast.success(`Welcome! Profile created for ${cleanPhone}`);
      } else {
        toast.success(`Welcome back!`);
      }

      // Store in localStorage
      localStorage.setItem("lokal_customer_id", customer.id);
      localStorage.setItem("lokal_customer_profile", JSON.stringify(customer));
      setProfile(customer);
      setMode("profile");
      setPhone(customer.phone);
      setEmail(customer.email || "");
      setName(customer.name || "");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: updated, error: err } = await (supabase as any)
        .from("customers")
        .update({ email: email || null, name: name || null })
        .eq("id", profile.id)
        .select()
        .single();

      if (err) throw err;
      localStorage.setItem("lokal_customer_profile", JSON.stringify(updated));
      setProfile(updated);
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const addAddress = async () => {
    if (!profile || !newAddress.label || !newAddress.street || !newAddress.city || !newAddress.postcode) {
      toast.error("Please fill all address fields");
      return;
    }
    setLoading(true);
    try {
      const updated_addresses = [
        ...profile.addresses,
        {
          id: Math.random().toString(36).slice(2, 11),
          label: newAddress.label!,
          street: newAddress.street!,
          city: newAddress.city!,
          postcode: newAddress.postcode!,
          notes: newAddress.notes || "",
        },
      ];
      const { data: updated, error: err } = await (supabase as any)
        .from("customers")
        .update({ addresses: updated_addresses })
        .eq("id", profile.id)
        .select()
        .single();

      if (err) throw err;
      localStorage.setItem("lokal_customer_profile", JSON.stringify(updated));
      setProfile(updated);
      setNewAddress({});
      toast.success("Address added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add address");
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const updated_addresses = profile.addresses.filter((a) => a.id !== addressId);
      const { data: updated, error: err } = await (supabase as any)
        .from("customers")
        .update({ addresses: updated_addresses })
        .eq("id", profile.id)
        .select()
        .single();

      if (err) throw err;
      localStorage.setItem("lokal_customer_profile", JSON.stringify(updated));
      setProfile(updated);
      toast.success("Address deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const toggleNotificationPreference = async (key: "email_alerts" | "sms_alerts") => {
    if (!profile) return;
    setLoading(true);
    try {
      const updated_prefs = {
        ...profile.notification_preferences,
        [key]: !profile.notification_preferences[key],
      };
      const { data: updated, error: err } = await (supabase as any)
        .from("customers")
        .update({ notification_preferences: updated_prefs })
        .eq("id", profile.id)
        .select()
        .single();

      if (err) throw err;
      localStorage.setItem("lokal_customer_profile", JSON.stringify(updated));
      setProfile(updated);
      toast.success(`${key === "email_alerts" ? "Email" : "SMS"} alerts ${updated_prefs[key] ? "enabled" : "disabled"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update preferences");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("lokal_customer_id");
    localStorage.removeItem("lokal_customer_profile");
    setProfile(null);
    setMode("login");
    setPhone("");
    setEmail("");
    setName("");
    toast.success("Logged out");
  };

  if (mode === "login") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto max-w-sm px-4 py-20">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold">Create your profile</h1>
            <p className="mt-2 text-muted-foreground">Save addresses, view your most visited store, and manage preferences.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Phone number *</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 000000"
                type="tel"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" type="email" />
            </div>
            <div>
              <label className="text-sm font-semibold">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First & last name" />
            </div>
            <Button
              onClick={loginOrSignup}
              disabled={!phone.trim() || loading}
              className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create or sign in"}
            </Button>
          </div>
        </main>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">{name || phone}</h1>
            <p className="mt-1 text-muted-foreground">{email}</p>
          </div>
          <div className="flex flex-col gap-2">
            {user && ownedStoreId ? (
              <Button variant="outline" onClick={() => navigate({ to: `/store/${ownedStoreId}` })} className="gap-2">
                <Store className="h-4 w-4" /> Show store
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate({ to: "/list-store" })} className="gap-2">
                <Store className="h-4 w-4" /> List your store
              </Button>
            )}
            <Button variant="outline" onClick={logout} className="text-red-600 hover:bg-red-50 gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Personal info</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-semibold">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>
          <Button onClick={updateProfile} disabled={loading} className="w-full bg-gradient-primary hover:opacity-95">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>

        {/* Addresses */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Saved addresses</h2>
          {profile?.addresses.map((addr) => (
            <div key={addr.id} className="rounded-lg border border-secondary bg-secondary/50 p-4 flex items-start justify-between gap-4">
              <div className="text-sm">
                <p className="font-semibold">{addr.label}</p>
                <p className="text-muted-foreground">
                  {addr.street}, {addr.city} {addr.postcode}
                </p>
                {addr.notes && <p className="text-xs text-muted-foreground italic mt-1">{addr.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteAddress(addr.id)}
                disabled={loading}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="space-y-3 border-t border-secondary pt-4">
            <h3 className="text-sm font-semibold">Add new address</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Label (e.g. Home, Work)"
                value={newAddress.label || ""}
                onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
              />
              <Input
                placeholder="Street address"
                value={newAddress.street || ""}
                onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
              />
              <Input
                placeholder="City"
                value={newAddress.city || ""}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
              />
              <Input
                placeholder="Postcode"
                value={newAddress.postcode || ""}
                onChange={(e) => setNewAddress({ ...newAddress, postcode: e.target.value })}
              />
            </div>
            <Input
              placeholder="Delivery notes (optional)"
              value={newAddress.notes || ""}
              onChange={(e) => setNewAddress({ ...newAddress, notes: e.target.value })}
            />
            <Button onClick={addAddress} disabled={loading} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add address
            </Button>
          </div>
        </div>

        {/* Most Visited Store */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Most visited store</h2>
          {mostVisitedStore ? (
            <button
              onClick={() => navigate({ to: `/store/${mostVisitedStore.id}` })}
              className="w-full rounded-lg border-2 border-primary bg-primary/5 p-4 text-left transition-all hover:bg-primary/10"
            >
              <p className="font-semibold text-lg">{mostVisitedStore.name}</p>
              <p className="text-sm text-muted-foreground">{mostVisitedStore.category ?? "Store"}</p>
              <p className="mt-2 text-xs font-medium text-primary">
                {mostVisitedStore.visits} visit{mostVisitedStore.visits === 1 ? "" : "s"} across your bookings/orders
              </p>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">No visits yet. Once you place orders or bookings, your top store will appear here.</p>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile?.notification_preferences.email_alerts ?? true}
                onChange={() => toggleNotificationPreference("email_alerts")}
                disabled={loading}
                className="rounded border-gray-300"
              />
              <span className="text-sm">
                <p className="font-semibold">Email alerts</p>
                <p className="text-xs text-muted-foreground">Order updates, booking confirmations</p>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile?.notification_preferences.sms_alerts ?? true}
                onChange={() => toggleNotificationPreference("sms_alerts")}
                disabled={loading}
                className="rounded border-gray-300"
              />
              <span className="text-sm">
                <p className="font-semibold">SMS alerts</p>
                <p className="text-xs text-muted-foreground">Time-sensitive updates (booking in 1 hour, order ready)</p>
              </span>
            </label>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
