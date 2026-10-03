"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@velora/ui";
import { request, qs, type Salon, type Branch } from "@/lib/api-client";
import { openTestCheckout, type PaymentOrder } from "@/lib/razorpay-checkout";
type Membership = {
  id: string;
  status: string;
  purpose: string;
  active: boolean;
  expiresAt: string | null;
};
type Profile = { lookName: string; styleNotes: string; preferences: string };
const blank: Profile = { lookName: "", styleNotes: "", preferences: "" };
export function PremiumApp({
  salon,
  branch,
}: {
  salon: Salon;
  branch: Branch;
}) {
  const key = `velora-premium:${salon.id}`;
  const query = useQueryClient();
  const [id, setId] = useState("");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "+919000000000",
    email: "",
  });
  const [form, setForm] = useState<Profile>(blank);
  const [saved, setSaved] = useState(false);
  const [budget, setBudget] = useState("2000");
  const [minutes, setMinutes] = useState("90");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const read = () => setId(localStorage.getItem(key) || "");
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [key]);
  const config = useQuery({
    queryKey: ["premium-config", salon.id],
    queryFn: () =>
      request<{
        configured: boolean;
        mode: string;
        amount: number;
        currency: string;
        days: number;
      }>("payments/config", salon.id),
  });
  const membership = useQuery({
    queryKey: ["premium-status", salon.id, id],
    queryFn: () => request<Membership>(`payments/${id}/status`, salon.id),
    enabled: !!id,
    retry: false,
    refetchInterval: 5000,
  });
  const active = membership.data?.active === true;
  const passport = useQuery({
    queryKey: ["premium-passport", salon.id, id],
    queryFn: () => request<Profile>(`payments/${id}/passport`, salon.id),
    enabled: active,
    retry: false,
  });
  useEffect(() => {
    if (passport.data) setForm(passport.data);
  }, [passport.data]);
  const payment = useMutation({
    mutationFn: async () => {
      const order =
        id && membership.data?.status === "PENDING"
          ? await request<PaymentOrder>(`payments/${id}/checkout`, salon.id)
          : await request<PaymentOrder>("payments/premium-order", salon.id, {
              method: "POST",
              body: {
                customerName: customer.name.trim(),
                customerPhone: customer.phone.replace(/[\s()-]/g, ""),
                ...(customer.email
                  ? { customerEmail: customer.email.trim() }
                  : {}),
              },
            });
      localStorage.setItem(key, order.id);
      setId(order.id);
      const response = await openTestCheckout(order, customer);
      return request<Membership>(`payments/${order.id}/verify`, salon.id, {
        method: "POST",
        body: {
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        },
      });
    },
    onSuccess: () => query.invalidateQueries({ queryKey: ["premium-status"] }),
  });
  const save = useMutation({
    mutationFn: () =>
      request<Profile>(`payments/${id}/passport`, salon.id, {
        method: "PUT",
        body: form,
      }),
    onSuccess: () => {
      setSaved(true);
      query.invalidateQueries({ queryKey: ["premium-passport"] });
    },
  });
  const concierge = useMutation({
    mutationFn: () =>
      request<
        {
          serviceId: string;
          name: string;
          price: number;
          duration: number;
          description: string;
          branchId: string;
          currency: string;
        }[]
      >(`payments/${id}/concierge`, salon.id, {
        method: "POST",
        body: {
          branchId: branch.id,
          categoryId: category,
          budget: Number(budget),
          minutes: Number(minutes),
        },
      }),
  });
  const error = (e: unknown) =>
    e instanceof Error ? (
      <p role="alert" className="live-error">
        {e.message}
      </p>
    ) : null;
  const price = config.data
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: config.data.currency,
        maximumFractionDigits: 0,
      }).format(config.data.amount / 100)
    : "…";
  return (
    <main className="live-content premium-page">
      <section className="premium-hero">
        <div className="eyebrow">Velora Privé · Test mode</div>
        <h1>
          Your beauty.
          <br />
          <em>A little more personal.</em>
        </h1>
        <p>
          A private style passport and a concierge that helps you choose from
          your salon’s actual services.
        </p>
        <Link className="text-link" href="/book">
          Continue regular booking →
        </Link>
      </section>
      <section className="premium-membership panel live-section">
        <div>
          <h2>{active ? "Welcome to Privé" : "Unlock your Privé pass"}</h2>
          <p>{price} for 30 days · one-time test payment · no auto-renewal.</p>
          <p>No real money is collected in Razorpay test mode.</p>
          {active && (
            <p role="status">
              Premium active until{" "}
              {new Date(membership.data!.expiresAt!).toLocaleDateString()}.
            </p>
          )}
        </div>
        {!active && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              payment.mutate();
            }}
          >
            <div className="live-fields">
              <label>
                Your name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer((v) => ({ ...v, name: e.target.value }))
                  }
                />
              </label>
              <label>
                Phone number
                <input
                  required
                  type="tel"
                  pattern="[+]?[0-9\s]{8,18}"
                  autoComplete="tel"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((v) => ({ ...v, phone: e.target.value }))
                  }
                />
              </label>
              <label>
                Email (optional)
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer((v) => ({ ...v, email: e.target.value }))
                  }
                />
              </label>
            </div>
            <Button
              disabled={
                !config.data?.configured ||
                payment.isPending ||
                membership.isFetching
              }
            >
              {payment.isPending
                ? "Processing test checkout…"
                : "Pay with Razorpay · Test"}
            </Button>
            {config.data && !config.data.configured && (
              <p role="status">
                Test checkout is not configured yet. Premium access remains
                locked.
              </p>
            )}
            {error(payment.error)}
            {error(config.error)}
            {error(membership.error)}
            {membership.data?.status === "PENDING" && (
              <p role="status">
                Payment pending. Complete checkout or retry to resume the same
                order.
              </p>
            )}
          </form>
        )}
      </section>
      <div className="premium-grid">
        <section className="panel live-section">
          <div className="eyebrow">Privé exclusive</div>
          <h2>My Signature Look</h2>
          <p>
            Keep your preferred cut, colour formula and salon preferences in a
            private style passport.
          </p>
          {active ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="live-fields">
                <label>
                  Signature look name
                  <input
                    maxLength={80}
                    value={form.lookName}
                    onChange={(e) => {
                      setSaved(false);
                      setForm((v) => ({ ...v, lookName: e.target.value }));
                    }}
                  />
                </label>
                <label>
                  Style notes
                  <textarea
                    maxLength={1200}
                    rows={5}
                    placeholder="Length, colour formula and what you loved about your last visit"
                    value={form.styleNotes}
                    onChange={(e) => {
                      setSaved(false);
                      setForm((v) => ({ ...v, styleNotes: e.target.value }));
                    }}
                  />
                </label>
                <label>
                  Salon preferences
                  <textarea
                    maxLength={300}
                    rows={3}
                    value={form.preferences}
                    onChange={(e) => {
                      setSaved(false);
                      setForm((v) => ({ ...v, preferences: e.target.value }));
                    }}
                  />
                </label>
              </div>
              <Button disabled={save.isPending || passport.isLoading}>
                Save My Look
              </Button>
              {saved && <p role="status">Your signature look is saved.</p>}
              {error(save.error)}
              {error(passport.error)}
            </form>
          ) : (
            <p className="premium-lock">
              🔒 Available after a verified premium test payment.
            </p>
          )}
        </section>
        <section className="panel live-section">
          <div className="eyebrow">Privé exclusive</div>
          <h2>Beauty Concierge</h2>
          <p>
            Get a shortlist matched to your category, budget and available time,
            with compatible branch professionals.
          </p>
          {active ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                concierge.mutate();
              }}
            >
              <div className="live-fields">
                <label>
                  Concierge category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {salon.serviceCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Your budget ({branch.currency})
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </label>
                <label>
                  Available minutes
                  <input
                    type="number"
                    required
                    min={1}
                    max={600}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </label>
              </div>
              <Button disabled={concierge.isPending}>
                Find My Service Match
              </Button>
              {error(concierge.error)}
              {concierge.data && (
                <div role="status">
                  {concierge.data.length ? (
                    concierge.data.map((s) => (
                      <article className="premium-match" key={s.serviceId}>
                        <h3>{s.name}</h3>
                        <p>{s.description}</p>
                        <p>
                          {s.currency} {s.price} · {s.duration} min
                        </p>
                        <Link
                          className="button outline"
                          href={`/book?${qs({ service: s.serviceId })}`}
                        >
                          Choose This Service →
                        </Link>
                      </article>
                    ))
                  ) : (
                    <p>No match. Adjust your budget, category or time.</p>
                  )}
                </div>
              )}
              <p className="live-policy">
                Recommendations use catalogue rules, not an AI model.
                Appointment availability is checked when booking.
              </p>
            </form>
          ) : (
            <p className="premium-lock">
              🔒 Available after a verified premium test payment.
            </p>
          )}
        </section>
      </div>
      <p className="live-policy">
        This test pass is managed by a private receipt in this browser. It is
        separate from the dummy phone login. Keep this browser’s cookies to
        access it; cross-device account recovery requires real customer
        authentication. AI photo previews and exclusive reserved slots are not
        included.
      </p>
    </main>
  );
}
