"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Users,
  Clock,
  Diamond,
  MapPin,
  Phone,
  Mail,
  Plus,
  House,
  ChartNoAxesColumn,
  Scissors,
  LogOut,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button, Dialog } from "@velora/ui";
import { Header, Logo } from "./velora-app";
import {
  request,
  qs,
  ApiError,
  type Salon,
  type Branch,
  type Service,
  type Staff,
  type Slot,
  type Appointment,
  type QueueReceipt,
  type QueueStatus,
  type Desk,
  type StaffUser,
  type SearchResults,
  type Analytics,
  type VisitInput,
  type Entry,
} from "@/lib/api-client";

import {
  filterServices,
  surpriseService,
  departurePlan,
  earliestAvailability,
  matchesTime,
  calendarFile,
  googleCalendarUrl,
  type TimePreference,
} from "@/lib/booking-extras";

const slug = process.env.NEXT_PUBLIC_SALON_SLUG || "velora-signature";
const C = createContext<{
  salon: Salon;
  branch: Branch;
  setBranch: (id: string) => void;
} | null>(null);
const useSalon = () => {
  const c = useContext(C);
  if (!c) throw Error("Missing salon");
  return c;
};
const human = (status: string) => status.replaceAll("_", " ").toLowerCase();
const today = (zone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to complete the request";
}
function ErrorNotice({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="live-error">
      {message(error)}
      {error instanceof ApiError && error.requestId && (
        <small> Request ID: {error.requestId}</small>
      )}
    </p>
  ) : null;
}
function Footer() {
  const { branch } = useSalon();
  return (
    <footer>
      <Logo light />
      <span>
        <MapPin size={16} /> {branch.address}, {branch.city}
      </span>
      <a href={`tel:${branch.phone}`}>
        <Phone size={16} /> {branch.phone}
      </a>
      {branch.email && (
        <a href={`mailto:${branch.email}`}>
          <Mail size={16} /> {branch.email}
        </a>
      )}
      <Link href="/customer/bookings">My bookings</Link>
      <Link href="/desk">Staff access</Link>
    </footer>
  );
}
function amount(value: number, branch: Branch) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: branch.currency,
    maximumFractionDigits: 0,
  }).format(value);
}
function at(value: string, branch: Branch) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: branch.timezone,
  }).format(new Date(value));
}
function image(service: Service, categories: Salon["serviceCategories"]) {
  if (service.imageUrl) return service.imageUrl;
  const name =
    categories.find((c) => c.id === service.categoryId)?.name.toLowerCase() ||
    "";
  return `/photos/${name.includes("groom") ? "grooming" : name.includes("facial") ? "beauty" : name.includes("spa") ? "hair-spa" : "hair"}.webp`;
}
function ServiceCard({
  service,
  selected,
  toggle,
}: {
  service: Service;
  selected?: boolean;
  toggle?: () => void;
}) {
  const { salon, branch } = useSalon();
  const content = (
    <>
      <img src={image(service, salon.serviceCategories)} alt="" />
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="service-meta">
        <span>
          <Clock size={14} /> {service.duration} min
        </span>
        <b>{amount(service.price, branch)}</b>
      </div>
      {toggle && (
        <span className="live-check">
          {selected ? "✓ Selected" : "Select service"}
        </span>
      )}
    </>
  );
  return toggle ? (
    <button
      type="button"
      className={`service-card ${selected ? "selected" : ""}`}
      aria-pressed={!!selected}
      onClick={toggle}
    >
      {content}
    </button>
  ) : (
    <Link href={`/book?service=${service.id}`} className="service-card">
      {content}
    </Link>
  );
}
function Professional({ staff }: { staff: Staff }) {
  return (
    <div className="live-professional panel">
      {staff.photoUrl ? (
        <img src={staff.photoUrl} alt={staff.name} />
      ) : (
        <span className="icon-circle">
          <Users />
        </span>
      )}
      <section>
        <h3>{staff.name}</h3>
        <p>{staff.title}</p>
        <span className="stars">
          ★ {staff.rating} ({staff.reviewCount})
        </span>
        <p>{human(staff.operationalStatus)}</p>
      </section>
    </div>
  );
}
function Home() {
  const { salon } = useSalon();
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">A modern salon experience</div>
          <h1>
            Beauty,
            <br />
            <em>Without the Wait.</em>
          </h1>
          <p>
            Advance booking and live queue management
            <br />
            for a smoother, more beautiful you.
          </p>
          <div className="hero-actions">
            <Link className="button gold" href="/book">
              <CalendarDays /> Book Appointment →
            </Link>
            <Link className="button outline" href="/queue/join">
              <Users /> Join Live Queue →
            </Link>
          </div>
          <div className="eyebrow">
            People × Appointments × Beauty × A smoother tomorrow
          </div>
        </div>
      </section>
      <div className="benefits">
        {[
          [Clock, "Live Queue", "Track your own place and wait estimate."],
          [
            CalendarDays,
            "Smart Booking",
            "Choose services, a stylist and an available time.",
          ],
          [Diamond, "Premium Experience", "Exceptional care. Every visit."],
        ].map(([I, title, description]) => {
          const Icon = I as typeof Clock;
          return (
            <div key={String(title)}>
              <span className="icon-circle">
                <Icon />
              </span>
              <section>
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
              </section>
            </div>
          );
        })}
      </div>
      <section className="home-content">
        <div className="editorial">
          <div className="eyebrow">Our services</div>
          <h2>
            Look Good.
            <br />
            Feel Even Better.
          </h2>
          <p>Explore the services available at {salon.name}.</p>
          <Link className="text-link" href="/services">
            View all services →
          </Link>
        </div>
        <div className="category-grid">
          {salon.serviceCategories.map((c) => (
            <Link
              className="category-card"
              href={`/services?category=${c.id}`}
              key={c.id}
            >
              <img
                src={
                  c.services[0]
                    ? image(c.services[0], salon.serviceCategories)
                    : "/photos/hair.webp"
                }
                alt=""
              />
              <div>
                <h3>{c.name}</h3>
                <p>{c.services.length} services available</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="editorial">
          <div className="eyebrow">Our professionals</div>
          <h2>
            Expert Hands.
            <br />
            Personal Care.
          </h2>
          <p>Meet our salon team.</p>
        </div>
        <div className="live-team-grid">
          {salon.staffProfiles.slice(0, 3).map((s) => (
            <Professional key={s.id} staff={s} />
          ))}
          <div className="panel live-queue-card">
            <div className="eyebrow">Live queue</div>
            <h3>Your beauty is on its way.</h3>
            <p>Join for an estimate based on the current queue.</p>
            <Link className="button dark" href="/queue/join">
              Join Live Queue →
            </Link>
          </div>
        </div>
      </section>
      <section className="testimonial">
        <h3>
          Smarter Booking.
          <br />
          Smoother Flow.
        </h3>
        <p>Book ahead, choose your professional, and track your visit.</p>
        <img src="/brand/symbol.svg" alt="Velora" />
      </section>
    </>
  );
}
function Selection({
  ids,
  setIds,
  staffId,
  setStaffId,
  step,
}: {
  step?: number;
  ids: string[];
  setIds: (v: string[]) => void;
  staffId: string;
  setStaffId: (id: string) => void;
}) {
  const { salon, branch } = useSalon();
  const [filters, setFilters] = useState({
    category: "",
    budget: "",
    minutes: "",
  });
  const [surprise, setSurprise] = useState<Service | null>(null);
  const [surpriseTried, setSurpriseTried] = useState(false);
  const services = salon.serviceCategories.flatMap((c) => c.services);
  const eligible = salon.staffProfiles.filter(
    (s) =>
      (!s.schedules ||
        s.schedules.some((v) => v.branchId === branch.id && v.isWorkingDay)) &&
      ids.every((id) => s.services.some((v) => v.serviceId === id)),
  );
  const canSuggest = (candidate: string[]) =>
    salon.staffProfiles.some(
      (s) =>
        (!s.schedules ||
          s.schedules.some(
            (v) => v.branchId === branch.id && v.isWorkingDay,
          )) &&
        candidate.every((id) => s.services.some((v) => v.serviceId === id)),
    );
  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
    setIds(next);
    setStaffId("any");
  }
  return (
    <>
      {(step === undefined || step === 0) && (
        <section className="panel live-section">
          <h2>1. Select Services</h2>
          <p>Choose one or more services for your visit.</p>
          {step !== undefined && (
            <div className="booking-discovery">
              <div>
                <h3>Make it fit your day</h3>
                <p>
                  Find services for your budget and time. Selected services stay
                  visible.
                </p>
              </div>
              <div className="live-fields">
                <label>
                  Service category
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      setFilters((v) => ({ ...v, category: e.target.value }))
                    }
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
                  Max price per service ({branch.currency})
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Any budget"
                    value={filters.budget}
                    onChange={(e) =>
                      setFilters((v) => ({ ...v, budget: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Max minutes per service
                  <input
                    type="number"
                    min="1"
                    placeholder="Any duration"
                    value={filters.minutes}
                    onChange={(e) =>
                      setFilters((v) => ({ ...v, minutes: e.target.value }))
                    }
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setFilters({ category: "", budget: "", minutes: "" })
                }
              >
                Clear filters
              </Button>
              <p role="status">
                {filterServices(services, ids, filters).length} of{" "}
                {services.length} services shown
              </p>
            </div>
          )}
          {step !== undefined && (
            <div className="booking-surprise">
              <div className="eyebrow">A little beauty roulette</div>
              <h3>Not sure what to choose?</h3>
              <p>
                Discover a service that fits your filters and can be combined
                with your selected services. You decide whether to add it.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSurpriseTried(true);
                  setSurprise(
                    surpriseService(
                      services,
                      ids,
                      filters,
                      (candidate) =>
                        salon.staffProfiles.some(
                          (s) =>
                            (!s.schedules ||
                              s.schedules.some(
                                (v) =>
                                  v.branchId === branch.id && v.isWorkingDay,
                              )) &&
                            candidate.every((id) =>
                              s.services.some((v) => v.serviceId === id),
                            ),
                        ),
                      surprise?.id,
                    ),
                  );
                }}
              >
                Surprise Me
              </Button>
              {surpriseTried && (
                <div role="status">
                  {surprise &&
                  filterServices([surprise], [], filters).length &&
                  !ids.includes(surprise.id) &&
                  canSuggest([...ids, surprise.id]) ? (
                    <>
                      <h3>{surprise.name}</h3>
                      <p>{surprise.description}</p>
                      <p>
                        {amount(surprise.price, branch)} · {surprise.duration}{" "}
                        min
                      </p>
                      <Button
                        type="button"
                        onClick={() => {
                          toggle(surprise.id);
                          setSurprise(null);
                          setSurpriseTried(false);
                        }}
                      >
                        Add This Service
                      </Button>
                    </>
                  ) : (
                    <p>
                      No new matching suggestion. Adjust your filters or
                      selected services, then try again.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="service-grid">
            {(step === undefined
              ? services
              : filterServices(services, ids, filters)
            ).map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                selected={ids.includes(s.id)}
                toggle={() => toggle(s.id)}
              />
            ))}
          </div>
          {step !== undefined &&
            !filterServices(services, ids, filters).length && (
              <p>
                No services match. Increase your budget or time limit, or clear
                the filters.
              </p>
            )}
        </section>
      )}
      {(step === undefined || step === 1) && (
        <section className="panel live-section">
          <h2>2. Select Your Stylist</h2>
          <p>
            Only professionals who provide all selected services are available.
          </p>
          <label>
            Preferred professional
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="any">Any Available</option>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
            </select>
          </label>
          {ids.length > 0 && !eligible.length && (
            <p role="alert" className="live-error">
              No professional provides this combination. Adjust your selected
              services.
            </p>
          )}
        </section>
      )}
    </>
  );
}
function CustomerInputs() {
  return (
    <div className="live-fields">
      <label>
        Your name
        <input name="customerName" required minLength={2} autoComplete="name" />
      </label>
      <label>
        Phone number
        <input
          name="customerPhone"
          type="tel"
          required
          pattern="\+?[0-9\s()-]{8,18}"
          autoComplete="tel"
          placeholder="Include country code"
        />
      </label>
      <label>
        Email (optional)
        <input name="customerEmail" type="email" autoComplete="email" />
      </label>
      <label>
        Notes (optional)
        <input name="notes" maxLength={500} />
      </label>
    </div>
  );
}
function visit(
  form: HTMLFormElement,
  branchId: string,
  serviceIds: string[],
): VisitInput {
  const data = new FormData(form);
  const email = String(data.get("customerEmail") || "").trim();
  return {
    branchId,
    serviceIds,
    customerName: String(data.get("customerName") || "").trim(),
    customerPhone: String(data.get("customerPhone") || "").replace(
      /[\s()-]/g,
      "",
    ),
    ...(email ? { customerEmail: email } : {}),
    notes: String(data.get("notes") || ""),
  };
}
function remember(kind: "booking" | "queue", id: string) {
  const key = `velora-live-${kind}`;
  const values: string[] = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(
    key,
    JSON.stringify([id, ...values.filter((v) => v !== id)].slice(0, 20)),
  );
  window.dispatchEvent(new Event("velora-receipt"));
}
function useReceipts(kind: "booking" | "queue") {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    function read() {
      try {
        setIds(JSON.parse(localStorage.getItem(`velora-live-${kind}`) || "[]"));
      } catch {
        setIds([]);
      }
    }
    read();
    window.addEventListener("storage", read);
    window.addEventListener("velora-receipt", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("velora-receipt", read);
    };
  }, [kind]);
  return ids;
}
const DEMO_PHONE = "+919000000000";
function CustomerBookingGate() {
  const { salon } = useSalon();
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("Log in");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeStep, setCodeStep] = useState(false);
  const [error, setError] = useState("");
  const key = `velora-demo-customer:${salon.id}`;
  useEffect(() => {
    setSignedIn(sessionStorage.getItem(key) === DEMO_PHONE);
    setReady(true);
  }, [key]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (phone.replace(/[\s()-]/g, "") !== DEMO_PHONE) {
      setError("Use the demo number +91 90000 00000 for now.");
      return;
    }
    if (!codeStep) {
      setCodeStep(true);
      return;
    }
    if (code !== "123456") {
      setError("Enter the demo code 123456.");
      return;
    }
    sessionStorage.setItem(key, DEMO_PHONE);
    setSignedIn(true);
  }
  if (!ready)
    return (
      <p role="status" className="live-content">
        Preparing customer login…
      </p>
    );
  if (signedIn)
    return (
      <>
        <div className="customer-session">
          <span>Demo customer · +91 90000 00000</span>
          <Button
            variant="ghost"
            onClick={() => {
              sessionStorage.removeItem(key);
              setSignedIn(false);
              setCodeStep(false);
              setCode("");
            }}
          >
            Log out
          </Button>
        </div>
        <Booking />
      </>
    );
  return (
    <section className="customer-auth">
      <div className="customer-auth-intro">
        <div className="eyebrow">Your time. Your beauty.</div>
        <h1>
          A little closer to
          <br />
          <em>your next visit.</em>
        </h1>
        <p>Sign in to choose your services and book a time that suits you.</p>
        <img src="/brand/symbol.svg" alt="" />
      </div>
      <form className="panel customer-auth-card" onSubmit={submit}>
        <div className="customer-auth-tabs">
          {["Log in", "Sign up"].map((v) => (
            <button
              type="button"
              aria-pressed={mode === v}
              key={v}
              onClick={() => {
                setMode(v);
                setError("");
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <h2>
          {codeStep
            ? "Enter your demo code"
            : mode === "Log in"
              ? "Welcome back"
              : "Welcome to Velora"}
        </h2>
        <p>
          {codeStep
            ? "Enter 123456 to continue. No SMS has been sent."
            : "Continue with your mobile number."}
        </p>
        <div className="demo-login-note">
          <strong>Demo login</strong>
          <p>
            Number: +91 90000 00000
            <br />
            Code: 123456
          </p>
          <small>This is a simulated customer login for testing.</small>
        </div>
        <label>
          Mobile number
          <input
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            disabled={codeStep}
            placeholder="+91 90000 00000"
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        {!codeStep && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPhone(DEMO_PHONE)}
          >
            Use demo number
          </Button>
        )}
        {codeStep && (
          <label>
            Demo code
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        <Button type="submit">
          {codeStep ? "Continue to Booking" : "Continue with Phone"} →
        </Button>
        {codeStep && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setCodeStep(false);
              setError("");
            }}
          >
            Change number
          </Button>
        )}
        <p className="live-policy">
          {mode === "Sign up"
            ? "Your details will be collected in the booking steps."
            : "Your booking details are kept on this browser through private booking receipts."}
        </p>
      </form>
    </section>
  );
}
function Booking({
  staff = false,
  onDone,
}: {
  staff?: boolean;
  onDone?: () => void;
}) {
  const { salon, branch, setBranch } = useSalon();
  const router = useRouter();
  const query = useQueryClient();
  const [step, setStep] = useState(0);
  const stepMain = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!staff) stepMain.current?.focus();
  }, [step, staff]);
  const [details, setDetails] = useState({
    customerName: "",
    customerPhone: "+919000000000",
    customerEmail: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
    notes: "",
    contact: "Phone",
    firstVisit: "Yes",
  });
  const [accepted, setAccepted] = useState(false);
  const [stepError, setStepError] = useState("");
  const steps = [
    "Services",
    "Stylist",
    "Date & time",
    "Your details",
    "Address",
    "Review",
  ];
  function next() {
    setStep((v) => v + 1);
  }
  function field(key: keyof typeof details) {
    return {
      value: details[key],
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => setDetails((v) => ({ ...v, [key]: e.target.value })),
    };
  }
  const [repeatNotice, setRepeatNotice] = useState("");
  const [repeatError, setRepeatError] = useState<unknown>(null);
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(today(branch.timezone));
  const [slot, setSlot] = useState("");
  const [timePreference, setTimePreference] = useState<TimePreference>("any");
  const [preferences, setPreferences] = useState<string[]>([]);
  const eligible = salon.staffProfiles.filter(
    (s) =>
      (!s.schedules ||
        s.schedules.some((v) => v.branchId === branch.id && v.isWorkingDay)) &&
      ids.every((id) => s.services.some((v) => v.serviceId === id)),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get("service");
    if (
      serviceId &&
      salon.serviceCategories.some((c) =>
        c.services.some((s) => s.id === serviceId),
      )
    )
      setIds([serviceId]);
    const repeatId = params.get("repeat");
    if (staff || !repeatId) return;
    let cancelled = false;
    setRepeatLoading(true);
    request<Appointment>(`bookings/${encodeURIComponent(repeatId)}`, salon.id)
      .then((a) => {
        if (cancelled) return;
        if (a.branchId !== branch.id) {
          if (!salon.branches.some((b) => b.id === a.branchId))
            throw Error("The original branch is no longer available.");
          setBranch(a.branchId);
          return;
        }
        const catalogue = salon.serviceCategories.flatMap((c) => c.services);
        const available = a.services
          .map((s) => s.serviceId)
          .filter((id) => catalogue.some((s) => s.id === id));
        setIds(available);
        const compatible = salon.staffProfiles.some(
          (s) =>
            s.id === a.staffId &&
            (!s.schedules ||
              s.schedules.some(
                (v) => v.branchId === branch.id && v.isWorkingDay,
              )) &&
            available.every((id) => s.services.some((v) => v.serviceId === id)),
        );
        setStaffId(compatible && a.staffId ? a.staffId : "any");
        setRepeatNotice(
          available.length === a.services.length
            ? "Your previous services are selected. Review today's prices and choose a new time."
            : "Some previous services are unavailable. Review the remaining selection or choose new services.",
        );
      })
      .catch((error) => {
        if (!cancelled) setRepeatError(error);
      })
      .finally(() => {
        if (!cancelled) setRepeatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salon, branch.id, staff, setBranch]);
  const slots = useQuery({
    queryKey: ["slots", salon.id, branch.id, ids, date, staffId],
    enabled: ids.length > 0,
    queryFn: () =>
      request<Slot[]>(
        `bookings/availability?${qs({ branchId: branch.id, serviceIds: ids.join(","), date, staffId: staffId === "any" ? undefined : staffId })}`,
        salon.id,
      ),
    staleTime: 0,
    retry: false,
  });
  const earliest = useMutation({
    mutationFn: (input: {
      date: string;
      ids: string[];
      staffId: string;
      preference: TimePreference;
    }) =>
      earliestAvailability(input.date, input.preference, (day) =>
        request<Slot[]>(
          `bookings/availability?${qs({ branchId: branch.id, serviceIds: input.ids.join(","), date: day, staffId: input.staffId === "any" ? undefined : input.staffId })}`,
          salon.id,
        ),
      ),
    onSuccess: (found, input) => {
      if (
        input.date !== date ||
        input.ids.join(",") !== ids.join(",") ||
        input.staffId !== staffId ||
        input.preference !== timePreference
      )
        return;
      if (found) {
        setDate(found.date);
        setSlot(found.slot.time);
      }
    },
  });
  const selected = salon.serviceCategories
    .flatMap((c) => c.services)
    .filter((s) => ids.includes(s.id));
  const chosen = slots.data?.find((s) => s.time === slot);
  const booking = useMutation({
    mutationFn: (input: VisitInput) =>
      request<Appointment>("bookings", salon.id, {
        method: "POST",
        staff,
        body: {
          ...input,
          dateStr: date,
          timeStr: slot,
          ...(staffId !== "any" ? { staffId } : {}),
        },
      }),
    onSuccess: async (result) => {
      remember("booking", result.id);
      await query.invalidateQueries();
      if (onDone) onDone();
      else router.push("/customer/bookings");
    },
    onError: () => {
      setSlot("");
      setStep(2);
      slots.refetch();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStepError("");
    if (
      !staff &&
      step === 3 &&
      (details.customerName.trim().length < 2 ||
        !/^\+?[0-9]{8,15}$/.test(details.customerPhone.replace(/[\s()-]/g, "")))
    ) {
      setStepError(
        "Enter your full name and a valid phone number including country code.",
      );
      return;
    }
    if (
      !staff &&
      step === 4 &&
      [details.address, details.city, details.postalCode, details.country].some(
        (v) => !v.trim(),
      )
    ) {
      setStepError("Complete each address field before continuing.");
      return;
    }
    if (!staff && step < 5) {
      if (
        (step === 0 && (!ids.length || !eligible.length)) ||
        (step === 2 && !chosen) ||
        (step === 4 &&
          details.contact === "Email" &&
          !details.customerEmail.trim())
      )
        return;
      next();
      return;
    }
    if (chosen && (staff || accepted))
      booking.mutate(
        staff
          ? visit(e.currentTarget, branch.id, ids)
          : {
              branchId: branch.id,
              serviceIds: ids,
              customerName: details.customerName.trim(),
              customerPhone: details.customerPhone.replace(/[\s()-]/g, ""),
              ...(details.customerEmail.trim()
                ? { customerEmail: details.customerEmail.trim() }
                : {}),
              notes: [
                `Customer address: ${details.address.trim()}, ${details.city.trim()}, ${details.postalCode.trim()}, ${details.country.trim()}`,
                `Preferred contact: ${details.contact}. First visit: ${details.firstVisit}.`,
                ...(preferences.length
                  ? [`Visit requests: ${preferences.join("; ")}`]
                  : []),
                details.notes.trim(),
              ]
                .filter(Boolean)
                .join("\n"),
            },
      );
  }
  return (
    <>
      <section className="booking-hero">
        <div className="eyebrow">Appointment booking</div>
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
      <form onSubmit={submit} className="booking-layout live-booking">
        <main
          ref={stepMain}
          tabIndex={-1}
          aria-label={
            staff ? "Staff booking" : `Booking step ${step + 1}: ${steps[step]}`
          }
        >
          {!staff && (
            <>
              <nav className="customer-stepper" aria-label="Booking progress">
                {steps.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    disabled={
                      i > step || booking.isPending || earliest.isPending
                    }
                    aria-current={i === step ? "step" : undefined}
                    onClick={() => setStep(i)}
                  >
                    <span>{i + 1}</span>
                    {label}
                  </button>
                ))}
              </nav>
              <p role="status">
                Step {step + 1} of {steps.length}: {steps[step]}
              </p>
            </>
          )}
          {repeatLoading ? (
            <p role="status">Loading your previous visit…</p>
          ) : (
            repeatNotice && (
              <p className="repeat-booking-notice" role="status">
                {repeatNotice}
              </p>
            )
          )}
          <ErrorNotice error={repeatError} />
          <fieldset className="repeat-booking-fields" disabled={repeatLoading}>
            <Selection
              step={staff ? undefined : step}
              ids={ids}
              setIds={(v) => {
                setIds(v);
                setSlot("");
                earliest.reset();
              }}
              staffId={staffId}
              setStaffId={(v) => {
                setStaffId(v);
                setSlot("");
                earliest.reset();
              }}
            />
          </fieldset>
          {(staff || step === 2) && (
            <section className="panel live-section">
              <h2>3. Select Date & Time</h2>
              <label>
                Appointment date
                <input
                  type="date"
                  disabled={earliest.isPending}
                  min={today(branch.timezone)}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSlot("");
                    earliest.reset();
                  }}
                  required
                />
              </label>
              {!staff && (
                <div className="booking-discovery">
                  <h3>Let us find your next free moment</h3>
                  <p>
                    Search seven days from your selected date, using live
                    availability for your services and stylist.
                  </p>
                  <label>
                    Preferred time of day
                    <select
                      disabled={earliest.isPending}
                      value={timePreference}
                      onChange={(e) => {
                        setTimePreference(e.target.value as TimePreference);
                        setSlot("");
                        earliest.reset();
                      }}
                    >
                      <option value="any">Any time</option>
                      <option value="morning">Morning · before 12 PM</option>
                      <option value="afternoon">Afternoon · 12–5 PM</option>
                      <option value="evening">Evening · after 5 PM</option>
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !ids.length ||
                      earliest.isPending ||
                      !date ||
                      date < today(branch.timezone)
                    }
                    onClick={() =>
                      earliest.mutate({
                        date,
                        ids: [...ids],
                        staffId,
                        preference: timePreference,
                      })
                    }
                  >
                    {earliest.isPending
                      ? "Finding your appointment…"
                      : "Find My Earliest Appointment"}
                  </Button>
                  <ErrorNotice error={earliest.error} />
                  {earliest.isSuccess && (
                    <p role="status">
                      {earliest.data
                        ? `Found ${earliest.data.date} at ${earliest.data.slot.time}. Review this time before continuing.`
                        : "No matching appointment in these seven days. Try another date or time preference."}
                    </p>
                  )}
                </div>
              )}
              <ErrorNotice error={slots.error} />
              {slots.isFetching && (
                <p role="status">Checking available times…</p>
              )}
              <div className="live-slots">
                {slots.data
                  ?.filter((s) => staff || matchesTime(s.time, timePreference))
                  .map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={earliest.isPending}
                      aria-pressed={slot === s.time}
                      className={slot === s.time ? "selected" : ""}
                      onClick={() => setSlot(s.time)}
                    >
                      {s.time}
                    </button>
                  ))}
              </div>
              {ids.length > 0 &&
                slots.data &&
                !slots.data.filter(
                  (s) => staff || matchesTime(s.time, timePreference),
                ).length && (
                  <p>
                    No availability on this date. Try a different date or
                    service combination.
                  </p>
                )}
            </section>
          )}
          {staff ? (
            <section className="panel live-section">
              <h2>4. Your Details</h2>
              <CustomerInputs />
            </section>
          ) : (
            <>
              {step === 3 && (
                <section className="panel live-section">
                  <h2>Your Details</h2>
                  <p>Tell us who the appointment is for.</p>
                  <div className="live-fields">
                    <label>
                      Your name
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        autoComplete="name"
                        {...field("customerName")}
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        type="tel"
                        required
                        pattern="[+]?[0-9\s]{8,18}"
                        autoComplete="tel"
                        {...field("customerPhone")}
                      />
                    </label>
                    <label>
                      Email (optional)
                      <input
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        {...field("customerEmail")}
                      />
                    </label>
                    <label>
                      First visit?
                      <select {...field("firstVisit")}>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </label>
                  </div>
                </section>
              )}
              {step === 4 && (
                <section className="panel live-section">
                  <h2>Your Address & Preferences</h2>
                  <div className="live-fields">
                    <label>
                      Street address
                      <input
                        required
                        maxLength={160}
                        autoComplete="street-address"
                        {...field("address")}
                      />
                    </label>
                    <label>
                      City
                      <input
                        required
                        maxLength={60}
                        autoComplete="address-level2"
                        {...field("city")}
                      />
                    </label>
                    <label>
                      Postal code
                      <input
                        required
                        maxLength={12}
                        autoComplete="postal-code"
                        {...field("postalCode")}
                      />
                    </label>
                    <label>
                      Country
                      <input
                        required
                        maxLength={60}
                        autoComplete="country-name"
                        {...field("country")}
                      />
                    </label>
                    <label>
                      Preferred contact
                      <select {...field("contact")}>
                        <option>Phone</option>
                        <option>Email</option>
                      </select>
                    </label>
                    <label>
                      Appointment notes (optional)
                      <textarea
                        rows={3}
                        maxLength={300}
                        placeholder="Style preferences or anything your stylist should know"
                        {...field("notes")}
                      />
                    </label>
                  </div>
                  {details.contact === "Email" &&
                    !details.customerEmail.trim() && (
                      <p role="alert" className="live-error">
                        Go back to Your Details to add an email address, or
                        choose Phone.
                      </p>
                    )}
                  <div className="visit-preferences">
                    <h3>Make this visit yours</h3>
                    <p>
                      Optional requests for your stylist; the salon will confirm
                      what it can accommodate.
                    </p>
                    {[
                      "Quiet appointment",
                      "Explain each step",
                      "Help me choose a style",
                    ].map((label) => (
                      <Button
                        key={label}
                        type="button"
                        variant="outline"
                        aria-pressed={preferences.includes(label)}
                        onClick={() =>
                          setPreferences((v) =>
                            v.includes(label)
                              ? v.filter((p) => p !== label)
                              : [...v, label],
                          )
                        }
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="live-policy">
                    Contact preferences are recorded with your booking. No SMS
                    or email is sent by this demo login.
                  </p>
                </section>
              )}
              {step === 5 && (
                <section className="panel live-section">
                  <h2>Review Your Appointment</h2>
                  <p>
                    {details.customerName} · {details.customerPhone}
                  </p>
                  {details.customerEmail && <p>{details.customerEmail}</p>}
                  <p>
                    {details.address}, {details.city}, {details.postalCode},{" "}
                    {details.country}
                  </p>
                  <p>
                    Preferred contact: {details.contact} · First visit:{" "}
                    {details.firstVisit}
                  </p>
                  {preferences.length > 0 && (
                    <p>Visit requests: {preferences.join(" · ")}</p>
                  )}
                  {details.notes && <p>{details.notes}</p>}
                  <p>
                    Your appointment is at {branch.name}, {branch.address},{" "}
                    {branch.city}.
                  </p>
                  <label className="booking-consent">
                    <input
                      type="checkbox"
                      required
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    I agree to the booking and cancellation policy below and to
                    providing these details to the salon for this appointment.
                  </label>
                </section>
              )}
              {stepError && (
                <p role="alert" className="live-error">
                  {stepError}
                </p>
              )}
              <div className="customer-step-actions">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((v) => v - 1)}
                    disabled={booking.isPending || earliest.isPending}
                  >
                    Back
                  </Button>
                )}
                {step < 5 && (
                  <Button
                    type="submit"
                    disabled={
                      (step === 0 && (!ids.length || !eligible.length)) ||
                      (step === 2 && !chosen) ||
                      (step === 4 &&
                        details.contact === "Email" &&
                        !details.customerEmail.trim())
                    }
                  >
                    Continue →
                  </Button>
                )}
              </div>
            </>
          )}
        </main>
        <aside className="booking-summary panel">
          <h2>Booking Summary</h2>
          <p>{branch.name}</p>
          <hr />
          {selected.map((s) => (
            <div className="summary-service" key={s.id}>
              <span>
                {s.name}
                <small>{s.duration} min</small>
              </span>
              <b>{amount(s.price, branch)}</b>
            </div>
          ))}
          <hr />
          <p>
            {staffId === "any"
              ? "Any Available Professional"
              : salon.staffProfiles.find((s) => s.id === staffId)?.name}
          </p>
          <p>
            {date} {chosen?.time || "Choose an available time"}
          </p>
          <div className="summary-total">
            <div>
              <small>Total Duration</small>
              <h3>{selected.reduce((sum, s) => sum + s.duration, 0)} min</h3>
            </div>
            <div>
              <small>Total Price</small>
              <h3>
                {amount(
                  selected.reduce((sum, s) => sum + s.price, 0),
                  branch,
                )}
              </h3>
            </div>
          </div>
          <ErrorNotice error={booking.error} />
          {(staff || step === 5) && (
            <Button
              type="submit"
              disabled={!chosen || booking.isPending || (!staff && !accepted)}
            >
              {booking.isPending ? "Confirming…" : "Confirm Booking"} →
            </Button>
          )}
          <p className="live-policy">
            Availability is rechecked on confirmation. Free cancellation up to{" "}
            {salon.salonProfile.cancellationWindowHours} hours before your
            appointment. No online payment is collected here.
          </p>
        </aside>
      </form>
    </>
  );
}
function JoinQueue({
  staff = false,
  onDone,
}: {
  staff?: boolean;
  onDone?: () => void;
}) {
  const { salon, branch } = useSalon();
  const router = useRouter();
  const query = useQueryClient();
  const [ids, setIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("any");
  const mutation = useMutation({
    mutationFn: (input: VisitInput) =>
      request<QueueReceipt>("queue/join", salon.id, {
        method: "POST",
        staff,
        body: {
          ...input,
          ...(staffId === "any" ? {} : { preferredStaffId: staffId }),
        },
      }),
    onSuccess: async (result) => {
      if (!staff) remember("queue", result.id);
      await query.invalidateQueries();
      if (onDone) onDone();
      else router.push("/queue");
    },
  });
  const compatible = salon.staffProfiles.some(
    (s) =>
      (!s.schedules ||
        s.schedules.some((v) => v.branchId === branch.id && v.isWorkingDay)) &&
      ids.every((id) => s.services.some((v) => v.serviceId === id)),
  );
  return (
    <form
      className="live-content"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(visit(e.currentTarget, branch.id, ids));
      }}
    >
      <div className="eyebrow">Live queue</div>
      <h1>{staff ? "Add Walk-in" : "Join Live Queue"}</h1>
      <p>{branch.name}. Your token and wait estimate appear after joining.</p>
      <Selection
        ids={ids}
        setIds={setIds}
        staffId={staffId}
        setStaffId={setStaffId}
      />
      <section className="panel live-section">
        <h2>Your Details</h2>
        <CustomerInputs />
        <ErrorNotice error={mutation.error} />
        <Button
          type="submit"
          disabled={!ids.length || !compatible || mutation.isPending}
        >
          {mutation.isPending
            ? "Joining…"
            : staff
              ? "Add Walk-in"
              : "Join Queue"}
        </Button>
      </section>
    </form>
  );
}
function QueueTravelPlanner({
  status,
  updatedAt,
}: {
  status: QueueStatus;
  updatedAt: number;
}) {
  const { salon, branch } = useSalon();
  const [travel, setTravel] = useState("15");
  const [buffer, setBuffer] = useState("5");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const valid =
    travel !== "" &&
    buffer !== "" &&
    Number(travel) >= 0 &&
    Number(travel) <= 180 &&
    Number(buffer) >= 0 &&
    Number(buffer) <= 30;
  const plan = departurePlan(
    updatedAt,
    status.estimatedWaitMinutes,
    Number(travel),
    Number(buffer),
    now,
  );
  const zone =
    salon.branches.find((b) => b.name === status.branchName)?.timezone ||
    branch.timezone;
  const clock = (value: number) =>
    new Intl.DateTimeFormat("en", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(value);
  return (
    <section className="queue-travel-planner">
      <div className="eyebrow">A little more time for you</div>
      <h3>When should I head over?</h3>
      <div className="live-fields">
        <label>
          Your travel time (minutes)
          <input
            type="number"
            min="0"
            max="180"
            value={travel}
            onChange={(e) => setTravel(e.target.value)}
          />
        </label>
        <label>
          Arrival buffer (minutes)
          <input
            type="number"
            min="0"
            max="30"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </label>
      </div>
      {valid ? (
        <div role="status">
          <strong>
            {status.status === "CALLED"
              ? "Your turn has been called. Contact the front desk now."
              : plan.leaveNow
                ? "Head over now"
                : `Aim to leave by ${clock(plan.leaveAt)}`}
          </strong>
          <p>
            Estimated turn around {clock(plan.expectedAt)} ({zone}).
          </p>
        </div>
      ) : (
        <p role="alert">
          Enter travel time from 0–180 and buffer from 0–30 minutes.
        </p>
      )}
      <p className="live-policy">
        Planning estimate only; your turn can move earlier. Stay nearby and
        watch your live status. Travel time is entered by you, not measured from
        traffic.
      </p>
    </section>
  );
}
function Queue() {
  const { salon, branch } = useSalon();
  const ids = useReceipts("queue");
  const [selection, setSelection] = useState("");
  const id = selection || ids[0];
  const query = useQueryClient();
  const status = useQuery({
    queryKey: ["queue-receipt", salon.id, id],
    enabled: !!id,
    queryFn: () => request<QueueStatus>(`queue/track/${id}`, salon.id),
    refetchInterval: 3000,
    retry: false,
  });
  const leave = useMutation({
    mutationFn: () =>
      request(`queue/${id}/leave`, salon.id, { method: "PATCH", body: {} }),
    onSuccess: () => query.invalidateQueries(),
  });
  const s = status.data;
  return (
    <section className="live-queue-layout">
      <div className="live-queue-intro">
        <div className="eyebrow">Live queue</div>
        <h1>
          Your Beauty
          <br />
          <em>Is on Its Way.</em>
        </h1>
        <p>
          Check your own queue status and enjoy a smoother, more relaxed salon
          experience.
        </p>
        <Link href="/queue/join" className="button gold">
          Join Live Queue →
        </Link>
      </div>
      <div className="panel live-queue-receipt">
        <Logo />
        <div className="eyebrow">Your Queue Status</div>
        {ids.length > 1 && (
          <label>
            Your visit
            <select value={id} onChange={(e) => setSelection(e.target.value)}>
              {ids.map((v, i) => (
                <option key={v} value={v}>
                  Visit {ids.length - i}
                </option>
              ))}
            </select>
          </label>
        )}
        {status.isLoading && <p role="status">Loading your visit…</p>}
        <ErrorNotice error={status.error} />
        {s ? (
          <>
            <small>Token Number</small>
            <h1>{s.tokenNumber}</h1>
            <span className="live-status">{human(s.status)}</span>
            <h3>{s.guestsAhead} guests ahead of you</h3>
            <p>Estimated wait: {s.estimatedWaitMinutes} minutes</p>
            {["WAITING", "CALLED"].includes(s.status) && (
              <QueueTravelPlanner
                key={id}
                status={s}
                updatedAt={status.dataUpdatedAt}
              />
            )}
            <hr />
            <p>Selected services: {s.services.join(", ")}</p>
            <p>Preferred stylist: {s.staffName}</p>
            <small>Updates every 3 seconds while this page is open.</small>
            <ErrorNotice error={leave.error} />
            {["WAITING", "CALLED", "CHECKED_IN"].includes(s.status) && (
              <Button
                variant="outline"
                disabled={leave.isPending}
                onClick={() => leave.mutate()}
              >
                Leave Queue
              </Button>
            )}
          </>
        ) : (
          !id && <p>Join the queue to receive your private visit receipt.</p>
        )}
      </div>
      <aside className="panel live-section">
        <img
          className="live-salon-photo"
          src="/photos/salon.webp"
          alt="Salon interior reference"
        />
        <h2>{branch.name}</h2>
        <p>
          {branch.address}, {branch.city}
        </p>
        <p>
          {branch.openingTime}–{branch.closingTime}
        </p>
        <a className="button outline" href={`tel:${branch.phone}`}>
          Call Salon
        </a>
        <a
          className="button outline"
          target="_blank"
          rel="noreferrer"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.address} ${branch.city}`)}`}
        >
          Get Directions
        </a>
      </aside>
    </section>
  );
}
function BookingReceipt({ id }: { id: string }) {
  const { salon, branch } = useSalon();
  const query = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(today(branch.timezone));
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const booking = useQuery({
    queryKey: ["booking", salon.id, id],
    queryFn: () => request<Appointment>(`bookings/${id}`, salon.id),
    retry: false,
    refetchInterval: 5000,
  });
  const a = booking.data;
  const bookingBranch =
    salon.branches.find((b) => b.id === a?.branchId) || branch;
  function downloadCalendar() {
    if (!a) return;
    const url = URL.createObjectURL(
      new Blob([calendarFile(a, bookingBranch)], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "velora-appointment.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const slots = useQuery({
    queryKey: ["reschedule-slots", id, date],
    enabled: editing && !!a,
    queryFn: () =>
      request<Slot[]>(`bookings/${id}/availability?${qs({ date })}`, salon.id),
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      request(`bookings/${id}/${path}`, salon.id, { method: "PATCH", body }),
    onSuccess: async () => {
      setEditing(false);
      await query.invalidateQueries();
    },
  });
  return (
    <article className="panel live-section">
      <ErrorNotice error={booking.error} />
      {booking.isLoading && <p>Loading booking…</p>}
      {a && (
        <>
          <div className="live-row">
            <h2>{a.services.map((s) => s.service.name).join(" + ")}</h2>
            <span className="live-status">{human(a.status)}</span>
          </div>
          <p>
            {at(a.startTime, bookingBranch)} · {a.staff?.name} ·{" "}
            {amount(a.totalPrice, bookingBranch)}
          </p>
          <p>Booking reference: {a.id}</p>
          <Link
            className="button outline repeat-booking-link"
            href={`/book?${qs({ repeat: a.id })}`}
          >
            Book This Again →
          </Link>
          {a.status === "CONFIRMED" && (
            <div className="booking-calendar">
              <h3>Keep your day flowing</h3>
              <p>
                Save this appointment to your calendar. After rescheduling,
                update the saved event too.
              </p>
              <div className="live-receipt-actions">
                <a
                  className="button outline"
                  target="_blank"
                  rel="noreferrer"
                  href={googleCalendarUrl(a, bookingBranch)}
                >
                  Add to Google Calendar
                </a>
                <Button variant="outline" onClick={downloadCalendar}>
                  Download Calendar File
                </Button>
              </div>
            </div>
          )}
          {a.status === "CONFIRMED" && (
            <div className="live-receipt-actions">
              <Button variant="outline" onClick={() => setEditing(!editing)}>
                Reschedule
              </Button>
              <label>
                Cancellation reason
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={!reason.trim() || action.isPending}
                onClick={() =>
                  action.mutate({ path: "cancel", body: { reason } })
                }
              >
                Cancel Booking
              </Button>
            </div>
          )}
          {editing && (
            <form
              className="live-fields"
              onSubmit={(e) => {
                e.preventDefault();
                action.mutate({
                  path: "reschedule",
                  body: { dateStr: date, timeStr: slot },
                });
              }}
            >
              <label>
                New date
                <input
                  type="date"
                  min={today(branch.timezone)}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSlot("");
                  }}
                  required
                />
              </label>
              <label>
                New time
                <select
                  required
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                >
                  <option value="">Choose a time</option>
                  {slots.data?.map((s) => (
                    <option key={s.time} value={s.time}>
                      {s.time}
                    </option>
                  ))}
                </select>
              </label>
              <ErrorNotice error={slots.error} />
              <Button disabled={!slot || action.isPending}>
                Save New Time
              </Button>
            </form>
          )}
          <ErrorNotice error={action.error} />
        </>
      )}
    </article>
  );
}
function MyBookings() {
  const ids = useReceipts("booking");
  return (
    <section className="live-content">
      <div className="eyebrow">Your appointments</div>
      <h1>My Bookings</h1>
      <p>
        Private receipts for bookings made in this browser. Keep this browser’s
        cookies to manage your visits.
      </p>
      {ids.map((id) => (
        <BookingReceipt key={id} id={id} />
      ))}
      {!ids.length && (
        <Link href="/book" className="button gold">
          Book an Appointment
        </Link>
      )}
    </section>
  );
}
function Login({ refresh }: { refresh: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      request<{ user: StaffUser }>("auth/login", undefined, {
        method: "POST",
        body: { email, password },
      }),
    onSuccess: () => {
      setPassword("");
      refresh();
    },
  });
  return (
    <section className="live-login panel">
      <Logo />
      <div className="eyebrow">Staff access</div>
      <h1>Welcome Back.</h1>
      <p>Sign in with your salon staff account.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <label>
          Email
          <input
            autoComplete="username"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorNotice error={login.error} />
        <Button disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign In"}
        </Button>
      </form>
      <Link href="/">Return to salon website →</Link>
    </section>
  );
}
function Operations({ insights }: { insights: boolean }) {
  const session = useQuery({
    queryKey: ["staff-session"],
    queryFn: () => request<StaffUser>("auth/me"),
    retry: false,
    staleTime: 30000,
  });
  const query = useQueryClient();
  const { salon, branch, setBranch } = useSalon();
  const logout = useMutation({
    mutationFn: () =>
      request("auth/logout", undefined, { method: "POST", body: {} }),
    onSuccess: () => {
      query.clear();
      session.refetch();
    },
  });
  if (session.isLoading)
    return (
      <div className="live-content" role="status">
        Checking staff session…
      </div>
    );
  if (session.error instanceof ApiError && session.error.status === 401)
    return (
      <Login
        refresh={() => {
          query.clear();
          session.refetch();
        }}
      />
    );
  if (!session.data)
    return (
      <div className="live-content">
        <ErrorNotice error={session.error} />
        <Button onClick={() => session.refetch()}>Retry</Button>
      </div>
    );
  const user = session.data;
  if (user.tenantId !== salon.id)
    return (
      <div className="live-content">
        <p role="alert">
          This account belongs to a different salon. Configure
          NEXT_PUBLIC_SALON_SLUG for that salon.
        </p>
        <Button onClick={() => logout.mutate()}>Sign Out</Button>
      </div>
    );
  const allowed = insights
    ? ["SALON_OWNER", "BRANCH_MANAGER"]
    : ["SALON_OWNER", "BRANCH_MANAGER", "RECEPTIONIST", "PROFESSIONAL"];
  return (
    <div className="operations">
      <aside className="sidebar">
        <Link href="/">
          <Logo light />
        </Link>
        <nav>
          <Link href="/desk" className={!insights ? "active" : ""}>
            <House size={20} />
            <span>Overview</span>
          </Link>
          <Link href="/dashboard" className={insights ? "active" : ""}>
            <ChartNoAxesColumn size={20} />
            <span>Owner Insights</span>
          </Link>
          <Link href="/book">
            <CalendarDays size={20} />
            <span>Appointments</span>
          </Link>
          <Link href="/services">
            <Scissors size={20} />
            <span>Services</span>
          </Link>
          <Link href="/professionals">
            <Users size={20} />
            <span>Team</span>
          </Link>
        </nav>
        <img src="/brand/symbol.svg" alt="Velora symbol" />
      </aside>
      <div className="operations-main">
        <header className="live-ops-header">
          <div>
            <b>{salon.name}</b>
            <label>
              Branch
              <select
                value={branch.id}
                onChange={(e) => setBranch(e.target.value)}
              >
                {salon.branches
                  .filter(
                    (b) =>
                      user.role === "SALON_OWNER" ||
                      !user.branchId ||
                      b.id === user.branchId,
                  )
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <span>
            {user.name}
            <small>{human(user.role)}</small>
          </span>
          <Button variant="outline" onClick={() => logout.mutate()}>
            <LogOut size={16} /> Sign Out
          </Button>
        </header>
        {!allowed.includes(user.role) ? (
          <p className="live-error" role="alert">
            Your account does not have access to this screen.
          </p>
        ) : insights ? (
          <Insights />
        ) : (
          <Reception user={user} />
        )}
      </div>
    </div>
  );
}
function Reception({ user }: { user: StaffUser }) {
  const { salon, branch } = useSalon();
  const query = useQueryClient();
  const [date, setDate] = useState(today(branch.timezone));
  const [dialog, setDialog] = useState("");
  const [q, setQ] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const [position, setPosition] = useState(1);
  const desk = useQuery({
    queryKey: ["desk", salon.id, branch.id, date],
    queryFn: () =>
      request<Desk>(
        `desk/overview?${qs({ branchId: branch.id, date })}`,
        salon.id,
      ),
    refetchInterval: 3000,
    retry: false,
  });
  const lookup = useQuery({
    queryKey: ["lookup", salon.id, branch.id, q],
    enabled: q.trim().length >= 2,
    queryFn: () =>
      request<SearchResults>(
        `desk/search?${qs({ branchId: branch.id, q })}`,
        salon.id,
      ),
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({
      path,
      body = {},
      method = "POST",
    }: {
      path: string;
      body?: unknown;
      method?: string;
    }) => request(path, salon.id, { method, body, staff: true }),
    onSuccess: async () => {
      setDialog("");
      await query.invalidateQueries();
    },
  });
  const waiting = desk.data?.waiting || [];
  const active = desk.data?.inService || [];
  const canManage = user.role !== "PROFESSIONAL";
  function open(title: string, e?: Entry) {
    action.reset();
    setDialog(title);
    setEntry(e || null);
    setStaffId(e?.staffId || "");
    setReason("");
    setPosition(e?.position || 1);
  }
  function mutate(path: string, body?: unknown, method?: string) {
    action.mutate({ path, body, method });
  }
  return (
    <>
      <section className="desk-hero">
        <div>
          <h2>Welcome,</h2>
          <h1>{user.name.split(" ")[0]}.</h1>
          <p>A smoother day creates more beautiful moments.</p>
        </div>
        <div className="desk-stats">
          {[
            [waiting.length, "In Queue"],
            [desk.data?.upcoming.length || 0, "Upcoming Bookings"],
            [active.length, "In Service"],
            [salon.staffProfiles.length, "Professionals"],
          ].map(([value, title]) => (
            <div className="panel" key={title}>
              <span className="icon-circle">
                <Users />
              </span>
              <h2>{value}</h2>
              <p>{title}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="desk-body">
        <label className="live-date-filter">
          Reception date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <ErrorNotice error={desk.error} />
        <ErrorNotice error={action.error} />
        {desk.isLoading && <p role="status">Loading reception desk…</p>}
        <div className="quick-actions">
          {canManage && (
            <>
              <Button onClick={() => open("Add Walk-in")}>
                <Plus /> Add Walk-in
              </Button>
              <Button variant="outline" onClick={() => open("New Booking")}>
                <CalendarDays /> New Booking
              </Button>
              <Button variant="outline" onClick={() => open("Customer Lookup")}>
                Customer Lookup
              </Button>
              <Button variant="outline" onClick={() => open("Quick Check In")}>
                Quick Check In
              </Button>
            </>
          )}
        </div>
        <div className="live-desk-grid">
          <section className="panel live-section">
            <h2>
              Waiting Queue <small>{waiting.length} people</small>
            </h2>
            {waiting.map((e) => (
              <div className="live-operational-row" key={e.id}>
                <b>{e.tokenNumber}</b>
                <section>
                  <h3>{e.customer.name}</h3>
                  <small>{e.customer.phone}</small>
                  <p>{e.services?.map((s) => s.name).join(", ")}</p>
                </section>
                <span>
                  {human(e.status)}
                  <small>Est. {e.estimatedWaitMinutes} min</small>
                </span>
                <div className="live-row-actions">
                  <Button
                    disabled={action.isPending}
                    variant="outline"
                    onClick={() => open("Start Service", e)}
                  >
                    Assign / Start
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        disabled={action.isPending || e.status === "CALLED"}
                        onClick={() =>
                          mutate(
                            `queue/${e.id}/status`,
                            { status: "CALLED" },
                            "PATCH",
                          )
                        }
                      >
                        Call
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => open("Manage Queue", e)}
                      >
                        Manage
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!waiting.length && !desk.isLoading && <p>No waiting guests.</p>}
          </section>
          <section className="panel live-section">
            <h2>
              In Service <small>{active.length} ongoing</small>
            </h2>
            {active.map((e) => (
              <div className="live-operational-row" key={e.id}>
                <section>
                  <h3>{e.customer.name}</h3>
                  <p>{e.services?.map((s) => s.name).join(", ")}</p>
                  <small>with {e.staff?.name}</small>
                </section>
                <Button
                  disabled={action.isPending}
                  onClick={() =>
                    mutate(
                      `queue/${e.id}/status`,
                      { status: "COMPLETED" },
                      "PATCH",
                    )
                  }
                >
                  Complete
                </Button>
              </div>
            ))}
            {!active.length && <p>No services in progress.</p>}
          </section>
        </div>
        <section className="panel live-section">
          <h2>Upcoming Appointments</h2>
          {desk.data?.upcoming.map((a) => (
            <div className="live-operational-row" key={a.id}>
              <time>{at(a.startTime, branch)}</time>
              <section>
                <h3>{a.customer.name}</h3>
                <p>{a.services.map((s) => s.service.name).join(", ")}</p>
              </section>
              <p>{a.staff?.name}</p>
              {canManage && (
                <>
                  <Button
                    disabled={action.isPending}
                    onClick={() => mutate(`flow/check-in/${a.id}`)}
                  >
                    Check In
                  </Button>
                  <Button
                    disabled={action.isPending}
                    variant="outline"
                    onClick={() => mutate(`desk/no-show/${a.id}`)}
                  >
                    No Show
                  </Button>
                </>
              )}
            </div>
          ))}
          {desk.data?.upcoming.length === 0 && (
            <p>No upcoming appointments for this date.</p>
          )}
        </section>
        <section className="panel live-section">
          <h2>Our Professionals</h2>
          <div className="live-team-grid">
            {salon.staffProfiles.map((s) => (
              <Professional key={s.id} staff={s} />
            ))}
          </div>
        </section>
      </div>
      <Dialog
        title={dialog}
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) setDialog("");
        }}
      >
        {dialog === "Add Walk-in" ? (
          <JoinQueue staff onDone={() => setDialog("")} />
        ) : dialog === "New Booking" ? (
          <Booking staff onDone={() => setDialog("")} />
        ) : ["Customer Lookup", "Quick Check In"].includes(dialog) ? (
          <>
            <label>
              Search customers
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, phone, or booking reference"
              />
            </label>
            <ErrorNotice error={lookup.error} />
            {lookup.isFetching && <p>Searching…</p>}
            {lookup.data?.customers.map((c) => (
              <p key={c.id}>
                {c.name} · {c.phone}
              </p>
            ))}
            {lookup.data?.appointments.map((a) => (
              <div className="live-operational-row" key={a.id}>
                <section>
                  <b>{a.customer.name}</b>
                  <p>
                    {at(a.startTime, branch)} · {human(a.status)}
                  </p>
                </section>
                {a.status === "CONFIRMED" && (
                  <Button
                    disabled={action.isPending}
                    onClick={() => mutate(`flow/check-in/${a.id}`)}
                  >
                    Check In
                  </Button>
                )}
              </div>
            ))}
          </>
        ) : dialog === "Start Service" && entry ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                `queue/${entry.id}/status`,
                { status: "IN_SERVICE", staffId },
                "PATCH",
              );
            }}
          >
            <label>
              Assigned professional
              <select
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              >
                <option value="">Choose a professional</option>
                {salon.staffProfiles
                  .filter((s) =>
                    entry.serviceIds.every((id) =>
                      s.services.some((v) => v.serviceId === id),
                    ),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button disabled={!staffId || action.isPending}>
              Start Service
            </Button>
          </form>
        ) : dialog === "Manage Queue" && entry ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  `queue/${entry.id}/reorder`,
                  { newPosition: position, reason },
                  "PATCH",
                );
              }}
            >
              <label>
                New position
                <input
                  type="number"
                  min={1}
                  max={waiting.length}
                  required
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value))}
                />
              </label>
              <label>
                Reason
                <input
                  minLength={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button disabled={action.isPending}>Reorder Queue</Button>
            </form>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() =>
                mutate(
                  `queue/${entry.id}/status`,
                  { status: "CANCELLED" },
                  "PATCH",
                )
              }
            >
              Cancel Queue Entry
            </Button>
          </>
        ) : null}
        <ErrorNotice error={action.error} />
      </Dialog>
    </>
  );
}
function Insights() {
  const { salon, branch } = useSalon();
  const [date, setDate] = useState(today(branch.timezone));
  const analytics = useQuery({
    queryKey: ["analytics", salon.id, branch.id, date],
    queryFn: () =>
      request<Analytics>(
        `analytics/dashboard?${qs({ branchId: branch.id, date })}`,
        salon.id,
      ),
    retry: false,
    refetchInterval: 10000,
  });
  const a = analytics.data;
  return (
    <section className="live-content">
      <div className="live-row">
        <div>
          <h1>Owner Insights</h1>
          <div className="eyebrow">Real data. Brighter decisions.</div>
        </div>
        <label>
          Reporting date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <ErrorNotice error={analytics.error} />
      {analytics.isLoading && <p>Loading insights…</p>}
      {a && (
        <>
          <div className="live-kpis">
            {[
              [a.customersToday, "Customers"],
              [a.appointmentsToday, "Appointments"],
              [a.walkinsToday, "Walk-ins"],
              [`${a.avgWaitMinutes} min`, "Average Wait Time"],
              [a.noShowRate, "No-show Rate"],
              [a.completedServices, "Completed Services"],
            ].map(([value, title]) => (
              <div className="panel live-section" key={title}>
                <span className="icon-circle">
                  <Clock />
                </span>
                <h3>{title}</h3>
                <h2>{value}</h2>
              </div>
            ))}
          </div>
          <div className="live-insights-grid">
            <section className="panel live-section">
              <h2>Appointments vs Walk-ins</h2>
              <p>
                {a.date} · {branch.name}
              </p>
              <div className="live-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Bookings", count: a.appointmentsToday },
                      { name: "Walk-ins", count: a.walkinsToday },
                    ]}
                  >
                    <CartesianGrid stroke="#eee5d8" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#c7a56a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel live-section">
              <h2>Most-Booked Services</h2>
              {a.serviceDemand.map((s) => (
                <div key={s.id} className="live-demand">
                  <span>{s.name}</span>
                  <b>{s.count}</b>
                  <progress
                    value={s.count}
                    max={Math.max(1, ...a.serviceDemand.map((v) => v.count))}
                  />
                </div>
              ))}
              {!a.serviceDemand.length && (
                <p>No service demand recorded for this date.</p>
              )}
            </section>
            <section className="panel live-section">
              <h2>Professional Utilization</h2>
              <p>
                Booked service minutes against the API’s 8-hour reference shift.
              </p>
              {a.staffUtilization.map((s) => (
                <div className="live-demand" key={s.staffId}>
                  <span>{s.name}</span>
                  <b>{s.utilizationPct}%</b>
                  <progress value={s.utilizationPct} max={100} />
                </div>
              ))}
            </section>
            <section className="panel live-section">
              <h2>Service & Waiting</h2>
              <h3>{a.avgWaitMinutes} min average wait</h3>
              <p>{a.avgServiceMinutes} min average service duration</p>
              <p>{a.cancellationRate} cancellation rate</p>
              <p>
                Historical trends and payment revenue are not provided by the
                current analytics endpoint.
              </p>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
function Supporting({ path }: { path: string }) {
  const { salon, branch } = useSalon();
  const [category, setCategory] = useState("");
  useEffect(() => {
    setCategory(
      new URLSearchParams(window.location.search).get("category") || "",
    );
  }, []);
  if (path === "/contact")
    return (
      <section className="live-content">
        <div className="eyebrow">Visit us</div>
        <h1>{salon.name}</h1>
        <div className="panel live-section">
          <h2>{branch.name}</h2>
          <p>
            {branch.address}, {branch.city}
          </p>
          <p>
            {branch.openingTime}–{branch.closingTime} · Closed{" "}
            {branch.weeklyHolidays.map(human).join(", ")}
          </p>
          <a className="button gold" href={`tel:${branch.phone}`}>
            Call {branch.phone}
          </a>
          {branch.email && (
            <p>
              <a href={`mailto:${branch.email}`}>{branch.email}</a>
            </p>
          )}
        </div>
      </section>
    );
  if (path === "/professionals")
    return (
      <section className="live-content">
        <div className="eyebrow">Our professionals</div>
        <h1>Expert Hands. Personal Care.</h1>
        <div className="live-team-grid">
          {salon.staffProfiles.map((s) => (
            <Professional key={s.id} staff={s} />
          ))}
        </div>
        <Link className="button gold" href="/book">
          Book an Appointment →
        </Link>
      </section>
    );
  return (
    <section className="live-content">
      <div className="eyebrow">Our services</div>
      <h1>Look Good. Feel Even Better.</h1>
      <label>
        Service category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All services</option>
          {salon.serviceCategories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="service-grid">
        {salon.serviceCategories
          .filter((c) => !category || c.id === category)
          .flatMap((c) => c.services)
          .map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
      </div>
    </section>
  );
}
export function LiveApp() {
  const path = usePathname();
  const [branchId, setBranchId] = useState("");
  const salon = useQuery({
    queryKey: ["salon", slug],
    queryFn: () => request<Salon>(`tenants/public/${encodeURIComponent(slug)}`),
    staleTime: 10000,
    refetchInterval: 15000,
    retry: 1,
  });
  if (salon.isLoading)
    return (
      <div className="live-content" role="status">
        Loading salon…
      </div>
    );
  if (!salon.data)
    return (
      <div className="live-content">
        <Logo />
        <ErrorNotice error={salon.error} />
        <Button onClick={() => salon.refetch()}>Retry Connection</Button>
      </div>
    );
  const branch =
    salon.data.branches.find((b) => b.id === branchId) ||
    salon.data.branches[0];
  if (!branch) return <p role="alert">This salon has no active branches.</p>;
  const operations = ["/desk", "/dashboard"].includes(path);
  return (
    <C.Provider value={{ salon: salon.data, branch, setBranch: setBranchId }}>
      {operations ? (
        <Operations insights={path === "/dashboard"} />
      ) : (
        <>
          <Header />
          {salon.data.branches.length > 1 && (
            <div className="live-branch-select">
              <label>
                Salon branch
                <select
                  value={branch.id}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  {salon.data.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {path === "/" ? (
            <Home />
          ) : path === "/book" ? (
            <CustomerBookingGate key={branch.id} />
          ) : path === "/queue/join" ? (
            <JoinQueue key={branch.id} />
          ) : path === "/queue" ? (
            <Queue />
          ) : path === "/customer/bookings" ? (
            <MyBookings />
          ) : (
            <Supporting path={path} />
          )}
          <Footer />
        </>
      )}
    </C.Provider>
  );
}
