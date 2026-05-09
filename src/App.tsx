import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import dayjs from "dayjs";
import "./style.css";
import { supabase } from "./lib/supabase";
import { calculateDashboardKpis } from "./lib/dashboard";
import { importFromBrowserContacts, parseContactsCsv, parseContactsVcf } from "./lib/contactImport";
import type { ContactInput, ContactRecord, ContactStatus, PaymentFrequency, PaymentKind, PaymentRecord } from "./types";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;

export default function App() {
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState<string>("");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [contactForm, setContactForm] = useState<ContactInput>({
    full_name: "",
    email: "",
    phone: "",
    source: "manual",
    status: "new",
    follow_up_required: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    contact_id: "",
    amount: "",
    kind: "one_time" as PaymentKind,
    frequency: "monthly" as PaymentFrequency,
    start_date: dayjs().format("YYYY-MM-DD"),
    end_date: "",
  });

  const canUseBrowserContacts = "contacts" in navigator && "ContactsManager" in window;
  const kpis = useMemo(() => calculateDashboardKpis(contacts, payments), [contacts, payments]);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const userEmail = data.session?.user?.email ?? "";
    setSessionEmail(userEmail);
    if (userEmail && isAllowedAdmin(userEmail)) {
      await loadData();
    }
    setLoading(false);
  }

  async function loadData() {
    const [contactsRes, paymentsRes] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
    ]);
    if (contactsRes.error) throw contactsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    setContacts((contactsRes.data as ContactRecord[]) ?? []);
    setPayments((paymentsRes.data as PaymentRecord[]) ?? []);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError("");
    const { email, password } = authForm;
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
      return;
    }

    const userEmail = result.data.user?.email ?? "";
    if (!isAllowedAdmin(userEmail)) {
      await supabase.auth.signOut();
      setError("המשתמש אינו מורשה כאדמין יחיד.");
      return;
    }
    setSessionEmail(userEmail);
    await loadData();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSessionEmail("");
    setContacts([]);
    setPayments([]);
  }

  async function createContact(e: FormEvent) {
    e.preventDefault();
    setError("");
    const payload: ContactInput = {
      ...contactForm,
      full_name: contactForm.full_name.trim(),
    };
    if (!payload.full_name) {
      setError("שם איש קשר הוא שדה חובה.");
      return;
    }
    const { error: dbError } = await supabase.from("contacts").insert(payload);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setContactForm({
      full_name: "",
      email: "",
      phone: "",
      source: "manual",
      status: "new",
      follow_up_required: true,
    });
    await loadData();
  }

  async function createPayment(e: FormEvent) {
    e.preventDefault();
    setError("");
    const amount = Number(paymentForm.amount);
    if (!paymentForm.contact_id || Number.isNaN(amount) || amount <= 0) {
      setError("יש למלא איש קשר וסכום תקין.");
      return;
    }
    const payload = {
      contact_id: paymentForm.contact_id,
      amount,
      kind: paymentForm.kind,
      frequency: paymentForm.kind === "recurring" ? paymentForm.frequency : null,
      start_date: paymentForm.start_date,
      end_date: paymentForm.end_date || null,
      is_active: true,
    };
    const { error: dbError } = await supabase.from("payments").insert(payload);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setPaymentForm({
      contact_id: "",
      amount: "",
      kind: "one_time",
      frequency: "monthly",
      start_date: dayjs().format("YYYY-MM-DD"),
      end_date: "",
    });
    await loadData();
  }

  async function bulkImport(payload: ContactInput[]) {
    if (!payload.length) return;
    const { error: dbError } = await supabase.from("contacts").insert(payload);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await loadData();
  }

  async function importBrowserContacts() {
    try {
      const imported = await importFromBrowserContacts();
      await bulkImport(imported);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function importFallbackFile(file: File) {
    const content = await file.text();
    if (file.name.toLowerCase().endsWith(".csv")) {
      await bulkImport(parseContactsCsv(content));
      return;
    }
    if (file.name.toLowerCase().endsWith(".vcf")) {
      await bulkImport(parseContactsVcf(content));
      return;
    }
    setError("נתמך רק CSV או VCF.");
  }

  async function updateStatus(contactId: string, status: ContactStatus) {
    const followUp = status !== "active_payer";
    const { error: dbError } = await supabase
      .from("contacts")
      .update({ status, follow_up_required: followUp })
      .eq("id", contactId);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await loadData();
  }

  if (loading) return <main className="container">טוען...</main>;

  if (!sessionEmail) {
    return (
      <main className="container">
        <h1>Kolel Payments Tracker</h1>
        <p>התחברות אדמין יחיד דרך Supabase Auth</p>
        <form className="card form-grid" onSubmit={handleSignIn}>
          <input
            type="email"
            placeholder="Admin email"
            value={authForm.email}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={authForm.password}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
          <button type="submit">Sign in</button>
          {ADMIN_EMAIL ? <small>Authorized admin: {ADMIN_EMAIL}</small> : null}
        </form>
        {error ? <p className="error">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header-row">
        <div>
          <h1>Kolel Payments Dashboard</h1>
          <p>{sessionEmail}</p>
        </div>
        <button onClick={handleSignOut}>Sign out</button>
      </header>

      <section className="kpi-grid">
        <KpiCard label="Potential payers" value={kpis.totalPotentials} />
        <KpiCard label="Active payers" value={kpis.activePayers} />
        <KpiCard label="Follow-up needed" value={kpis.followUpCount} />
        <KpiCard label="Monthly run rate" value={`₪${kpis.monthlyRunRate}`} />
        <KpiCard label="Yearly run rate" value={`₪${kpis.yearlyRunRate}`} />
        <KpiCard label="One-time collected" value={`₪${kpis.totalOneTimeAmount}`} />
      </section>

      <section className="two-columns">
        <article className="card">
          <h2>Import contacts</h2>
          <div className="row">
            <button onClick={importBrowserContacts} disabled={!canUseBrowserContacts}>
              Import via Browser Contacts API
            </button>
            <span>{canUseBrowserContacts ? "Supported" : "Not supported in this browser"}</span>
          </div>
          <label className="file-label">
            CSV/VCF fallback
            <input
              type="file"
              accept=".csv,.vcf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFallbackFile(file);
              }}
            />
          </label>
        </article>

        <article className="card">
          <h2>Create contact manually</h2>
          <form className="form-grid" onSubmit={createContact}>
            <input
              placeholder="Full name"
              value={contactForm.full_name}
              onChange={(e) => setContactForm((p) => ({ ...p, full_name: e.target.value }))}
              required
            />
            <input
              placeholder="Email"
              value={contactForm.email}
              onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
            />
            <input
              placeholder="Phone"
              value={contactForm.phone}
              onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <button type="submit">Add contact</button>
          </form>
        </article>
      </section>

      <section className="two-columns">
        <article className="card">
          <h2>Track payment</h2>
          <form className="form-grid" onSubmit={createPayment}>
            <select
              value={paymentForm.contact_id}
              onChange={(e) => setPaymentForm((p) => ({ ...p, contact_id: e.target.value }))}
              required
            >
              <option value="">Select contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
            <input
              placeholder="Amount"
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
            <select
              value={paymentForm.kind}
              onChange={(e) => setPaymentForm((p) => ({ ...p, kind: e.target.value as PaymentKind }))}
            >
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
            {paymentForm.kind === "recurring" ? (
              <select
                value={paymentForm.frequency}
                onChange={(e) => setPaymentForm((p) => ({ ...p, frequency: e.target.value as PaymentFrequency }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            ) : null}
            <input
              type="date"
              value={paymentForm.start_date}
              onChange={(e) => setPaymentForm((p) => ({ ...p, start_date: e.target.value }))}
              required
            />
            <input
              type="date"
              value={paymentForm.end_date}
              onChange={(e) => setPaymentForm((p) => ({ ...p, end_date: e.target.value }))}
            />
            <button type="submit">Save payment</button>
          </form>
        </article>

        <article className="card">
          <h2>Potential payers</h2>
          <ul className="list">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <div>
                  <strong>{contact.full_name}</strong>
                  <p>{contact.email || contact.phone || "No details"}</p>
                </div>
                <select value={contact.status} onChange={(e) => void updateStatus(contact.id, e.target.value as ContactStatus)}>
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="committed">committed</option>
                  <option value="active_payer">active_payer</option>
                  <option value="inactive">inactive</option>
                </select>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="card">
      <h3>{label}</h3>
      <p className="kpi-value">{value}</p>
    </article>
  );
}

function isAllowedAdmin(email: string): boolean {
  if (!ADMIN_EMAIL) return true;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
