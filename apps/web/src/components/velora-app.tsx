"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Users,
  Clock,
  Diamond,
  ChevronRight,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Scissors,
  UserRound,
  Check,
  Heart,
  LogOut,
  Bell,
  Search,
  Plus,
  House,
  ChartNoAxesColumn,
  Settings,
  Menu,
  ShieldCheck,
  Star,
  MoreHorizontal,
  RotateCcw,
  CalendarCheck,
  PanelTop,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Button, Dialog } from "@velora/ui";
import { customerSchema } from "@velora/validation";
import type { QueueEntry, QueueStatus } from "@velora/types";
import {
  DATE,
  SERVICES,
  STAFF,
  config,
  money,
  time,
  duration,
  price,
  compatible,
} from "@/lib/data";
import {
  availability,
  book,
  join,
  transition,
  estimates,
  checkIn,
  reorder,
  transitions,
} from "@/lib/engine";
import { useDemo } from "@/lib/store";
const pic = (name: string) => `/photos/${name}.webp`;
function Photo({
  name,
  className = "",
  alt = "",
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  return <img src={pic(name)} alt={alt} className={className} />;
}
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <img
      className="logo"
      src={`/brand/wordmark${light ? "-light" : ""}.svg`}
      alt="Velora — Smarter Booking. Smoother Flow."
    />
  );
}
function Label({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
export function Header() {
  const path = usePathname();
  const [expanded, setExpanded] = useState(false);
  return (
    <header className="header">
      <Link href="/" aria-label="Velora home">
        <Logo />
      </Link>
      <button
        className="mobile-menu"
        aria-label="Toggle navigation"
        onClick={() => setExpanded(!expanded)}
      >
        <Menu />
      </button>
      <nav className={expanded ? "expanded" : ""}>
        {[
          ["Home", "/"],
          ["Services", "/services"],
          ["Professionals", "/professionals"],
          ["Book", "/book"],
          ["Queue", "/queue"],
          ["Privé", "/premium"],
          ["Contact", "/contact"],
        ].map(([n, h]) => (
          <Link
            key={h}
            href={h}
            className={path === h ? "active" : ""}
            onClick={() => setExpanded(false)}
          >
            {n}
          </Link>
        ))}
      </nav>
      <Link
        href="/book"
        className="button gold header-cta"
        aria-label="Book Appointment"
      >
        <CalendarDays size={19} />
        <span className="header-cta-label">Book Appointment</span>
      </Link>
    </header>
  );
}
function Footer() {
  return (
    <footer>
      <Logo light />
      <div>
        <MapPin size={17} />
        <span>
          {config.address}
          <br />
          {config.city}
        </span>
      </div>
      <a href={`tel:${config.phone.replaceAll(" ", "")}`}>
        <Phone size={16} />
        {config.phone}
      </a>
      <a href={`mailto:${config.email}`}>
        <Mail size={16} />
        {config.email}
      </a>
      <Instagram size={16} />
      <div className="footer-links">
        {[
          ["Home", "/"],
          ["Services", "/services"],
          ["Professionals", "/professionals"],
          ["Book", "/book"],
          ["Queue", "/queue"],
          ["Contact", "/contact"],
        ].map(([n, h]) => (
          <Link key={h} href={h}>
            {n}
          </Link>
        ))}
      </div>
    </footer>
  );
}
function Rating({ staffId }: { staffId: string }) {
  const s = STAFF.find((s) => s.id === staffId)!;
  return (
    <div className="rating">
      <span>★★★★★</span>
      <small>
        {s.rating} ({s.reviews})
      </small>
    </div>
  );
}
function StaffCard({
  id,
  selected,
  onClick,
}: {
  id: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const s = STAFF.find((s) => s.id === id)!;
  const content = (
    <>
      <Photo name={s.image} alt={s.name} />
      <div>
        <h3>{s.name}</h3>
        <p>{s.title}</p>
        <Rating staffId={id} />
      </div>
      {selected && (
        <span className="selected-tick">
          <Check size={13} />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button
      className={`staff-card ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {content}
    </button>
  ) : (
    <Link href={`/book?staff=${id}`} className="staff-card">
      {content}
      <ChevronRight className="card-arrow" size={18} />
    </Link>
  );
}
function LiveCard() {
  const { state } = useDemo();
  const etas = Object.values(estimates(state));
  const wait = etas.length ? Math.min(...etas.map((e) => e.eta)) : 0;
  return (
    <div className="live-card panel">
      <Label>
        Live queue <span className="live-dot">● Updated just now</span>
      </Label>
      <div className="live-row">
        <span className="icon-circle">
          <Users />
        </span>
        <div>
          <p>Current Walk-in Wait</p>
          <h2>
            <em>~ {wait}</em> min
          </h2>
          <small>
            {state.queue.filter((q) => q.status === "WAITING").length} guests
            waiting · Approximate
          </small>
        </div>
      </div>
      <Link className="button dark" href="/queue/join">
        <Users size={17} />
        Join Live Queue
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
function Home() {
  return (
    <>
      <Header />
      <section className="home-hero">
        <div className="hero-copy">
          <Label>A modern salon experience</Label>
          <h1>
            Beauty,
            <br />
            <em>Without the Wait.</em>
          </h1>
          <p>
            Advance booking and real-time queue management
            <br className="desktop" /> for a smoother, more beautiful you.
          </p>
          <div className="hero-actions">
            <Link href="/book" className="button gold">
              <CalendarDays />
              Book Appointment
              <ChevronRight />
            </Link>
            <Link href="/queue/join" className="button outline">
              <Users />
              Join Live Queue
              <ChevronRight />
            </Link>
          </div>
          <Label>People × Appointments × Beauty × A smoother tomorrow</Label>
        </div>
      </section>
      <div className="benefits">
        {[
          [Clock, "Real-Time Queue", "See live wait times and plan better."],
          [
            CalendarDays,
            "Smart Booking",
            "Book your favourite service and stylist.",
          ],
          [Diamond, "Premium Experience", "Exceptional care. Every visit."],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof Clock;
          return (
            <div key={String(title)}>
              <span className="icon-circle">
                <I />
              </span>
              <section>
                <h3>{String(title)}</h3>
                <p>{String(desc)}</p>
              </section>
            </div>
          );
        })}
      </div>
      <section className="home-content">
        <div className="editorial">
          <Label>Our services</Label>
          <h2>
            Look Good.
            <br />
            Feel Even Better.
          </h2>
          <p>
            From everyday grooming to complete transformations, our expert team
            is here for you.
          </p>
          <Link className="text-link" href="/services">
            View all services →
          </Link>
        </div>
        <div className="category-grid">
          {[
            ["Hair", "hair", "Cuts, Styling, Colour & Treatments"],
            ["Grooming", "grooming", "Beard Care, Facials & Men’s Styling"],
            ["Beauty", "beauty", "Facials, Skin Care & Makeup"],
            ["Spa", "spa", "Relaxation, Body Care & Wellness"],
          ].map(([name, image, desc]) => (
            <Link
              href={`/services?category=${name}`}
              key={name}
              className="category-card"
            >
              <Photo name={image} alt={name} />
              <div>
                <h3>{name}</h3>
                <p>{desc}</p>
                <span className="round-arrow">
                  <ChevronRight size={18} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="editorial">
          <Label>Our professionals</Label>
          <h2>
            Expert Hands.
            <br />
            Personal Care.
          </h2>
          <p>
            Our talented stylists and therapists bring expertise, creativity and
            care to every service.
          </p>
          <Link className="text-link" href="/professionals">
            Meet our team →
          </Link>
        </div>
        <div className="home-team">
          {STAFF.slice(0, 3).map((s) => (
            <StaffCard key={s.id} id={s.id} />
          ))}
          <LiveCard />
        </div>
      </section>
      <section className="testimonial">
        <span className="quote-mark">“</span>
        <h3>
          Finally, a salon experience
          <br />
          that respects my time. ”
        </h3>
        <div>
          <p>
            Beautiful space, amazing professionals and the live queue feature is
            a game changer.
            <br />
            No more waiting around — I can plan my day and still get the care I
            love.
          </p>
          <Label>
            — Priya S. <span className="stars">★★★★★</span>
          </Label>
        </div>
        <img src="/brand/symbol.svg" alt="Velora symbol" />
      </section>
      <Footer />
    </>
  );
}
function ServiceCard({
  id,
  selected,
  onClick,
}: {
  id: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const s = SERVICES.find((s) => s.id === id)!;
  const content = (
    <>
      <Photo name={s.image} alt={s.name} />
      <h3>{s.name}</h3>
      <p>{s.description}</p>
      <div className="service-meta">
        <span>
          <Clock size={14} />
          {s.duration} min
        </span>
        <span>{money(s.price)}</span>
      </div>
      {onClick && (
        <span className={`check-radio ${selected ? "checked" : ""}`}>
          {selected && <Check size={13} />}
        </span>
      )}
    </>
  );
  return onClick ? (
    <button
      className={`service-card ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {content}
    </button>
  ) : (
    <Link href={`/book?service=${id}`} className="service-card">
      {content}
    </Link>
  );
}
function CustomerFields({
  onSubmit,
  submit = "Confirm",
  children,
  defaults,
}: {
  onSubmit: (d: { name: string; phone: string }) => void;
  submit?: string;
  children?: ReactNode;
  defaults?: { name: string; phone: string };
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string; phone: string }>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaults,
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <label>
        Full name
        <input
          autoComplete="name"
          {...register("name")}
          placeholder="Your full name"
          aria-invalid={!!errors.name}
        />
        {errors.name && <small className="error">{errors.name.message}</small>}
      </label>
      <label>
        Mobile number
        <input
          autoComplete="tel"
          {...register("phone")}
          placeholder="+65 8123 4567"
          aria-invalid={!!errors.phone}
        />
        {errors.phone && (
          <small className="error">{errors.phone.message}</small>
        )}
      </label>
      {children}
      <Button type="submit">
        {submit}
        <ArrowRight size={18} />
      </Button>
    </form>
  );
}
function Booking() {
  const { state, update } = useDemo();
  const [ids, setIds] = useState(["haircut", "spa"]);
  const [staff, setStaff] = useState("ava");
  const [date, setDate] = useState(DATE);
  const [slot, setSlot] = useState(600);
  const [month, setMonth] = useState(3);
  const [dialog, setDialog] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [reschedule, setReschedule] = useState<string>();
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("service")) setIds([p.get("service")!]);
    if (p.get("staff")) setStaff(p.get("staff")!);
    if (p.get("reschedule")) {
      const id = p.get("reschedule")!;
      setReschedule(id);
      const raw = localStorage.getItem("velora-demo-v1");
      const existing = raw
        ? JSON.parse(raw).appointments.find((a: { id: string }) => a.id === id)
        : undefined;
      if (existing) {
        setIds(existing.serviceIds);
        setStaff(existing.staffId);
        setDate(existing.date);
        setSlot(existing.start);
        setMonth(Number(existing.date.slice(5, 7)) - 1);
      }
    }
  }, []);
  const eligible = compatible(ids);
  const effective = eligible.some((s) => s.id === staff) ? staff : "any";
  const { data: slots = [] } = useQuery({
    queryKey: ["slots", date, ids, effective, state.revision, reschedule],
    queryFn: () =>
      availability(
        state,
        { date, serviceIds: ids, staffId: effective },
        reschedule,
      ),
  });
  const selectedSlot = slots.find((s) => s.start === slot);
  const [step, setStep] = useState(1);
  const toggle = (id: string) => {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
    setError("");
  };
  const submit = (d: { name: string; phone: string }) => {
    try {
      let id = "";
      update((s) => {
        const next = book(
          s,
          { ...d, serviceIds: ids, staffId: effective, date, start: slot },
          reschedule,
        );
        id = next.appointments[next.appointments.length - 1].id;
        return next;
      });
      localStorage.setItem("velora-customer-booking", id);
      setSuccess(id);
      setDialog(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Header />
      <section className="booking-hero">
        <Label>Appointment booking</Label>
        <h1>
          Your Beauty Journey
          <br />
          <em>Starts Here.</em>
        </h1>
        <p>
          Book your preferred services, choose your stylist, and enjoy a
          seamless salon experience.
        </p>
      </section>
      <div className="booking-layout">
        <main>
          <div className="steps">
            {["Services", "Stylist", "Date & Time", "Confirm"].map((s, i) => (
              <button
                key={s}
                onClick={() => {
                  setStep(i + 1);
                  document
                    .getElementById("booking-step-" + Math.min(i + 1, 3))
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  if (i === 3) setDialog(true);
                }}
              >
                <span className={step === i + 1 ? "current" : ""}>{i + 1}</span>
                <div>
                  <b>{s}</b>
                  <small>
                    {
                      [
                        "Choose your services",
                        "Select a professional",
                        "Pick your slot",
                        "Review & book",
                      ][i]
                    }
                  </small>
                </div>
              </button>
            ))}
          </div>
          <section className="booking-section panel" id="booking-step-1">
            <div className="section-heading">
              <span className="step-number">1</span>
              <div>
                <h2>Select Services</h2>
                <p>Choose one or more services for your appointment.</p>
              </div>
              <Link href="/services">View All Services →</Link>
            </div>
            <div className="service-grid">
              {SERVICES.slice(0, 4).map((s) => (
                <ServiceCard
                  key={s.id}
                  id={s.id}
                  selected={ids.includes(s.id)}
                  onClick={() => toggle(s.id)}
                />
              ))}
            </div>
          </section>
          <section className="booking-section panel" id="booking-step-2">
            <div className="section-heading">
              <span className="step-number">2</span>
              <div>
                <h2>Select Your Stylist</h2>
                <p>Choose a professional who matches your style.</p>
              </div>
              <button className="text-link" onClick={() => setStaff("any")}>
                Any Available Professional
              </button>
            </div>
            <div className="stylist-grid">
              {eligible.slice(0, 3).map((s) => (
                <StaffCard
                  key={s.id}
                  id={s.id}
                  selected={effective === s.id}
                  onClick={() => setStaff(s.id)}
                />
              ))}
            </div>
            {effective === "any" && (
              <p className="hint">
                Any available compatible professional selected.
              </p>
            )}
            {!eligible.length && (
              <p className="error">
                No professional supports this service combination.
              </p>
            )}
          </section>
          <section className="booking-section panel" id="booking-step-3">
            <div className="section-heading">
              <span className="step-number">3</span>
              <div>
                <h2>Select Date & Time</h2>
                <p>Choose a convenient date and time for your appointment.</p>
              </div>
            </div>
            <div className="date-grid">
              <div className="calendar">
                <div className="calendar-header">
                  <button
                    aria-label="Previous month"
                    disabled={month === 3}
                    onClick={() => setMonth(month - 1)}
                  >
                    ‹
                  </button>
                  <b>
                    {new Date(2025, month).toLocaleString("en", {
                      month: "long",
                    })}{" "}
                    2025
                  </b>
                  <button
                    aria-label="Next month"
                    disabled={month === 11}
                    onClick={() => setMonth(month + 1)}
                  >
                    ›
                  </button>
                </div>
                <div className="calendar-days">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <small key={d}>{d}</small>
                    ),
                  )}
                  {Array.from(
                    { length: new Date(2025, month, 1).getDay() },
                    (_, i) => (
                      <span key={"empty" + i} />
                    ),
                  )}
                  {Array.from(
                    { length: new Date(2025, month + 1, 0).getDate() },
                    (_, i) => {
                      const value = `2025-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                      return (
                        <button
                          key={i}
                          disabled={value < DATE}
                          className={date === value ? "chosen" : ""}
                          onClick={() => {
                            setDate(value);
                            setStep(3);
                          }}
                        >
                          {i + 1}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
              <div className="slots">
                <h3>
                  Available Slots{" "}
                  <small>
                    {new Date(date + "T12:00:00").toLocaleDateString("en-SG", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </small>
                </h3>
                <div>
                  {slots.slice(0, 15).map((s) => (
                    <button
                      key={s.start}
                      className={slot === s.start ? "selected" : ""}
                      onClick={() => setSlot(s.start)}
                    >
                      {time(s.start)}
                    </button>
                  ))}
                </div>
                {!slots.length && (
                  <p>No available times. Try another date or professional.</p>
                )}
              </div>
            </div>
          </section>
        </main>
        <aside className="booking-summary panel">
          <div className="section-heading">
            <span className="icon-circle">
              <CalendarDays />
            </span>
            <div>
              <h2>Booking Summary</h2>
              <p>Review your details before confirming.</p>
            </div>
          </div>
          <div className="salon-summary">
            <Photo name="salon" />
            <div>
              <h3>Velora Signature Salon</h3>
              <p>
                <MapPin size={13} />
                {config.address}
                <br />
                {config.city}
              </p>
            </div>
          </div>
          <section>
            <h3>
              Selected Services{" "}
              <button
                onClick={() =>
                  document
                    .getElementById("booking-step-1")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Edit
              </button>
            </h3>
            {ids.map((id) => {
              const s = SERVICES.find((s) => s.id === id)!;
              return (
                <div className="summary-service" key={id}>
                  <Photo name={s.image} />
                  <div>
                    {s.name}
                    <small>{s.duration} min</small>
                  </div>
                  <span>{money(s.price)}</span>
                </div>
              );
            })}
          </section>
          <section>
            <h3>Selected Stylist</h3>
            {effective === "any" ? (
              <p>Any Available Professional</p>
            ) : (
              <div className="summary-service">
                <Photo name={effective} />
                <div>
                  <h3>{STAFF.find((s) => s.id === effective)?.name}</h3>
                  <p>{STAFF.find((s) => s.id === effective)?.title}</p>
                  <Rating staffId={effective} />
                </div>
              </div>
            )}
          </section>
          <section>
            <h3>Date & Time</h3>
            <p>
              <CalendarDays size={16} />
              {date} <Clock size={16} />
              {selectedSlot ? time(slot) : "Choose a slot"}
            </p>
          </section>
          <div className="summary-total">
            <div>
              <small>Total Duration</small>
              <h3>{duration(ids) / 60} hours</h3>
            </div>
            <div>
              <small>Total Price</small>
              <h3>{money(price(ids))} SGD</h3>
            </div>
          </div>
          <Button
            disabled={!ids.length || !selectedSlot}
            onClick={() => {
              setError("");
              setDialog(true);
            }}
          >
            Confirm Booking <ArrowRight size={20} />
          </Button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="booking-policies">
            <div>
              <ShieldCheck />
              <section>
                <h4>Optional Deposit</h4>
                <p>No payment is required for this demo.</p>
              </section>
            </div>
            <div>
              <CalendarDays />
              <section>
                <h4>Free Cancellation</h4>
                <p>
                  Cancel for free up to {config.cancelHours} hours before your
                  appointment.
                </p>
              </section>
            </div>
          </div>
        </aside>
      </div>
      <Footer />
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title={
          reschedule ? "Reschedule Appointment" : "Your Appointment Details"
        }
      >
        <CustomerFields
          defaults={state.appointments.find((a) => a.id === reschedule)}
          submit={reschedule ? "Save New Time" : "Confirm Booking"}
          onSubmit={submit}
        >
          <p>
            {date} at {time(slot)} · {money(price(ids))}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </CustomerFields>
      </Dialog>
      <Dialog
        open={!!success}
        onOpenChange={() => setSuccess("")}
        title="Your booking is confirmed"
      >
        <p>
          We look forward to welcoming you on {date} at {time(slot)}.
        </p>
        <Link className="button gold" href="/customer/bookings">
          View My Booking <ArrowRight />
        </Link>
      </Dialog>
    </>
  );
}
function QueueJoin() {
  const { update } = useDemo();
  const router = useRouter();
  const [service, setService] = useState("haircut");
  const [staff, setStaff] = useState("any");
  const [error, setError] = useState("");
  return (
    <>
      <Header />
      <section className="support-hero">
        <Label>Walk in, beautifully</Label>
        <h1>
          Join the <em>Live Queue.</em>
        </h1>
        <p>Your place is waiting. No app download needed.</p>
      </section>
      <main className="join-card panel">
        <h2>Make time for you.</h2>
        <label>
          Choose your service
          <select
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setStaff("any");
            }}
          >
            {SERVICES.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name} · {money(s.price)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preferred professional
          <select value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="any">Any Available Professional</option>
            {compatible([service]).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <CustomerFields
          submit="Join Live Queue"
          onSubmit={(d) => {
            try {
              let id = "";
              update((s) => {
                const n = join(s, {
                  ...d,
                  serviceIds: [service],
                  staffId: staff,
                });
                id = n.queue[n.queue.length - 1].id;
                return n;
              });
              localStorage.setItem("velora-customer-queue", id);
              router.push("/queue");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
        {error && <p className="error">{error}</p>}
      </main>
      <Footer />
    </>
  );
}
function QueuePage() {
  const { state, update } = useDemo();
  const [id, setId] = useState("queue-5");
  const [leave, setLeave] = useState(false);
  useEffect(
    () => setId(localStorage.getItem("velora-customer-queue") ?? "queue-5"),
    [],
  );
  const entry = state.queue.find((q) => q.id === id);
  const eta = estimates(state)[id];
  const ended =
    !entry || ["LEFT", "CANCELLED", "COMPLETED"].includes(entry.status);
  return (
    <>
      <Header />
      <main className="queue-page">
        <section className="queue-intro">
          <Label>Live queue</Label>
          <h1>
            Your <br />
            Beauty
            <br />
            <em>Is on Its Way.</em>
          </h1>
          <p>
            Check your live queue status in real time
            <br />
            and enjoy a smoother, more relaxed
            <br />
            salon experience.
          </p>
          <div className="queue-benefits">
            <span>
              <Clock />
              Real-Time
              <br />
              Updates
            </span>
            <span>
              <Users />
              Plan Your
              <br />
              Time Better
            </span>
            <span>
              <Heart />A More Relaxed
              <br />
              Salon Visit
            </span>
          </div>
          <div className="queue-quote panel">
            <span className="quote-mark">“</span>
            <h3>
              I love being able to check
              <br />
              the live queue. It makes
              <br />
              everything so much easier
              <br />
              and more comfortable.”
            </h3>
            <Label>
              — Priya S. <span className="stars">★★★★★</span>
            </Label>
          </div>
        </section>
        <section className="phone-shell">
          <div className="phone-top">
            9:41 <span>● ▰</span>
          </div>
          <Logo />
          <div className="phone-status">
            <Label>Your queue status</Label>
            <p>Token Number</p>
            <h2>{entry?.token ?? "—"}</h2>
            <span className="status-pill">
              ● {entry?.status.replaceAll("_", " ") ?? "No active entry"}
            </span>
            <h3>
              {ended
                ? "Your visit is complete"
                : entry.status === "IN_SERVICE"
                  ? "Your service has started"
                  : `Only ${eta?.ahead ?? 0} ${(eta?.ahead ?? 0) === 1 ? "guest" : "guests"} ahead of you`}
            </h3>
            <p>✧ Estimated wait: {eta?.eta ?? 0} minutes</p>
            <div className="queue-progress">
              {["Joined Queue", "Waiting", "Almost Your Turn", "Ready"].map(
                (s, i) => (
                  <div key={s}>
                    <span
                      className={
                        i < (entry?.status === "CALLED" ? 4 : 2) ? "done" : ""
                      }
                    >
                      {i < 2 ? <Check size={13} /> : ""}
                    </span>
                    <small>{s}</small>
                  </div>
                ),
              )}
            </div>
            <div className="phone-detail">
              <Scissors />
              <div>
                <small>Selected Service</small>
                {entry?.serviceIds
                  .map((id) => SERVICES.find((s) => s.id === id)?.name)
                  .join(", ")}
              </div>
            </div>
            <div className="phone-detail">
              <UserRound />
              <div>
                <small>Preferred Stylist</small>
                {STAFF.find((s) => s.id === entry?.staffId)?.name ??
                  "Any Available Stylist"}
              </div>
            </div>
            <div className="phone-detail">
              <Clock />
              <div>
                <small>Last Updated</small>Just now · Reference demo
              </div>
            </div>
            {ended && (
              <Link href="/queue/join" className="button gold">
                Join Queue Again
              </Link>
            )}
          </div>
        </section>
        <aside className="queue-side">
          <div className="salon-info panel">
            <Photo name="salon-tall" />
            <div>
              <h3>{config.name}</h3>
              <p className="success">
                ● Open Now <small>Closes 9:00 PM</small>
              </p>
              <p>
                <MapPin size={17} />
                {config.address}
                <br />
                {config.city}
              </p>
              <hr />
              <p>Current Walk-in Wait</p>
              <h2>~ {eta?.eta ?? 0} min</h2>
            </div>
          </div>
          <div className="queue-actions panel">
            <button disabled={ended} onClick={() => setLeave(true)}>
              <span>
                <LogOut />
              </span>
              <b>Leave Queue</b>
              <small>
                Remove my
                <br />
                queue spot
              </small>
            </button>
            <a href={`tel:${config.phone.replaceAll(" ", "")}`}>
              <span>
                <Phone />
              </span>
              <b>Call Salon</b>
              <small>{config.phone}</small>
            </a>
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://maps.google.com/?q=${encodeURIComponent(config.address + " " + config.city)}`}
            >
              <span>
                <MapPin />
              </span>
              <b>Get Directions</b>
              <small>Open in Maps</small>
            </a>
          </div>
          <div className="notifications panel">
            <Label>
              Queue notifications <span>Stay informed</span>
            </Label>
            {state.notices
              .filter((n) => n.entryId === id)
              .slice(-5)
              .reverse()
              .map((n, i) => (
                <div className="notice" key={n.id}>
                  <span className="icon-circle">
                    {i === 0 ? <Bell /> : <Users />}
                  </span>
                  <div>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                  </div>
                  <small>{n.time}</small>
                </div>
              ))}
            {!ended && (
              <div className="notice future">
                <span className="icon-circle">
                  <Star />
                </span>
                <div>
                  <b>Almost Your Turn</b>
                  <p>We’ll update you here when your stylist is ready.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
      <Footer />
      <Dialog open={leave} onOpenChange={setLeave} title="Leave the queue?">
        <p>Your current queue spot will be released.</p>
        <Button
          onClick={() => {
            update((s) => transition(s, id, "LEFT"));
            setLeave(false);
          }}
        >
          Leave Queue
        </Button>
      </Dialog>
    </>
  );
}
function Sidebar({
  insights = false,
  onNavigate,
}: {
  insights?: boolean;
  onNavigate?: (view: string) => void;
}) {
  const path = usePathname();
  const { reset } = useDemo();
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <aside className="sidebar">
      <Link href="/">
        <Logo light />
      </Link>
      <nav>
        {[
          [
            House,
            insights ? "Dashboard" : "Overview",
            insights ? "/dashboard" : "/desk",
          ],
          [CalendarDays, "Appointments", "/desk?view=appointments"],
          [Users, "Queue", "/desk?view=queue"],
          [UserRound, "Customers", "/desk?view=customers"],
          [Scissors, "Services", "/services"],
          [Users, "Team", "/professionals"],
          [ChartNoAxesColumn, "Insights", "/dashboard"],
          [Settings, "Demo Settings", "#settings"],
        ].map(([Icon, label, href]) => {
          const I = Icon as typeof Clock;
          return href === "#settings" ? (
            <button key={String(label)} onClick={() => setResetOpen(true)}>
              <I />
              {String(label)}
            </button>
          ) : (
            <Link
              key={String(label)}
              href={String(href)}
              onClick={() => {
                const view = String(href).split("?view=")[1];
                if (view) onNavigate?.(view);
              }}
              className={path === href ? "active" : ""}
            >
              <I />
              {String(label)}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-brand">
        <img src="/brand/symbol.svg" alt="Velora brand symbol" />
        <Label>
          Beauty
          <br />
          moves
          <br />
          better
          <br />
          together
        </Label>
        <span />
      </div>
      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Demo Settings"
      >
        <p>Currency: SGD · Timezone: Asia/Singapore</p>
        <p>
          Reset synthetic appointments, queue and customer selections to their
          reference fixtures.
        </p>
        <Button
          onClick={() => {
            reset();
            setResetOpen(false);
          }}
        >
          <RotateCcw size={18} />
          Reset Demo
        </Button>
      </Dialog>
    </aside>
  );
}
function Reception() {
  const { state, update } = useDemo();
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<QueueEntry>();
  const [search, setSearch] = useState("");
  const [service, setService] = useState("haircut");
  const [staff, setStaff] = useState("any");
  const [status, setStatus] = useState<QueueStatus>("CALLED");
  const [reason, setReason] = useState("");
  const [position, setPosition] = useState(1);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Today");
  const router = useRouter();
  const eta = estimates(state);
  const waiting = state.queue.filter(
    (q) =>
      ["WAITING", "CALLED", "CHECKED_IN", "SKIPPED"].includes(q.status) &&
      `${q.name} ${q.phone} ${q.token}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = state.queue.filter((q) => q.status === "IN_SERVICE");
  const appointments = state.appointments.filter(
    (a) =>
      a.status === "CONFIRMED" &&
      `${a.name} ${a.phone} ${a.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const safe = (f: () => void) => {
    try {
      f();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const open = (name: string, q?: QueueEntry) => {
    setModal(name);
    setSelected(q);
    setStaff(q?.staffId ?? "any");
    setService(q?.serviceIds[0] ?? "haircut");
    setStatus(q ? transitions[q.status][0] : "CALLED");
    setError("");
  };
  const [view, setView] = useState("Day");
  const navView = (v: string) =>
    setModal(
      v === "appointments"
        ? "Quick Check In"
        : v === "customers"
          ? "Customer Lookup"
          : "All Queue Entries",
    );
  useEffect(() => {
    const v = new URLSearchParams(location.search).get("view");
    if (v)
      setModal(
        v === "appointments"
          ? "Quick Check In"
          : v === "customers"
            ? "Customer Lookup"
            : "All Queue Entries",
      );
  }, []);
  return (
    <div className="business">
      <Sidebar onNavigate={navView} />
      <main className="business-main">
        <header className="desk-top">
          <div>
            <span className="icon-circle">
              <MapPin />
            </span>
            <section>
              <h3>Velora Orchard</h3>
              <small>
                {config.address}, {config.city}
              </small>
            </section>
          </div>
          <div>
            <span className="icon-circle">
              <CalendarDays />
            </span>
            <section>
              <h3>Today</h3>
              <small>Wed, 16 Apr 2025</small>
            </section>
          </div>
          <label className="search">
            <Search size={19} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name, phone, or appointment..."
              aria-label="Search salon records"
            />
          </label>
          <button
            className="icon-button"
            aria-label="View notifications"
            onClick={() => open("Notifications")}
          >
            <Bell />
          </button>
          <Photo name="ava" className="avatar" />
          <div>
            <b>Sarah Lim</b>
            <small>Front Desk</small>
          </div>
        </header>
        <section className="desk-hero">
          <div>
            <h2>Good Morning,</h2>
            <h1>Sarah.</h1>
            <p>
              A smoother day creates more
              <br />
              beautiful moments.
            </p>
          </div>
          <div className="desk-stats">
            {[
              [Users, waiting.length, "In Queue", "+2 vs. yesterday"],
              [
                CalendarDays,
                state.appointments.length,
                "Appointments",
                "On track",
              ],
              [Scissors, active.length, "In Service", "View all"],
              [Users, STAFF.length, "Professionals", "All on duty"],
            ].map(([Icon, n, label, desc]) => {
              const I = Icon as typeof Clock;
              return (
                <div className="panel" key={String(label)}>
                  <span className="icon-circle">
                    <I />
                  </span>
                  <h2>{String(n)}</h2>
                  <p>{String(label)}</p>
                  <small>› {String(desc)}</small>
                </div>
              );
            })}
          </div>
        </section>
        <div className="desk-body">
          <div className="quick-actions">
            <Button onClick={() => open("Add Walk-in")}>
              <Plus />
              Add Walk-in
            </Button>
            <Button variant="outline" onClick={() => router.push("/book")}>
              <CalendarDays />
              New Booking
            </Button>
            <Button variant="outline" onClick={() => open("Customer Lookup")}>
              <UserRound />
              Customer Lookup
            </Button>
            <Button variant="outline" onClick={() => open("Quick Check In")}>
              <CalendarCheck />
              Quick Check In
            </Button>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="desk-columns">
            <section className="panel waiting-panel">
              <div className="panel-heading">
                <h2>
                  Waiting Queue <small>{waiting.length} people</small>
                </h2>
                <button
                  onClick={() => {
                    setSearch("");
                    open("All Queue Entries");
                  }}
                >
                  View All →
                </button>
              </div>
              {waiting.map((q, i) => (
                <div className="queue-row" key={q.id}>
                  <span className="queue-index">{i + 1}</span>
                  <Photo
                    name={q.staffId === "rohan" ? "rohan" : "ava"}
                    className="avatar"
                  />
                  <div className="queue-person">
                    <h3>{q.name}</h3>
                    <small>{q.phone}</small>
                  </div>
                  <div className="queue-service">
                    {q.serviceIds
                      .map((id) => SERVICES.find((s) => s.id === id)?.name)
                      .join(", ")}
                    <small>
                      with{" "}
                      {STAFF.find((s) => s.id === q.staffId)?.name ??
                        "Any stylist"}
                    </small>
                  </div>
                  <span className="eta">
                    ~ {eta[q.id]?.eta ?? 0} min<small>Est. wait</small>
                  </span>
                  <Button
                    onClick={() =>
                      safe(() =>
                        update((s) =>
                          transition(
                            s,
                            q.id,
                            q.status === "WAITING"
                              ? "CALLED"
                              : q.status === "CALLED"
                                ? "CHECKED_IN"
                                : q.status === "SKIPPED"
                                  ? "WAITING"
                                  : "IN_SERVICE",
                          ),
                        ),
                      )
                    }
                  >
                    {q.status === "WAITING"
                      ? "Call"
                      : q.status === "CALLED"
                        ? "Check In"
                        : q.status === "SKIPPED"
                          ? "Restore"
                          : "Start"}
                  </Button>
                  <button
                    aria-label={`Manage ${q.name}`}
                    className="more"
                    onClick={() => open("Manage Queue Entry", q)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              ))}
              {!waiting.length && <p className="empty">No waiting guests.</p>}
            </section>
            <section className="panel in-service">
              <div className="panel-heading">
                <h2>
                  In Service <small>{active.length} ongoing</small>
                </h2>
                <button onClick={() => open("In Service")}>View All →</button>
              </div>
              {active.map((q) => (
                <div className="active-row" key={q.id}>
                  <Photo name={q.staffId === "rohan" ? "rohan" : "ava"} />
                  <div>
                    <h3>{q.name}</h3>
                    <p>
                      {SERVICES.find((s) => s.id === q.serviceIds[0])?.name}
                      <br />
                      with {STAFF.find((s) => s.id === q.staffId)?.name}
                    </p>
                  </div>
                  <div className="progress-column">
                    <small>
                      {duration(q.serviceIds) - (q.remaining ?? 0)} min /{" "}
                      {duration(q.serviceIds)} min
                    </small>
                    <div className="progress-bar">
                      <span
                        style={{
                          width: `${Math.max(0, 100 - ((q.remaining ?? 0) / duration(q.serviceIds)) * 100)}%`,
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        safe(() =>
                          update((s) => transition(s, q.id, "COMPLETED")),
                        )
                      }
                    >
                      Complete
                    </Button>
                  </div>
                </div>
              ))}
            </section>
            <section className="panel schedule">
              <div className="panel-heading">
                <h2>Today’s Schedule</h2>
                <select
                  aria-label="Schedule view"
                  value={view}
                  onChange={(e) => setView(e.target.value)}
                >
                  <option>Day</option>
                  <option>Agenda</option>
                </select>
              </div>
              {Array.from({ length: 10 }, (_, i) => {
                const hour = 9 + i;
                const a = state.appointments.find(
                  (a) =>
                    a.date === DATE &&
                    Math.floor(a.start / 60) === hour &&
                    a.status === "CONFIRMED",
                );
                return (
                  <div
                    className={`schedule-hour ${view === "Agenda" && !a ? "hidden" : ""}`}
                    key={hour}
                  >
                    <small>{hour}:00</small>
                    {a ? (
                      <button onClick={() => open("Quick Check In")}>
                        <b>{a.name}</b>
                        <small>
                          {time(a.start)} –{" "}
                          {time(a.start + duration(a.serviceIds))}
                        </small>
                        <p>
                          {SERVICES.find((s) => s.id === a.serviceIds[0])?.name}
                        </p>
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </section>
          </div>
          <div className="desk-bottom">
            <section className="panel upcoming">
              <div className="panel-heading">
                <h2>Upcoming Appointments</h2>
                <div className="tabs">
                  {["Next 4 Hours", "Today", "All"].map((t) => (
                    <button
                      className={tab === t ? "active" : ""}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button onClick={() => open("Quick Check In")}>
                  View All →
                </button>
              </div>
              {appointments
                .filter(
                  (a) =>
                    tab === "All" ||
                    (a.date === DATE &&
                      (tab === "Today" || (a.start >= 540 && a.start <= 780))),
                )
                .map((a) => (
                  <div className="appointment-row" key={a.id}>
                    <span>{time(a.start)}</span>
                    <Photo
                      name={a.staffId === "rohan" ? "rohan" : "ava"}
                      className="avatar"
                    />
                    <div>
                      <h3>{a.name}</h3>
                      <small>{a.phone}</small>
                    </div>
                    <div>
                      {SERVICES.find((s) => s.id === a.serviceIds[0])?.name}
                      <small>
                        with {STAFF.find((s) => s.id === a.staffId)?.name}
                      </small>
                    </div>
                    <span>{duration(a.serviceIds) / 60}h</span>
                    <span className="success">● Confirmed</span>
                    <button
                      aria-label={`Check in ${a.name}`}
                      onClick={() =>
                        safe(() => update((s) => checkIn(s, a.id)))
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                ))}
            </section>
            <section className="panel available">
              <div className="panel-heading">
                <h2>Available Professionals</h2>
                <Link href="/professionals">View All →</Link>
              </div>
              <div>
                {STAFF.map((s) => {
                  const busy = active.some((q) => q.staffId === s.id);
                  return (
                    <article key={s.id}>
                      <Photo name={s.image} />
                      <h3>{s.name}</h3>
                      <p>{s.title}</p>
                      <small className="rating">
                        ★ {s.rating} ({s.reviews})
                      </small>
                      <small className={busy ? "info" : "success"}>
                        ● {busy ? "In Service" : "Available"}
                      </small>
                      <Button
                        variant="outline"
                        onClick={() =>
                          open(
                            busy ? "In Service" : "Assign Professional",
                            waiting.find((q) =>
                              compatible(q.serviceIds).some(
                                (p) => p.id === s.id,
                              ),
                            ),
                          )
                        }
                      >
                        {" "}
                        {busy ? "View" : "Assign"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
      <Dialog open={!!modal} onOpenChange={() => setModal("")} title={modal}>
        {modal === "Add Walk-in" ? (
          <>
            <label>
              Service
              <select
                value={service}
                onChange={(e) => {
                  setService(e.target.value);
                  setStaff("any");
                }}
              >
                {SERVICES.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Professional
              <select value={staff} onChange={(e) => setStaff(e.target.value)}>
                <option value="any">Any Available</option>
                {compatible([service]).map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <CustomerFields
              submit="Add Walk-in"
              onSubmit={(d) =>
                safe(() => {
                  update((s) =>
                    join(s, { ...d, serviceIds: [service], staffId: staff }),
                  );
                  setModal("");
                })
              }
            />
          </>
        ) : modal === "Manage Queue Entry" ||
          modal === "Assign Professional" ? (
          <>
            {selected ? (
              <div className="form">
                <p>
                  {selected.name} · {selected.token}
                </p>
                <label>
                  Action
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as QueueStatus)}
                  >
                    {transitions[selected.status].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <Button
                  onClick={() =>
                    safe(() => {
                      update((s) => transition(s, selected.id, status));
                      setModal("");
                    })
                  }
                >
                  Update Status
                </Button>
                <label>
                  Assign professional
                  <select
                    value={staff}
                    onChange={(e) => setStaff(e.target.value)}
                  >
                    {compatible(selected.serviceIds).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="any">Any Available</option>
                  </select>
                </label>
                <Button
                  variant="outline"
                  onClick={() =>
                    safe(() => {
                      if (
                        !compatible(selected.serviceIds).some(
                          (p) => staff === "any" || p.id === staff,
                        )
                      )
                        throw Error("Choose a compatible professional.");
                      update((s) => ({
                        ...s,
                        queue: s.queue.map((q) =>
                          q.id === selected.id ? { ...q, staffId: staff } : q,
                        ),
                        audit: [
                          ...s.audit,
                          {
                            id: crypto.randomUUID(),
                            action: "STAFF_REASSIGNED",
                            entityId: selected.id,
                            at: new Date().toISOString(),
                          },
                        ],
                      }));
                      setModal("");
                    })
                  }
                >
                  Assign
                </Button>
                <label>
                  Queue position
                  <input
                    type="number"
                    min={1}
                    max={waiting.length}
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                  />
                </label>
                <label>
                  Reason
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for reordering"
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={() =>
                    safe(() => {
                      update((s) => reorder(s, selected.id, position, reason));
                      setModal("");
                    })
                  }
                >
                  Move in Queue
                </Button>
              </div>
            ) : (
              <p>No compatible waiting guest to assign.</p>
            )}
          </>
        ) : modal === "Quick Check In" ? (
          <div className="lookup-list">
            {appointments.map((a) => (
              <div key={a.id}>
                <span>
                  {a.name} · {time(a.start)}
                </span>
                <Button
                  onClick={() =>
                    safe(() => {
                      update((s) => checkIn(s, a.id));
                      setModal("");
                    })
                  }
                >
                  Check In
                </Button>
                <button
                  onClick={() =>
                    safe(() => {
                      update((s) => ({
                        ...s,
                        appointments: s.appointments.map((x) =>
                          x.id === a.id ? { ...x, status: "NO_SHOW" } : x,
                        ),
                        audit: [
                          ...s.audit,
                          {
                            id: crypto.randomUUID(),
                            action: "APPOINTMENT_NO_SHOW",
                            entityId: a.id,
                            at: new Date().toISOString(),
                          },
                        ],
                      }));
                    })
                  }
                >
                  No-show
                </button>
              </div>
            ))}
          </div>
        ) : modal === "Notifications" ? (
          <div className="lookup-list">
            {state.notices
              .slice(-10)
              .reverse()
              .map((n) => (
                <div key={n.id}>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                </div>
              ))}
          </div>
        ) : modal === "Customer Lookup" ? (
          <div className="lookup-list">
            <input
              aria-label="Search customer"
              placeholder="Search name, phone, token"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {[...waiting, ...appointments].map((q) => (
              <div key={q.id}>
                <b>{q.name}</b>
                <small>{q.phone}</small>
                <p>
                  {q.serviceIds
                    .map((id) => SERVICES.find((s) => s.id === id)?.name)
                    .join(", ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="lookup-list">
            {(modal === "In Service" ? active : state.queue).map((q) => (
              <div key={q.id}>
                <b>{q.name}</b>
                <span>
                  {q.token} · {q.status.replaceAll("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </div>
  );
}
const analyticsRows = Array.from({ length: 31 }, (_, i) => ({
  day: `${i + 1} Jul`,
  appointments: [
    25, 22, 28, 38, 30, 54, 42, 30, 24, 26, 22, 34, 48, 65, 53, 26, 31, 32, 41,
    60, 77, 53, 38, 27, 33, 39, 53, 81, 64, 43, 34,
  ][i],
  walkins: [
    13, 12, 13, 16, 17, 22, 20, 13, 13, 15, 14, 16, 24, 27, 23, 14, 15, 16, 19,
    26, 29, 27, 18, 17, 17, 17, 22, 36, 35, 22, 23,
  ][i],
  wait: [
    8, 12, 14, 18, 14, 9, 15, 17, 19, 12, 14, 10, 9, 19, 12, 14, 17, 18, 32, 22,
    24, 29, 34, 27, 20, 15, 14, 16, 18, 19, 16,
  ][i],
}));
function ChartPanel({
  title,
  icon: Icon,
  children,
  filter,
}: {
  title: string;
  icon: typeof Clock;
  children: ReactNode;
  filter?: ReactNode;
}) {
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <h2>
          <span className="icon-circle">
            <Icon />
          </span>
          {title}
        </h2>
        {filter}
      </div>
      {children}
    </section>
  );
}
function Insights() {
  const [range, setRange] = useState("month");
  const [branch, setBranch] = useState("all");
  const [grain, setGrain] = useState("Daily");
  const [hours, setHours] = useState("All Days");
  const [sort, setSort] = useState("Bookings");
  const [period, setPeriod] = useState("This Month");
  const [suggest, setSuggest] = useState(false);
  const rows = range === "week" ? analyticsRows.slice(-7) : analyticsRows;
  const factor = branch === "orchard" ? 0.65 : 1;
  const plotted = rows.map((r) => ({
    ...r,
    appointments: Math.round(r.appointments * factor),
    walkins: Math.round(r.walkins * factor),
  }));
  const data =
    grain === "Weekly"
      ? Array.from({ length: Math.ceil(plotted.length / 7) }, (_, i) => ({
          day: `Week ${i + 1}`,
          appointments: plotted
            .slice(i * 7, i * 7 + 7)
            .reduce((n, r) => n + r.appointments, 0),
          walkins: plotted
            .slice(i * 7, i * 7 + 7)
            .reduce((n, r) => n + r.walkins, 0),
          wait: 18,
        }))
      : plotted;
  const demand = [
    ["Women’s Haircut & Style", "ava", 124],
    ["Balayage Colour", "ava", 96],
    ["Classic Facial", "elena", 78],
    ["Men’s Haircut", "rohan", 64],
    ["Deep Treatment", "ava", 58],
  ] as const;
  return (
    <div className="business">
      <Sidebar insights />
      <main className="insights-main">
        <header className="insights-header">
          <div>
            <h1>Owner Insights</h1>
            <Label>Real data. Brighter decisions.</Label>
          </div>
          <select
            aria-label="Analytics date range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="month">01 Jul 2024 – 31 Jul 2024</option>
            <option value="week">25 Jul 2024 – 31 Jul 2024</option>
          </select>
          <select
            aria-label="Analytics branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="all">All Branches</option>
            <option value="orchard">Velora Orchard</option>
          </select>
          <Bell size={23} />
          <Photo name="ava" className="avatar" />
          <div>
            <b>Priya S.</b>
            <small>Owner</small>
          </div>
        </header>
        <div className="kpi-grid">
          {[
            [Users, "Customers Today", String(Math.round(86 * factor)), "+12%"],
            [
              CalendarDays,
              "Appointments",
              String(Math.round(64 * factor)),
              "+8%",
            ],
            [UserRound, "Walk-ins", String(Math.round(22 * factor)), "-10%"],
            [
              Clock,
              "Average Wait Time",
              `${range === "week" ? 16 : 18} min`,
              "-22%",
            ],
            [ChartNoAxesColumn, "No-show Rate", "3.6%", "+0.8%"],
            [
              PanelTop,
              "Booking Revenue",
              money(Math.round(8420 * factor * (range === "week" ? 0.25 : 1))),
              "+18%",
            ],
          ].map(([Icon, title, value, delta]) => {
            const I = Icon as typeof Clock;
            return (
              <div className="panel kpi" key={String(title)}>
                <span className="icon-circle">
                  <I />
                </span>
                <h3>{String(title)}</h3>
                <h2>{String(value)}</h2>
                <p
                  className={
                    title === "Walk-ins" || title === "No-show Rate"
                      ? "error"
                      : "success"
                  }
                >
                  ▲ {String(delta)}
                </p>
                <small>vs previous {range === "week" ? "week" : "month"}</small>
              </div>
            );
          })}
        </div>
        <div className="insights-top">
          <ChartPanel
            title="Appointments vs Walk-ins"
            icon={CalendarDays}
            filter={
              <>
                <span className="chart-legend">
                  ● Appointments <i>● Walk-ins</i>
                </span>
                <select
                  aria-label="Chart granularity"
                  value={grain}
                  onChange={(e) => setGrain(e.target.value)}
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                </select>
              </>
            }
          >
            <div className="chart">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 700, height: 225 }}
              >
                <BarChart data={data}>
                  <CartesianGrid stroke="#eee7dd" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={grain === "Daily" ? 2 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="appointments" fill="#C7A56A" />
                  <Bar dataKey="walkins" fill="#8C9484" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
          <section className="insight-banner">
            <Label>☼ Key Insight</Label>
            <h2>
              Saturday
              <br />
              5–8 PM is your
              <br />
              busiest window.
            </h2>
            <p>
              Consider adding one
              <br />
              more stylist to reduce
              <br />
              wait times and capture
              <br />
              more bookings.
            </p>
            <Button onClick={() => setSuggest(true)}>
              View Scheduling Suggestion <ArrowRight size={16} />
            </Button>
          </section>
        </div>
        <div className="insights-grid">
          <ChartPanel
            title="Peak Hours"
            icon={Clock}
            filter={
              <select
                aria-label="Peak hours day"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              >
                <option>All Days</option>
                <option>Saturday</option>
              </select>
            }
          >
            <div className="chart short">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 700, height: 225 }}
              >
                <BarChart
                  data={Array.from({ length: 12 }, (_, i) => ({
                    hour: `${i + 9 > 12 ? i - 3 : i + 9}${i + 9 >= 12 ? "PM" : "AM"}`,
                    bookings: Math.round(
                      [5, 14, 25, 34, 38, 47, 43, 55, 68, 59, 41, 24][i] *
                        factor *
                        (hours === "Saturday" ? 1.3 : 1),
                    ),
                  }))}
                >
                  <CartesianGrid stroke="#eee7dd" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="bookings"
                    fill="#C7A56A"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
          <ChartPanel
            title="Most-Booked Services"
            icon={Scissors}
            filter={
              <select
                aria-label="Service demand sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option>Bookings</option>
                <option>Service Name</option>
              </select>
            }
          >
            <div className="demand">
              {[...demand]
                .sort((a, b) =>
                  sort === "Bookings" ? b[2] - a[2] : a[0].localeCompare(b[0]),
                )
                .map(([name, image, n], i) => (
                  <div key={name}>
                    <span>{i + 1}</span>
                    <Photo name={image} />
                    <span>{name}</span>
                    <b>{Math.round(n * factor)}</b>
                    <div className="progress-bar">
                      <span style={{ width: `${(n / 140) * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </ChartPanel>
          <ChartPanel
            title="Professional Utilization"
            icon={UserRound}
            filter={
              <select
                aria-label="Utilization period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>This Month</option>
                <option>This Week</option>
              </select>
            }
          >
            <div className="utilization">
              <Label>
                Professional <span>Appointments · Utilization · Rating</span>
              </Label>
              {STAFF.map((s, i) => (
                <div key={s.id}>
                  <Photo name={s.image} />
                  <span>{s.name}</span>
                  <span>
                    {Math.round(
                      (128 - i * 12) *
                        factor *
                        (period === "This Week" ? 0.25 : 1),
                    )}
                  </span>
                  <b>{92 - i * 7}%</b>
                  <div className="progress-bar">
                    <span style={{ width: `${92 - i * 7}%` }} />
                  </div>
                  <small>★ {s.rating}</small>
                </div>
              ))}
            </div>
          </ChartPanel>
          <ChartPanel
            title="Wait Time Trends"
            icon={Clock}
            filter={
              <select
                aria-label="Wait trend granularity"
                value={grain}
                onChange={(e) => setGrain(e.target.value)}
              >
                <option>Daily</option>
                <option>Weekly</option>
              </select>
            }
          >
            <div className="trend-layout">
              <div className="chart short">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 700, height: 225 }}
                >
                  <AreaChart data={data}>
                    <CartesianGrid stroke="#eee7dd" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={grain === "Daily" ? 5 : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Area
                      dataKey="wait"
                      stroke="#B77932"
                      fill="#E9D8BC"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="wait-summary">
                <h2>{range === "week" ? 16 : 18} min</h2>
                <small>Avg. Wait Time</small>
                <p className="success">▼ -22%</p>
                <small>vs previous week</small>
              </div>
            </div>
          </ChartPanel>
        </div>
      </main>
      <Dialog
        open={suggest}
        onOpenChange={setSuggest}
        title="Saturday Staffing Suggestion"
      >
        <p>
          The reference dataset peaks at 5 PM. Add a compatible hair stylist to
          the 5–8 PM shift, then review waiting time and utilization.
        </p>
        <p>This is a demo insight; no staff schedule has been changed.</p>
        <Link href="/professionals" className="button gold">
          View Professionals
        </Link>
      </Dialog>
    </div>
  );
}
function Supporting() {
  const path = usePathname();
  const { state, update } = useDemo();
  const [category, setCategory] = useState("All");
  const [bookingId, setBookingId] = useState<string>();
  const [error, setError] = useState("");
  useEffect(() => {
    setBookingId(localStorage.getItem("velora-customer-booking") ?? undefined);
    const c = new URLSearchParams(location.search).get("category");
    if (c) setCategory(c);
  }, []);
  const appointment = state.appointments.find((a) => a.id === bookingId);
  const isServices = path === "/services";
  const isStaff = path === "/professionals";
  return (
    <>
      <Header />
      <section className="support-hero">
        <Label>
          {isServices
            ? "Our Services"
            : isStaff
              ? "Our Professionals"
              : path === "/contact"
                ? "Visit Velora"
                : "Your Beauty Journey"}
        </Label>
        <h1>
          {isServices ? (
            <>
              Look Good.
              <br />
              <em>Feel Even Better.</em>
            </>
          ) : isStaff ? (
            <>
              Expert Hands.
              <br />
              <em>Personal Care.</em>
            </>
          ) : path === "/contact" ? (
            <>
              We’d Love to <em>See You.</em>
            </>
          ) : (
            <>
              Your <em>Appointments.</em>
            </>
          )}
        </h1>
        <p>Exceptional care, thoughtfully tailored to you.</p>
      </section>
      <main className="support-content">
        {isServices ? (
          <>
            <div className="filter-tabs">
              {["All", "Hair", "Grooming", "Beauty", "Spa"].map((c) => (
                <button
                  key={c}
                  className={c === category ? "selected" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="service-catalog">
              {SERVICES.filter(
                (s) => category === "All" || s.category === category,
              ).map((s) => (
                <ServiceCard id={s.id} key={s.id} />
              ))}
            </div>
          </>
        ) : isStaff ? (
          <div className="professional-catalog">
            {STAFF.map((s) => (
              <StaffCard id={s.id} key={s.id} />
            ))}
          </div>
        ) : path === "/contact" ? (
          <div className="contact-grid">
            <Photo name="salon" />
            <section>
              <h2>{config.name}</h2>
              <p>
                {config.address}
                <br />
                {config.city}
              </p>
              <p>Open daily, 9 AM – 9 PM</p>
              <a
                className="button gold"
                href={`tel:${config.phone.replaceAll(" ", "")}`}
              >
                <Phone />
                {config.phone}
              </a>
              <a className="button outline" href={`mailto:${config.email}`}>
                <Mail />
                {config.email}
              </a>
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={`https://maps.google.com/?q=${encodeURIComponent(config.address + " " + config.city)}`}
              >
                Get Directions <ExternalLink size={15} />
              </a>
            </section>
          </div>
        ) : (
          <div className="panel my-booking">
            {appointment ? (
              <>
                <Label>{appointment.status}</Label>
                <h2>{appointment.name}</h2>
                <p>
                  {appointment.date} at {time(appointment.start)}
                </p>
                <p>
                  {appointment.serviceIds
                    .map((id) => SERVICES.find((s) => s.id === id)?.name)
                    .join(" + ")}
                </p>
                <p>
                  {money(price(appointment.serviceIds))} ·{" "}
                  {STAFF.find((s) => s.id === appointment.staffId)?.name}
                </p>
                {appointment.status === "CONFIRMED" && (
                  <div className="hero-actions">
                    <Link
                      className="button gold"
                      href={`/book?reschedule=${appointment.id}`}
                    >
                      Reschedule
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const now = new Date(
                          DATE + "T09:00:00+08:00",
                        ).getTime();
                        const at = new Date(
                          appointment.date +
                            "T" +
                            time(appointment.start) +
                            ":00+08:00",
                        ).getTime();
                        if (at - now < config.cancelHours * 3600000) {
                          setError(
                            "The free cancellation window has closed. Please call the salon.",
                          );
                          return;
                        }
                        update((s) => ({
                          ...s,
                          appointments: s.appointments.map((a) =>
                            a.id === appointment.id
                              ? { ...a, status: "CANCELLED" }
                              : a,
                          ),
                          audit: [
                            ...s.audit,
                            {
                              id: crypto.randomUUID(),
                              action: "BOOKING_CANCELLED",
                              entityId: appointment.id,
                              at: new Date().toISOString(),
                            },
                          ],
                        }));
                      }}
                    >
                      Cancel Booking
                    </Button>
                  </div>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2>Your next beautiful moment awaits.</h2>
                <p>No appointment has been booked in this browser yet.</p>
                <Link className="button gold" href="/book">
                  Book Appointment
                </Link>
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
export function VeloraApp({ route }: { route?: string } = {}) {
  const current = usePathname();
  const path = route ?? current;
  if (path === "/") return <Home />;
  if (path === "/book") return <Booking />;
  if (path === "/queue/join") return <QueueJoin />;
  if (path === "/queue") return <QueuePage />;
  if (path === "/desk") return <Reception />;
  if (path === "/dashboard") return <Insights />;
  return <Supporting />;
}
