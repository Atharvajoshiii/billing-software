"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  FileText,
  Home,
  IndianRupee,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase";

type Business = {
  id: string;
  name: string;
  gstin: string | null;
  state_code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};
type Party = {
  id: string;
  name: string;
  kind: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  state_code: string | null;
  opening_balance: number;
};
type Product = {
  id: string;
  name: string;
  sku: string | null;
  hsn_sac: string | null;
  unit: string;
  sale_price: number;
  purchase_price: number;
  gst_rate: number;
  stock_on_hand: number;
  track_stock: boolean;
  active: boolean;
};
type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  amount_paid: number;
  notes: string | null;
  party_id: string | null;
  seller_name: string | null;
  seller_gstin: string | null;
  seller_state_code: string | null;
  seller_address: string | null;
  party_name: string | null;
  party_gstin: string | null;
  party_state_code: string | null;
  party_address: string | null;
  parties?: { name: string } | null;
  invoice_lines?: {
    description: string;
    quantity: number;
    unit_price: number;
    gst_rate: number;
    taxable_value: number;
    tax_amount: number;
    line_total: number;
  }[];
};
type Purchase = {
  id: string;
  bill_number: string;
  supplier_invoice_number: string | null;
  bill_date: string;
  status: string;
  grand_total: number;
  amount_paid: number;
  parties?: { name: string } | null;
};
type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  gst_amount: number;
  expense_date: string;
  payment_method: string;
};
type Payment = {
  id: string;
  payment_date: string;
  amount: number;
  method: string;
  invoice_id: string | null;
  purchase_id: string | null;
  party_id: string | null;
};
type DatePreset =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "all"
  | "custom";
type Section =
  | "Dashboard"
  | "Invoices"
  | "Products"
  | "Customers"
  | "Purchases"
  | "Expenses"
  | "Journal"
  | "GST reports"
  | "Team"
  | "Audit history"
  | "Settings";
type MemberRole = "owner" | "admin" | "accountant" | "cashier" | "stock_staff";
type TeamMember = {
  user_id: string;
  email: string | null;
  display_name: string;
  role: MemberRole;
  created_at: string;
};
type WorkspaceOption = { id: string; name: string; role: MemberRole };
type BusinessInvitation = {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  expires_at: string;
  created_at: string;
};
type FinancialYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
};
type AccountingPeriod = {
  id: string;
  period_start: string;
  period_end: string;
  status: "open" | "locked";
};
type ChartAccount = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
};
type OpeningBalanceBatch = {
  id: string;
  financial_year_id: string;
  status: string;
  effective_date: string;
  posted_at: string | null;
};
type GstRegistration = {
  id: string;
  gstin: string;
  state_code: string;
  registration_type: string;
  legal_name: string | null;
  trade_name: string | null;
  effective_from: string | null;
  effective_to: string | null;
  return_frequency: string;
  is_primary: boolean;
  is_active: boolean;
};
type AuditEvent = {
  id: string;
  operation: string;
  table_name: string;
  entity_key: string;
  occurred_at: string;
  actor_user_id: string | null;
};
type JournalLineView = {
  line_number: number;
  description: string | null;
  debit: number;
  credit: number;
  business_chart_of_accounts: { account_code: string; account_name: string } | null;
};
type JournalEntry = {
  id: string;
  journal_number: string;
  entry_date: string;
  description: string;
  source_type: string;
  status: "posted" | "reversed";
  reversal_of_entry_id: string | null;
  reversed_by_entry_id: string | null;
  business_journal_lines: JournalLineView[];
};
type JournalDraftLine = { account_id: string; debit: string; credit: string; description: string };
type Modal =
  | "invoice"
  | "product"
  | "party"
  | "purchase"
  | "expense"
  | "payment"
  | "purchase_payment"
  | "stock"
  | null;

const nav: { name: Section; icon: typeof Home }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Invoices", icon: FileText },
  { name: "Products", icon: Package },
  { name: "Customers", icon: Users },
  { name: "Purchases", icon: ShoppingCart },
  { name: "Expenses", icon: Wallet },
  { name: "Journal", icon: BookOpen },
  { name: "GST reports", icon: FileBarChart2 },
  { name: "Team", icon: Users },
  { name: "Audit history", icon: Activity },
  { name: "Settings", icon: Settings },
];
const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => dateKey(new Date());
function periodBounds(
  preset: DatePreset,
  from: string,
  to: string,
  referenceDate: string,
) {
  const reference = new Date(`${referenceDate}T00:00:00`);
  const end = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const start = new Date(end);
  if (preset === "yesterday") start.setDate(start.getDate() - 1);
  else if (preset === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
  } else if (preset === "month") start.setDate(1);
  else if (preset === "quarter") {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  } else if (preset === "year") {
    start.setMonth(3, 1);
    if (end.getMonth() < 3) start.setFullYear(start.getFullYear() - 1);
  } else if (preset === "all") return { from: "0001-01-01", to: dateKey(end) };
  else if (preset === "custom")
    return { from: from || dateKey(end), to: to || from || dateKey(end) };
  return {
    from: dateKey(start),
    to: dateKey(preset === "yesterday" ? start : end),
  };
}
const fieldClass =
  "h-10 rounded-xl border-slate-200 bg-white text-sm shadow-none focus-visible:ring-emerald-700/20";
const selectClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessMemberships, setBusinessMemberships] = useState<
    WorkspaceOption[]
  >([]);
  const [memberRole, setMemberRole] = useState<MemberRole>("owner");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [businessInvitations, setBusinessInvitations] = useState<
    BusinessInvitation[]
  >([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [accountingPeriods, setAccountingPeriods] = useState<
    AccountingPeriod[]
  >([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalanceBatch[]>([]);
  const [gstRegistrations, setGstRegistrations] = useState<GstRegistration[]>([]);
  const [section, setSection] = useState<Section>("Dashboard");
  const [modal, setModal] = useState<Modal>(null);
  const [settingsDialog, setSettingsDialog] = useState<
    "profile" | "gst" | "financial-year" | "opening-balances" | null
  >(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [listProducts, setListProducts] = useState<Product[]>([]);
  const [listParties, setListParties] = useState<Party[]>([]);
  const [listInvoices, setListInvoices] = useState<Invoice[]>([]);
  const [listPurchases, setListPurchases] = useState<Purchase[]>([]);
  const [listExpenses, setListExpenses] = useState<Expense[]>([]);
  const [listJournalEntries, setListJournalEntries] = useState<JournalEntry[]>([]);
  const [listAuditEvents, setListAuditEvents] = useState<AuditEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dashboardToday, setDashboardToday] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showAuth, setShowAuth] = useState(false);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(0);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [journalDialog, setJournalDialog] = useState<"entry" | "reverse" | null>(null);
  const [journalDraftLines, setJournalDraftLines] = useState<JournalDraftLine[]>([
    { account_id: "", debit: "0", credit: "0", description: "" },
    { account_id: "", debit: "0", credit: "0", description: "" },
  ]);
  const [journalToReverse, setJournalToReverse] = useState<JournalEntry | null>(null);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const [journalRefresh, setJournalRefresh] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(
    null,
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const idempotencyKeys = useRef(new WeakMap<HTMLFormElement, string>());
  const invitationAccepts = useRef(
    new Map<
      string,
      Promise<{ businessId: string | null; error: string | null }>
    >(),
  );
  const requestKey = (form: HTMLFormElement) => {
    const existing = idempotencyKeys.current.get(form);
    if (existing) return existing;
    const key = crypto.randomUUID();
    idempotencyKeys.current.set(form, key);
    return key;
  };
  const clearRequestKey = (form: HTMLFormElement) =>
    idempotencyKeys.current.delete(form);

  useEffect(() => {
    if (!business || !["Invoices", "Products", "Customers", "Purchases", "Expenses", "Journal", "Audit history"].includes(section)) return;
    if (section === "Journal" && !["owner", "admin", "accountant"].includes(memberRole)) {
      setListJournalEntries([]);
      setListTotal(0);
      setListLoading(false);
      return;
    }
    if (section === "Audit history" && !["owner", "admin", "accountant"].includes(memberRole)) {
      setListAuditEvents([]);
      setListTotal(0);
      setListLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setListLoading(true);
      const pageSize = 50;
      const from = listPage * pageSize;
      const to = from + pageSize - 1;
      const term = search.trim();
      // Prefix searches can use tenant/name and tenant/document-number indexes.
      const pattern = `${term.replace(/[^a-zA-Z0-9\s/-]/g, " ")}%`;
      try {
        let result: { data: unknown[] | null; count: number | null; error: { message: string } | null };
        if (section === "Invoices") {
          result = await supabase.from("invoices").select("*, parties:parties!invoices_party_business_fk(name), invoice_lines(description,quantity,unit_price,gst_rate,taxable_value,tax_amount,line_total)", { count: "exact" }).eq("business_id", business.id).ilike("invoice_number", pattern).order("invoice_date", { ascending: false }).order("id").range(from, to) as typeof result;
          if (active && !result.error) setListInvoices((result.data || []) as Invoice[]);
        } else if (section === "Products") {
          result = await supabase.from("products").select("*", { count: "exact" }).eq("business_id", business.id).ilike("name", pattern).order("name").order("id").range(from, to) as typeof result;
          if (active && !result.error) setListProducts((result.data || []) as Product[]);
        } else if (section === "Customers") {
          result = await supabase.from("parties").select("*", { count: "exact" }).eq("business_id", business.id).ilike("name", pattern).order("name").order("id").range(from, to) as typeof result;
          if (active && !result.error) setListParties((result.data || []) as Party[]);
        } else if (section === "Purchases") {
          result = await supabase.from("purchases").select("*, parties:parties!purchases_party_business_fk(name)", { count: "exact" }).eq("business_id", business.id).ilike("bill_number", pattern).order("bill_date", { ascending: false }).order("id").range(from, to) as typeof result;
          if (active && !result.error) setListPurchases((result.data || []) as Purchase[]);
        } else if (section === "Expenses") {
          result = await supabase.from("expenses").select("*", { count: "exact" }).eq("business_id", business.id).ilike("description", pattern).order("expense_date", { ascending: false }).order("id").range(from, to) as typeof result;
          if (active && !result.error) setListExpenses((result.data || []) as Expense[]);
        } else if (section === "Journal") {
          result = await supabase.from("business_journal_entries").select("id,journal_number,entry_date,description,source_type,status,reversal_of_entry_id,reversed_by_entry_id,business_journal_lines(line_number,description,debit,credit,business_chart_of_accounts(account_code,account_name))", { count: "exact" }).eq("business_id", business.id).or(`journal_number.ilike.${pattern},description.ilike.${pattern}`).order("entry_date", { ascending: false }).order("journal_number", { ascending: false }).order("id").range(from, to) as typeof result;
          if (active && !result.error) setListJournalEntries((result.data || []) as JournalEntry[]);
        } else {
          result = await supabase.from("audit_events").select("id,operation,table_name,entity_key,occurred_at,actor_user_id", { count: "exact" }).eq("business_id", business.id).ilike("table_name", pattern).order("occurred_at", { ascending: false }).order("id").range(from, to) as typeof result;
          if (active && !result.error) setListAuditEvents((result.data || []) as AuditEvent[]);
        }
        if (active) {
          if (result.error) {
            setError(result.error.message);
            setNotice("");
          }
          else setListTotal(result.count || 0);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load this page.");
          setNotice("");
        }
      } finally {
        if (active) setListLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [business, journalRefresh, listPage, memberRole, search, section, supabase]);

  useEffect(() => {
    setListPage(0);
  }, [business?.id, search, section]);

  const notify = (message: string) => {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3600);
  };
  const fail = (message: string) => {
    setError(message);
    setNotice("");
  };

  const loadData = useCallback(
    async (businessId: string) => {
      const [p, c, i, pu, ex, pay] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("business_id", businessId)
          .order("name"),
        supabase
          .from("parties")
          .select("*")
          .eq("business_id", businessId)
          .order("name"),
        supabase
          .from("invoices")
          .select(
            "*, parties:parties!invoices_party_business_fk(name), invoice_lines(description,quantity,unit_price,gst_rate,taxable_value,tax_amount,line_total)",
          )
          .eq("business_id", businessId)
          .order("invoice_date", { ascending: false })
          .limit(1000),
        supabase
          .from("purchases")
          .select("*, parties:parties!purchases_party_business_fk(name)")
          .eq("business_id", businessId)
          .order("bill_date", { ascending: false })
          .limit(1000),
        supabase
          .from("expenses")
          .select("*")
          .eq("business_id", businessId)
          .order("expense_date", { ascending: false })
          .limit(1000),
        supabase
          .from("payments")
          .select(
            "id,payment_date,amount,method,invoice_id,purchase_id,party_id",
          )
          .eq("business_id", businessId)
          .order("payment_date", { ascending: false })
          .limit(1000),
      ]);
      if (p.error || c.error || i.error || pu.error || ex.error || pay.error)
        throw new Error(
          p.error?.message ||
            c.error?.message ||
            i.error?.message ||
            pu.error?.message ||
            ex.error?.message ||
            pay.error?.message,
        );
      setProducts((p.data || []) as Product[]);
      setParties((c.data || []) as Party[]);
      setInvoices((i.data || []) as Invoice[]);
      setPurchases((pu.data || []) as Purchase[]);
      setExpenses((ex.data || []) as Expense[]);
      setPayments((pay.data || []) as Payment[]);
    },
    [supabase],
  );

  const loadWorkspace = useCallback(
    async (userId: string, preferredBusinessId?: string | null) => {
      setLoading(true);
      const { data: memberships, error: membershipError } = await supabase
        .from("business_members")
        .select("business_id,role,created_at")
        .eq("user_id", userId)
        .order("created_at");
      if (membershipError) {
        fail(membershipError.message);
        setLoading(false);
        return;
      }
      if (!memberships?.length) {
        setBusinessMemberships([]);
        setBusiness(null);
        setMemberRole("owner");
        setLoading(false);
        return;
      }
      const { data: companies, error: companiesError } = await supabase
        .from("businesses")
        .select("id,name")
        .in(
          "id",
          memberships.map((m) => m.business_id),
        );
      if (companiesError) {
        fail(companiesError.message);
        setLoading(false);
        return;
      }
      const options = memberships.flatMap((membership) => {
        const company = companies?.find(
          (item) => item.id === membership.business_id,
        );
        return company
          ? [
              {
                id: company.id,
                name: company.name,
                role: membership.role as MemberRole,
              },
            ]
          : [];
      });
      setBusinessMemberships(options);
      const membership =
        memberships.find((item) => item.business_id === preferredBusinessId) ||
        memberships[0];
      setMemberRole(membership.role as MemberRole);
      const { data: company, error: companyError } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", membership.business_id)
        .single();
      if (companyError) {
        fail(companyError.message);
        setLoading(false);
        return;
      }
      setBusiness(company as Business);
      try {
        await loadData(company.id);
      } catch (e) {
        fail(e instanceof Error ? e.message : "Could not load your workspace.");
      }
      setLoading(false);
    },
    [loadData, supabase],
  );

  const openWorkspaceForUser = useCallback(
    async (userId: string) => {
      const invitationId = new URLSearchParams(window.location.search).get(
        "invitation_id",
      );
      let preferredBusinessId: string | null = null;
      if (invitationId) {
        let attempt = invitationAccepts.current.get(invitationId);
        if (!attempt) {
          attempt = supabase
            .rpc("accept_business_invitation", {
              p_invitation_id: invitationId,
            })
            .then(({ data, error: invitationError }) => {
              if (data)
                window.history.replaceState({}, "", window.location.pathname);
              return {
                businessId: data || null,
                error: invitationError?.message || null,
              };
            });
          invitationAccepts.current.set(invitationId, attempt);
        }
        const accepted = await attempt;
        if (accepted.error || !accepted.businessId) {
          fail(accepted.error || "Could not accept this invitation.");
          return;
        }
        preferredBusinessId = accepted.businessId;
        notify("Invitation accepted. Your business access is ready.");
      }
      await loadWorkspace(userId, preferredBusinessId);
    },
    [loadWorkspace, supabase],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const currentDate = today();
      setDashboardToday(currentDate);
      setCustomFrom(currentDate);
      setCustomTo(currentDate);
      setSession(data.session);
      setReady(true);
      if (data.session?.user) void openWorkspaceForUser(data.session.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) void openWorkspaceForUser(newSession.user.id);
      else {
        setBusiness(null);
        setBusinessMemberships([]);
        setProducts([]);
        setParties([]);
        setInvoices([]);
        setPurchases([]);
        setExpenses([]);
        setPayments([]);
        setTeamMembers([]);
        setBusinessInvitations([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [openWorkspaceForUser, supabase]);

  const loadTeam = useCallback(async () => {
    if (!business) return;
    setTeamLoading(true);
    const canManage = ["owner", "admin"].includes(memberRole);
    const [members, invitations] = await Promise.all([
      supabase.rpc("get_business_members", { p_business_id: business.id }),
      canManage
        ? supabase
            .from("business_invitations")
            .select("id,email,role,status,expires_at,created_at")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (members.error || invitations.error)
      fail(members.error?.message || invitations.error?.message || "Could not load team access.");
    else {
      setTeamMembers((members.data || []) as TeamMember[]);
      setBusinessInvitations((invitations.data || []) as BusinessInvitation[]);
    }
    setTeamLoading(false);
  }, [business, memberRole, supabase]);
  useEffect(() => {
    if (section === "Team") void loadTeam();
  }, [section, loadTeam]);

  const loadAccountingSetup = useCallback(async () => {
    if (!business) return;
    const [years, periods, accounts] = await Promise.all([
      supabase
        .from("business_financial_years")
        .select("id,name,start_date,end_date,status,is_current")
        .eq("business_id", business.id)
        .order("start_date", { ascending: false }),
      supabase
        .from("business_accounting_periods")
        .select("id,period_start,period_end,status")
        .eq("business_id", business.id)
        .order("period_start", { ascending: false }),
      supabase
        .from("business_chart_of_accounts")
        .select("id,account_code,account_name,account_type,is_active")
        .eq("business_id", business.id)
        .order("account_code"),
    ]);
    if (years.error || periods.error || accounts.error) {
      fail(
        years.error?.message ||
          periods.error?.message ||
          accounts.error?.message ||
          "Could not load accounting setup.",
      );
      return;
    }
    setFinancialYears((years.data || []) as FinancialYear[]);
    setAccountingPeriods((periods.data || []) as AccountingPeriod[]);
    setChartAccounts((accounts.data || []) as ChartAccount[]);
    const { data: gstRows, error: gstError } = await supabase
      .from("business_gst_registrations")
      .select("id,gstin,state_code,registration_type,legal_name,trade_name,effective_from,effective_to,return_frequency,is_primary,is_active")
      .eq("business_id", business.id)
      .order("is_primary", { ascending: false })
      .order("gstin");
    if (gstError) { fail(gstError.message); return; }
    setGstRegistrations((gstRows || []) as GstRegistration[]);
    if (["owner", "admin", "accountant"].includes(memberRole)) {
      const { data: balances, error: balanceError } = await supabase
        .from("business_opening_balances")
        .select("id,financial_year_id,status,effective_date,posted_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });
      if (balanceError) {
        fail(balanceError.message);
        return;
      }
      setOpeningBalances((balances || []) as OpeningBalanceBatch[]);
    } else setOpeningBalances([]);
  }, [business, memberRole, supabase]);
  useEffect(() => {
    if (section === "Settings" || section === "Journal") void loadAccountingSetup();
  }, [section, loadAccountingSetup]);

  async function createFinancialYear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    const { error: yearError } = await supabase
      .from("business_financial_years")
      .insert({
        business_id: business.id,
        name: String(values.get("year_name")),
        start_date: String(values.get("start_date")),
        end_date: String(values.get("end_date")),
        is_current: financialYears.length === 0,
      });
    if (yearError) {
      fail(yearError.message);
      return;
    }
    form.reset();
    setSettingsDialog(null);
    notify("Financial year created with open monthly accounting periods.");
    await loadAccountingSetup();
  }

  async function saveOpeningBalance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    const lines = [...values.entries()]
      .filter(([key]) => key.startsWith("account_"))
      .map(([key, accountId]) => {
        const index = key.slice("account_".length);
        return {
          account_id: String(accountId),
          debit: Number(values.get(`debit_${index}`) || 0),
          credit: Number(values.get(`credit_${index}`) || 0),
        };
      })
      .filter((line) => line.account_id && (line.debit > 0 || line.credit > 0));
    const { error: balanceError } = await supabase.rpc("save_opening_balance", {
      p_business_id: business.id,
      p_financial_year_id: String(values.get("financial_year") || ""),
      p_effective_date: String(values.get("effective_date") || ""),
      p_lines: lines,
      p_idempotency_key: requestKey(form),
    });
    if (balanceError) {
      fail(balanceError.message);
      return;
    }
    form.reset();
    setSettingsDialog(null);
    notify("Opening balance posted after the database confirmed it balances.");
    await loadAccountingSetup();
  }

  async function toggleAccountingPeriodLock(period: AccountingPeriod) {
    const { error: periodError } = await supabase.rpc(
      "set_accounting_period_lock",
      { p_id: period.id, p_lock: period.status === "open" },
    );
    if (periodError) {
      fail(periodError.message);
      return;
    }
    notify(
      period.status === "open"
        ? "Accounting period locked."
        : "Accounting period unlocked.",
    );
    await loadAccountingSetup();
  }

  async function saveGstRegistration(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    const { error: gstError } = await supabase.from("business_gst_registrations").insert({
      business_id: business.id,
      gstin: String(values.get("gstin") || "").trim().toUpperCase(),
      state_code: String(values.get("gst_state") || "").trim(),
      registration_type: String(values.get("registration_type") || "regular"),
      legal_name: String(values.get("legal_name") || "").trim() || null,
      trade_name: String(values.get("trade_name") || "").trim() || null,
      return_frequency: String(values.get("return_frequency") || "monthly"),
      effective_from: String(values.get("effective_from") || "") || null,
      is_primary: gstRegistrations.length === 0,
    });
    if (gstError) { fail(gstError.message); return; }
    form.reset();
    setSettingsDialog(null);
    notify("GST registration added.");
    await loadAccountingSetup();
  }

  async function setPrimaryGstRegistration(registration: GstRegistration) {
    const { error: primaryError } = await supabase.rpc("set_primary_gst_registration", { p_registration_id: registration.id });
    if (primaryError) { fail(primaryError.message); return; }
    notify("Primary GST registration updated.");
    await loadAccountingSetup();
  }

  async function inviteMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    setInviteSending(true);
    try {
      const { error: inviteError } = await supabase.functions.invoke(
        "invite-business-member",
        {
          body: {
            business_id: business.id,
            email: String(values.get("email") || "").trim(),
            role: String(values.get("role") || "accountant"),
          },
        },
      );
      if (inviteError) {
        fail(inviteError.message);
        return;
      }
      form.reset();
      setInviteOpen(false);
      notify("Invitation email sent.");
      await loadTeam();
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "Could not send the invitation.");
    } finally {
      setInviteSending(false);
    }
  }

  async function changeMemberRole(member: TeamMember, nextRole: MemberRole) {
    if (!business) return;
    const { error: roleError } = await supabase
      .from("business_members")
      .update({ role: nextRole })
      .eq("business_id", business.id)
      .eq("user_id", member.user_id);
    if (roleError) {
      fail(roleError.message);
      return;
    }
    notify("Team role updated.");
    await loadTeam();
  }

  async function removeMember(member: TeamMember) {
    if (
      !business ||
      !window.confirm(
        "Remove this person from the business? They will lose access immediately.",
      )
    )
      return;
    const { error: removeError } = await supabase
      .from("business_members")
      .delete()
      .eq("business_id", business.id)
      .eq("user_id", member.user_id);
    if (removeError) {
      fail(removeError.message);
      return;
    }
    notify("Member access removed.");
    await loadTeam();
  }

  async function revokeInvitation(invitation: BusinessInvitation) {
    const { error: revokeError } = await supabase.rpc(
      "revoke_business_invitation",
      { p_invitation_id: invitation.id },
    );
    if (revokeError) {
      fail(revokeError.message);
      return;
    }
    notify("Invitation revoked.");
    await loadTeam();
  }

  const refresh = async () => {
    if (business) await loadData(business.id);
  };
  const period = periodBounds(
    datePreset,
    customFrom,
    customTo,
    dashboardToday || "2000-01-01",
  );
  const inRange = (date: string | null | undefined) =>
    Boolean(date && date >= period.from && date <= period.to);
  const periodInvoices = invoices.filter(
    (x) => inRange(x.invoice_date) && x.status !== "cancelled",
  );
  const periodPayments = payments.filter(
    (x) => inRange(x.payment_date) && x.invoice_id,
  );
  const totalSales = periodInvoices.reduce(
    (a, x) => a + Number(x.grand_total),
    0,
  );
  const collected = periodPayments.reduce((a, x) => a + Number(x.amount), 0);
  const outstandingInvoices = invoices.filter(
    (x) =>
      !["paid", "cancelled"].includes(x.status) &&
      Number(x.grand_total) > Number(x.amount_paid),
  );
  const outstanding = outstandingInvoices.reduce(
    (a, x) => a + Math.max(0, Number(x.grand_total) - Number(x.amount_paid)),
    0,
  );
  const taxCollected = periodInvoices.reduce(
    (a, x) => a + Number(x.tax_total),
    0,
  );
  const periodPurchases = purchases.filter(
    (x) => inRange(x.bill_date) && x.status !== "cancelled",
  );
  const periodExpenses = expenses.filter((x) => inRange(x.expense_date));
  const filteredProducts = listProducts;
  const filteredParties = listParties;
  const filteredInvoices = listInvoices;

  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result =
        authMode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        fail(result.error.message);
        return;
      }
      if (authMode === "signup" && !result.data.session)
        notify("Check your email to confirm your account, then sign in.");
      else notify("Signed in successfully.");
    } catch (e) {
      fail(
        e instanceof Error
          ? `Could not reach Supabase: ${e.message}`
          : "Could not reach Supabase. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("create_business", {
      p_name: String(f.get("name")),
      p_gstin: String(f.get("gstin") || ""),
      p_state_code: String(f.get("state") || ""),
    });
    setLoading(false);
    if (rpcError) {
      fail(rpcError.message);
      return;
    }
    notify("Business workspace is ready.");
    if (session?.user) await loadWorkspace(session.user.id);
  }

  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const f = new FormData(e.currentTarget);
    const values = {
      name: String(f.get("name")),
      sku: String(f.get("sku") || "") || null,
      hsn_sac: String(f.get("hsn") || "") || null,
      unit: String(f.get("unit") || "pcs"),
      sale_price: Number(f.get("price") || 0),
      purchase_price: Number(f.get("purchase_price") || 0),
      gst_rate: Number(f.get("gst") || 0),
      track_stock: f.get("track_stock") === "on",
    };
    const result = editingProduct
      ? await supabase
          .from("products")
          .update(values)
          .eq("id", editingProduct.id)
          .eq("business_id", business.id)
      : await supabase
          .from("products")
          .insert({
            ...values,
            business_id: business.id,
            stock_on_hand: Number(f.get("stock") || 0),
          });
    if (result.error) {
      fail(result.error.message);
      return;
    }
    setModal(null);
    setEditingProduct(null);
    notify(editingProduct ? "Product updated." : "Product added to catalog.");
    await refresh();
  }

  async function saveParty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const f = new FormData(e.currentTarget);
    const values = {
      name: String(f.get("name")),
      kind: String(f.get("kind")),
      gstin: String(f.get("gstin") || "") || null,
      phone: String(f.get("phone") || "") || null,
      email: String(f.get("email") || "") || null,
      address: String(f.get("address") || "") || null,
      state_code: String(f.get("state") || "") || null,
    };
    const result = editingParty
      ? await supabase
          .from("parties")
          .update(values)
          .eq("id", editingParty.id)
          .eq("business_id", business.id)
      : await supabase
          .from("parties")
          .insert({ ...values, business_id: business.id });
    if (result.error) {
      fail(result.error.message);
      return;
    }
    setModal(null);
    setEditingParty(null);
    notify(editingParty ? "Contact updated." : "Contact added.");
    await refresh();
  }

  async function saveInvoice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const f = new FormData(e.currentTarget);
    const selectedRows = [...f.entries()]
      .filter(([key]) => key.startsWith("product_"))
      .map(([key, value]) => {
        const n = key.split("_")[1];
        return {
          product_id: String(value),
          quantity: Number(f.get(`qty_${n}`) || 0),
          unit_price: Number(f.get(`price_${n}`) || 0),
          discount_percent: Number(f.get(`discount_${n}`) || 0),
        };
      })
      .filter((r) => r.product_id && r.quantity > 0);
    if (!selectedRows.length) {
      fail("Add at least one product and quantity.");
      return;
    }
    const party = String(f.get("party") || "");
    const { error: rpcError } = await supabase.rpc("create_sales_invoice", {
      p_business_id: business.id,
      p_party_id: party || null,
      p_invoice_date: String(f.get("date") || today()),
      p_due_date: String(f.get("due") || "") || null,
      p_notes: String(f.get("notes") || "") || null,
      p_items: selectedRows,
      p_idempotency_key: requestKey(e.currentTarget),
    });
    if (rpcError) {
      fail(rpcError.message);
      return;
    }
    setModal(null);
    notify("Invoice issued and stock updated.");
    await refresh();
  }

  async function savePurchase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const f = new FormData(e.currentTarget);
    const selectedRows = [...f.entries()]
      .filter(([key]) => key.startsWith("product_"))
      .map(([key, value]) => {
        const n = key.split("_")[1];
        return {
          product_id: String(value),
          quantity: Number(f.get(`qty_${n}`) || 0),
          unit_price: Number(f.get(`price_${n}`) || 0),
        };
      })
      .filter((r) => r.product_id && r.quantity > 0);
    if (!selectedRows.length) {
      fail("Add at least one product and quantity.");
      return;
    }
    const party = String(f.get("party") || "");
    const { error: rpcError } = await supabase.rpc("create_purchase", {
      p_business_id: business.id,
      p_party_id: party || null,
      p_supplier_invoice_number:
        String(f.get("supplier_invoice") || "") || null,
      p_bill_date: String(f.get("date") || today()),
      p_items: selectedRows,
      p_idempotency_key: requestKey(e.currentTarget),
    });
    if (rpcError) {
      fail(rpcError.message);
      return;
    }
    setModal(null);
    notify("Purchase recorded and stock updated.");
    await refresh();
  }

  async function saveStockAdjustment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business || !adjustmentProduct) return;
    const f = new FormData(e.currentTarget);
    const { error: rpcError } = await supabase.rpc("adjust_inventory", {
      p_business_id: business.id,
      p_product_id: adjustmentProduct.id,
      p_quantity_delta: Number(f.get("delta") || 0),
      p_note: String(f.get("note") || "") || null,
      p_idempotency_key: requestKey(e.currentTarget),
    });
    if (rpcError) {
      fail(rpcError.message);
      return;
    }
    setModal(null);
    setAdjustmentProduct(null);
    notify("Stock adjustment saved to the movement history.");
    await refresh();
  }

  async function saveExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const f = new FormData(e.currentTarget);
    const { error: e1 } = await supabase.rpc("create_expense", {
      p_business_id: business.id,
      p_description: String(f.get("description")),
      p_category: String(f.get("category") || "General"),
      p_amount: Number(f.get("amount") || 0),
      p_gst_amount: Number(f.get("gst") || 0),
      p_expense_date: String(f.get("date") || today()),
      p_payment_method: String(f.get("method") || "cash"),
      p_idempotency_key: requestKey(e.currentTarget),
    });
    if (e1) {
      fail(e1.message);
      return;
    }
    setModal(null);
    notify("Expense saved.");
    await refresh();
  }

  async function savePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business || !paymentInvoice) return;
    const f = new FormData(e.currentTarget);
    const { error: rpcError } = await supabase.rpc("record_payment", {
      p_business_id: business.id,
      p_invoice_id: paymentInvoice.id,
      p_amount: Number(f.get("amount") || 0),
      p_method: String(f.get("method") || "cash"),
      p_date: String(f.get("date") || today()),
      p_idempotency_key: requestKey(e.currentTarget),
    });
    if (rpcError) {
      fail(rpcError.message);
      return;
    }
    setModal(null);
    setPaymentInvoice(null);
    notify("Payment recorded.");
    await refresh();
  }

  async function savePurchasePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business || !paymentPurchase) return;
    const f = new FormData(e.currentTarget);
    const { error: rpcError } = await supabase.rpc("record_purchase_payment", {
      p_business_id: business.id,
      p_purchase_id: paymentPurchase.id,
      p_amount: Number(f.get("amount") || 0),
      p_method: String(f.get("method") || "cash"),
      p_date: String(f.get("date") || today()),
      p_idempotency_key: requestKey(e.currentTarget),
    });
    if (rpcError) {
      fail(rpcError.message);
      return;
    }
    setModal(null);
    setPaymentPurchase(null);
    notify("Supplier payment recorded.");
    await refresh();
  }

  async function createJournalEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    const lines = journalDraftLines.map((line, index) => ({
      line_number: index + 1,
      account_id: line.account_id,
      debit: Number(values.get(`debit_${index}`) || 0),
      credit: Number(values.get(`credit_${index}`) || 0),
      description: String(values.get(`line_description_${index}`) || "").trim() || null,
    }));
    if (lines.length < 2 || lines.some((line) => !line.account_id || (line.debit > 0) === (line.credit > 0))) {
      fail("Choose an account and enter either a debit or a credit on every line.");
      return;
    }
    const { error: journalError } = await supabase.rpc("post_journal_entry", {
      p_business_id: business.id,
      p_entry_date: String(values.get("entry_date") || ""),
      p_description: String(values.get("description") || "").trim(),
      p_lines: lines,
      p_idempotency_key: requestKey(form),
    });
    if (journalError) { fail(journalError.message); return; }
    clearRequestKey(form);
    setJournalDialog(null);
    setJournalDraftLines([
      { account_id: "", debit: "0", credit: "0", description: "" },
      { account_id: "", debit: "0", credit: "0", description: "" },
    ]);
    notify("Journal entry posted and balanced.");
    setJournalRefresh((value) => value + 1);
  }

  async function reverseJournalEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!journalToReverse) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    const { error: reversalError } = await supabase.rpc("reverse_journal_entry", {
      p_journal_entry_id: journalToReverse.id,
      p_reversal_date: String(values.get("reversal_date") || ""),
      p_reason: String(values.get("reason") || "").trim(),
      p_idempotency_key: requestKey(form),
    });
    if (reversalError) { fail(reversalError.message); return; }
    clearRequestKey(form);
    setJournalDialog(null);
    setJournalToReverse(null);
    notify("A linked reversing journal was posted.");
    setJournalRefresh((value) => value + 1);
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!business) return;
    const f = new FormData(e.currentTarget);
    const { error: e1 } = await supabase
      .from("businesses")
      .update({
        name: String(f.get("name")),
        gstin: String(f.get("gstin") || "") || null,
        state_code: String(f.get("state") || "") || null,
        phone: String(f.get("phone") || "") || null,
        email: String(f.get("email") || "") || null,
        address: String(f.get("address") || "") || null,
      })
      .eq("id", business.id);
    if (e1) {
      fail(e1.message);
      return;
    }
    notify("Business details updated.");
    setSettingsDialog(null);
    if (session?.user) await loadWorkspace(session.user.id);
  }

  function exportCsv(rows: Record<string, unknown>[], file: string) {
    if (!rows.length) {
      notify("There is nothing to export yet.");
      return;
    }
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = file;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printInvoice(invoice: Invoice) {
    const safe = (text: string) =>
      text.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c] || c,
      );
    const rows = (invoice.invoice_lines || [])
      .map(
        (line) =>
          `<tr><td>${safe(line.description)}</td><td>${line.quantity}</td><td>${money(line.unit_price)}</td><td>${line.gst_rate}%</td><td>${money(line.line_total)}</td></tr>`,
      )
      .join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      fail("Allow pop-ups to print invoices.");
      return;
    }
    w.document.write(
      `<html><head><title>${safe(invoice.invoice_number)}</title><style>body{font:14px Arial;margin:40px;color:#12261e}h1{font-size:26px}.top{display:flex;justify-content:space-between}table{width:100%;border-collapse:collapse;margin:28px 0}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.total{text-align:right;font-size:22px;font-weight:bold}</style></head><body><div class="top"><div><h1>${safe(invoice.seller_name || business?.name || "Business")}</h1><p>${safe(invoice.seller_address || business?.address || "")}</p><p>GSTIN: ${safe(invoice.seller_gstin || business?.gstin || "Not provided")}</p></div><div><h2>TAX INVOICE</h2><p>${safe(invoice.invoice_number)} · ${invoice.invoice_date}</p><p>Bill to: ${safe(invoice.party_name || invoice.parties?.name || "Walk-in customer")}</p><p>Customer GSTIN: ${safe(invoice.party_gstin || "Not provided")}</p><p>${safe(invoice.party_address || "")}</p></div></div><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p>Taxable value: ${money(invoice.subtotal)} · GST: ${money(invoice.tax_total)}</p><p class="total">Total: ${money(invoice.grand_total)}</p><script>window.print()</script></body></html>`,
    );
    w.document.close();
  }

  if (!ready || (loading && !business))
    return (
      <div className="screen-center">
        <div className="spinner" />
        <span>Opening your workspace…</span>
      </div>
    );
  if (!session)
    return showAuth ? (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        onSubmit={submitAuth}
        loading={loading}
        error={error}
        notice={notice}
        onBack={() => {
          setError("");
          setShowAuth(false);
        }}
      />
    ) : (
      <LandingPage
        onSignup={() => {
          setAuthMode("signup");
          setError("");
          setShowAuth(true);
        }}
        onSignin={() => {
          setAuthMode("signin");
          setError("");
          setShowAuth(true);
        }}
      />
    );
  if (!business)
    return (
      <SetupScreen
        onSubmit={createBusiness}
        loading={loading}
        error={error}
        onSignOut={() => void supabase.auth.signOut()}
      />
    );

  const pageTitle: Record<Section, string> = {
    Dashboard: "Good morning",
    Invoices: "Sales invoices",
    Products: "Product catalogue",
    Customers: "Customers & suppliers",
    Purchases: "Purchase bills",
    Expenses: "Expenses",
    Journal: "Journal vouchers",
    "GST reports": "GST & business reports",
    Team: "Team access",
    "Audit history": "Audit history",
    Settings: "Business settings",
  };
  const openAction = (m: Modal) => {
    setError("");
    if (m === "product") setEditingProduct(null);
    if (m === "party") setEditingParty(null);
    setModal(m);
  };
  const lowStock = products.filter(
    (x) => x.track_stock && Number(x.stock_on_hand) < 10,
  ).length;
  const overdueInvoices = outstandingInvoices
    .filter((x) => x.due_date && dashboardToday && x.due_date < dashboardToday)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  const customerBalances = Object.values(
    outstandingInvoices.reduce<
      Record<string, { name: string; count: number; amount: number }>
    >((groups, invoice) => {
      const key = invoice.party_id || invoice.party_name || invoice.id;
      const row =
        groups[key] ||
        (groups[key] = {
          name:
            invoice.party_name || invoice.parties?.name || "Walk-in customer",
          count: 0,
          amount: 0,
        });
      row.count += 1;
      row.amount += Math.max(
        0,
        Number(invoice.grand_total) - Number(invoice.amount_paid),
      );
      return groups;
    }, {}),
  )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const periodLabel =
    datePreset === "today"
      ? "Today"
      : datePreset === "yesterday"
        ? "Yesterday"
        : datePreset === "week"
          ? "This week"
          : datePreset === "month"
            ? "This month"
            : datePreset === "quarter"
              ? "This quarter"
              : datePreset === "year"
                ? "This financial year"
                : datePreset === "all"
                  ? "All time"
                  : `${period.from} – ${period.to}`;
  const journalDebitTotal = journalDraftLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const journalCreditTotal = journalDraftLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const journalDraftBalanced = journalDraftLines.length >= 2 && journalDebitTotal > 0 && journalDebitTotal === journalCreditTotal;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Boxes size={19} />
          </div>
          <span>
            ledger<span className="brand-light">wise</span>
          </span>
          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-chip">
          <div className="workspace-avatar">
            {business.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="workspace-copy">
            <strong>{business.name}</strong>
            <span>
              {business.gstin
                ? `GSTIN · ${business.gstin}`
                : "Business workspace"}
            </span>
            {businessMemberships.length > 1 && (
              <select
                className="workspace-switch"
                value={business.id}
                aria-label="Switch business"
                onChange={(event) =>
                  void loadWorkspace(session.user.id, event.target.value)
                }
              >
                {businessMemberships.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {workspace.role.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.filter(({ name }) => name !== "Journal" || ["owner", "admin", "accountant"].includes(memberRole)).map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${section === name ? "nav-active" : ""}`}
              onClick={() => {
                setSection(name);
                setSearch("");
                setMobileMenu(false);
              }}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{name}</span>
              {name === "Invoices" && invoices.length > 0 && (
                <span className="nav-count">{invoices.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">
              <Sparkles size={16} />
            </div>
            <strong>Work together</strong>
            <p>
              Invite teammates and choose what they can do in this business.
            </p>
            <button onClick={() => setSection("Team")}>
              Manage team access <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="help-link"
            onClick={() => notify("Help centre is coming soon.")}
          >
            <CircleHelp size={16} /> Help & support
          </button>
          <button
            className="profile-row"
            onClick={() => void supabase.auth.signOut()}
          >
            <div className="profile-avatar">
              {session.user.email?.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{session.user.email}</strong>
              <span>{memberRole.replace("_", " ")} · Sign out</span>
            </div>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <main className="main-panel">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap">
              <Search size={16} />
              <input
                placeholder="Search anything…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="icon-button"
              onClick={() => notify("You’re all caught up.")}
              aria-label="Notifications"
            >
              <Bell size={17} />
              <i />
            </button>
            <div className="top-avatar">
              {session.user.email?.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {section === "Dashboard" ? (
                  <>
                    <CalendarDays size={13} />{" "}
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </>
                ) : (
                  <>
                    <Building2 size={13} /> {business.name}
                  </>
                )}
              </div>
              <h1>
                {section === "Dashboard" ? (
                  <>
                    Good morning<span className="heading-dot">.</span>
                  </>
                ) : (
                  pageTitle[section]
                )}
              </h1>
              <p>
                {section === "Dashboard"
                  ? "Here’s what’s happening with your business today."
                  : section === "GST reports"
                    ? "A clear view of your sales, tax and inventory."
                    : `Keep your ${section.toLowerCase()} organised and up to date.`}
              </p>
            </div>
            <div className="heading-actions">
              {section === "Dashboard" && (
                <Button
                  variant="outline"
                  className="action-outline"
                  onClick={() =>
                    exportCsv(
                      periodInvoices.map(
                        ({
                          invoice_number,
                          invoice_date,
                          status,
                          subtotal,
                          tax_total,
                          grand_total,
                          amount_paid,
                        }) => ({
                          invoice_number,
                          invoice_date,
                          status,
                          subtotal,
                          tax_total,
                          grand_total,
                          amount_paid,
                        }),
                      ),
                      `sales-${period.from}-to-${period.to}.csv`,
                    )
                  }
                >
                  <ArrowDownLeft size={16} /> Export
                </Button>
              )}
              {section === "Products" && (
                <Button
                  className="action-primary"
                  onClick={() => openAction("product")}
                >
                  <Plus size={16} /> Add product
                </Button>
              )}
              {section === "Customers" && (
                <Button
                  className="action-primary"
                  onClick={() => openAction("party")}
                >
                  <Plus size={16} /> Add contact
                </Button>
              )}
              {section === "Invoices" && (
                <Button
                  className="action-primary"
                  onClick={() => openAction("invoice")}
                >
                  <Plus size={16} /> Create invoice
                </Button>
              )}
              {section === "Purchases" && (
                <Button
                  className="action-primary"
                  onClick={() => openAction("purchase")}
                >
                  <Plus size={16} /> Record purchase
                </Button>
              )}
              {section === "Expenses" && (
                <Button
                  className="action-primary"
                  onClick={() => openAction("expense")}
                >
                  <Plus size={16} /> Add expense
                </Button>
              )}
              {section === "Journal" && ["owner", "admin", "accountant"].includes(memberRole) && (
                <Button className="action-primary" onClick={() => {
                  setJournalDraftLines([
                    { account_id: "", debit: "0", credit: "0", description: "" },
                    { account_id: "", debit: "0", credit: "0", description: "" },
                  ]);
                  setJournalDialog("entry");
                }}>
                  <Plus size={16} /> New journal entry
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-success">
              <Check size={16} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}

          {section === "Dashboard" && (
            <>
              <div className="dashboard-filters">
                <div>
                  <span>Showing</span>
                  <strong>{periodLabel}</strong>
                  <small>
                    {period.from} to {period.to}
                  </small>
                </div>
                <label>
                  <span className="sr-only">Dashboard date range</span>
                  <select
                    className={selectClass}
                    value={datePreset}
                    onChange={(e) =>
                      setDatePreset(e.target.value as DatePreset)
                    }
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="quarter">This quarter</option>
                    <option value="year">This financial year</option>
                    <option value="all">All time</option>
                    <option value="custom">Custom date range</option>
                  </select>
                </label>
                {datePreset === "custom" && (
                  <div className="custom-date-range">
                    <label>
                      From
                      <Input
                        className={fieldClass}
                        type="date"
                        value={customFrom}
                        max={customTo}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      To
                      <Input
                        className={fieldClass}
                        type="date"
                        value={customTo}
                        min={customFrom}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <span className="range-hint">
                  Sales, GST, collections and purchases update for this range.
                  Outstanding balances show what is still unpaid now.
                </span>
              </div>
              <div className="stats-grid">
                <StatCard
                  title="Sales"
                  value={money(totalSales)}
                  note={`${periodInvoices.length} invoices issued`}
                  icon={IndianRupee}
                  tone="green"
                  trend={periodLabel}
                />
                <StatCard
                  title="Payments received"
                  value={money(collected)}
                  note={`${periodPayments.length} customer receipts`}
                  icon={CreditCard}
                  tone="blue"
                  trend={periodLabel}
                />
                <StatCard
                  title="Outstanding now"
                  value={money(outstanding)}
                  note={`${outstandingInvoices.length} unpaid invoices`}
                  icon={Wallet}
                  tone="amber"
                  trend="All open bills"
                />
                <StatCard
                  title="GST on sales"
                  value={money(taxCollected)}
                  note={`${periodInvoices.length} invoices in range`}
                  icon={FileBarChart2}
                  tone="purple"
                  trend={periodLabel}
                />
              </div>
              <div className="dashboard-grid">
                <Card className="surface-card sales-card">
                  <div className="card-heading">
                    <div>
                      <h2>Sales overview</h2>
                      <p>
                        {period.from === period.to
                          ? "Daily invoice value · 7-day context"
                          : datePreset === "all"
                            ? "Invoice value · recent 6 months"
                            : `Invoice value · ${periodLabel.toLowerCase()}`}
                      </p>
                    </div>
                    <span className="period-chip">
                      {periodInvoices.length} invoices
                    </span>
                  </div>
                  <SalesChart
                    invoices={invoices}
                    from={period.from}
                    to={period.to}
                    preset={datePreset}
                  />
                </Card>
                <Card className="surface-card snapshot-card">
                  <div className="card-heading">
                    <div>
                      <h2>Business snapshot</h2>
                      <p>Current operations</p>
                    </div>
                    <Activity size={17} className="muted-icon" />
                  </div>
                  <div className="snapshot-list">
                    <Snapshot
                      icon={Package}
                      label="Active products"
                      value={products.filter((p) => p.active).length.toString()}
                      detail={`${lowStock} running low`}
                      tone="green"
                    />
                    <Snapshot
                      icon={Users}
                      label="Customers & suppliers"
                      value={parties.length.toString()}
                      detail="Contacts in your book"
                      tone="blue"
                    />
                    <Snapshot
                      icon={ShoppingBag}
                      label="Purchases in range"
                      value={money(
                        periodPurchases.reduce(
                          (a, x) => a + Number(x.grand_total),
                          0,
                        ),
                      )}
                      detail={`${periodPurchases.length} bills recorded`}
                      tone="violet"
                    />
                    <Snapshot
                      icon={Wallet}
                      label="Expenses in range"
                      value={money(
                        periodExpenses.reduce(
                          (a, x) => a + Number(x.amount),
                          0,
                        ),
                      )}
                      detail={`${periodExpenses.length} expenses recorded`}
                      tone="amber"
                    />
                  </div>
                  <button
                    className="text-action"
                    onClick={() => setSection("GST reports")}
                  >
                    View business reports <ArrowUpRight size={15} />
                  </button>
                </Card>
              </div>
              <div className="dashboard-grid receivables-grid">
                <Card className="surface-card recent-card">
                  <div className="card-heading">
                    <div>
                      <h2>Unpaid invoices</h2>
                      <p>
                        {overdueInvoices.length} overdue ·{" "}
                        {outstandingInvoices.length} open invoices ·{" "}
                        {money(outstanding)} outstanding
                      </p>
                    </div>
                    <button
                      className="text-action"
                      onClick={() => setSection("Invoices")}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <InvoiceTable
                    items={outstandingInvoices.slice(0, 5)}
                    onPayment={(item) => {
                      setPaymentInvoice(item);
                      openAction("payment");
                    }}
                    onPrint={printInvoice}
                    onCreate={() => openAction("invoice")}
                    todayKey={dashboardToday}
                  />
                </Card>
                <Card className="surface-card debtors-card">
                  <div className="card-heading">
                    <div>
                      <h2>Customers to follow up</h2>
                      <p>Largest unpaid balances</p>
                    </div>
                    <Users size={17} className="muted-icon" />
                  </div>
                  {customerBalances.length ? (
                    <div className="debtor-list">
                      {customerBalances.map((row) => (
                        <div className="debtor-row" key={row.name}>
                          <span className="party-thumb">
                            {row.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{row.name}</strong>
                            <small>
                              {row.count} unpaid{" "}
                              {row.count === 1 ? "invoice" : "invoices"}
                            </small>
                          </div>
                          <b>{money(row.amount)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Check}
                      title="All caught up"
                      description="There are no unpaid customer balances."
                      action="View invoices"
                      onAction={() => setSection("Invoices")}
                    />
                  )}
                  <button
                    className="text-action"
                    onClick={() => setSection("Customers")}
                  >
                    Open customer book <ArrowUpRight size={15} />
                  </button>
                </Card>
              </div>
              <Card className="surface-card recent-card">
                <div className="card-heading">
                  <div>
                    <h2>Invoices in this period</h2>
                    <p>
                      {periodLabel} · {periodInvoices.length} customer
                      transactions
                    </p>
                  </div>
                  <button
                    className="text-action"
                    onClick={() => setSection("Invoices")}
                  >
                    View invoices <ArrowUpRight size={15} />
                  </button>
                </div>
                <InvoiceTable
                  items={periodInvoices.slice(0, 5)}
                  onPayment={(item) => {
                    setPaymentInvoice(item);
                    openAction("payment");
                  }}
                  onPrint={printInvoice}
                  onCreate={() => openAction("invoice")}
                  todayKey={dashboardToday}
                />
              </Card>
              <div className="bottom-grid">
                <Card className="surface-card quick-card">
                  <div className="card-heading">
                    <div>
                      <h2>Quick actions</h2>
                      <p>Get the busy work done faster</p>
                    </div>
                  </div>
                  <div className="quick-actions">
                    <Quick
                      icon={FileText}
                      label="New invoice"
                      onClick={() => openAction("invoice")}
                    />
                    <Quick
                      icon={Package}
                      label="Add product"
                      onClick={() => openAction("product")}
                    />
                    <Quick
                      icon={UserRound}
                      label="Add contact"
                      onClick={() => openAction("party")}
                    />
                    <Quick
                      icon={ShoppingCart}
                      label="Record purchase"
                      onClick={() => openAction("purchase")}
                    />
                  </div>
                </Card>
                <Card className="insight-card">
                  <div className="insight-icon">
                    <Sparkles size={17} />
                  </div>
                  <div>
                    <strong>
                      {overdueInvoices.length
                        ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"} need follow-up`
                        : lowStock
                          ? `${lowStock} product${lowStock === 1 ? "" : "s"} running low`
                          : "Your books are up to date"}
                    </strong>
                    <p>
                      {overdueInvoices.length
                        ? `Follow up on ${money(overdueInvoices.reduce((sum, item) => sum + Math.max(0, Number(item.grand_total) - Number(item.amount_paid)), 0))} overdue from ${new Set(overdueInvoices.map((item) => item.party_id || item.party_name || item.id)).size} customer${new Set(overdueInvoices.map((item) => item.party_id || item.party_name || item.id)).size === 1 ? "" : "s"}.`
                        : lowStock
                          ? "Review stock levels before your next sale."
                          : "No overdue customer invoices or low-stock alerts right now."}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setSection(
                        overdueInvoices.length ? "Invoices" : "Products",
                      )
                    }
                  >
                    {overdueInvoices.length ? "Review dues" : "Review stock"}{" "}
                    <ArrowUpRight size={14} />
                  </button>
                </Card>
              </div>
            </>
          )}

          {section === "Invoices" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="invoices"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() =>
                  exportCsv(
                    filteredInvoices.map(
                      ({
                        invoice_number,
                        invoice_date,
                        status,
                        subtotal,
                        tax_total,
                        grand_total,
                        amount_paid,
                      }) => ({
                        invoice_number,
                        invoice_date,
                        status,
                        subtotal,
                        tax_total,
                        grand_total,
                        amount_paid,
                      }),
                    ),
                    "invoices.csv",
                  )
                }
              />
              <InvoiceTable
                items={filteredInvoices}
                onPayment={(item) => {
                  setPaymentInvoice(item);
                  openAction("payment");
                }}
                onPrint={printInvoice}
                onCreate={() => openAction("invoice")}
                todayKey={dashboardToday}
              />
            </Card>
          )}
          {section === "Products" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="products"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() =>
                  exportCsv(
                    filteredProducts.map(
                      ({
                        name,
                        sku,
                        hsn_sac,
                        sale_price,
                        purchase_price,
                        gst_rate,
                        stock_on_hand,
                        unit,
                      }) => ({
                        name,
                        sku,
                        hsn_sac,
                        sale_price,
                        purchase_price,
                        gst_rate,
                        stock_on_hand,
                        unit,
                      }),
                    ),
                    "products.csv",
                  )
                }
              />
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>SKU / HSN</th>
                      <th>SELLING PRICE</th>
                      <th>GST</th>
                      <th>IN STOCK</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="item-cell">
                            <div className="product-thumb">
                              <Package size={16} />
                            </div>
                            <div>
                              <strong>{p.name}</strong>
                              <span>{p.unit}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mono">{p.sku || "—"}</span>
                          <small className="cell-sub">
                            {p.hsn_sac ? `HSN ${p.hsn_sac}` : "No HSN/SAC"}
                          </small>
                        </td>
                        <td className="amount-cell">{money(p.sale_price)}</td>
                        <td>{p.gst_rate}%</td>
                        <td>
                          <span
                            className={
                              p.track_stock && Number(p.stock_on_hand) < 10
                                ? "low-stock"
                                : "stock-value"
                            }
                          >
                            {p.track_stock
                              ? `${p.stock_on_hand} ${p.unit}`
                              : "Not tracked"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${p.active ? "status-paid" : "status-cancelled"}`}
                          >
                            {p.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Edit product"
                              onClick={() => {
                                setEditingProduct(p);
                                setModal("product");
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            {p.track_stock && (
                              <button
                                title="Adjust stock"
                                onClick={() => {
                                  setAdjustmentProduct(p);
                                  setModal("stock");
                                }}
                              >
                                <ClipboardList size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProducts.length === 0 && (
                  <EmptyState
                    icon={Package}
                    title="No products yet"
                    description="Add your first item to start billing and tracking stock."
                    action="Add product"
                    onAction={() => openAction("product")}
                  />
                )}
              </div>
            </Card>
          )}
          {section === "Customers" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="contacts"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() =>
                  exportCsv(
                    filteredParties.map(
                      ({ name, kind, gstin, phone, email, state_code }) => ({
                        name,
                        kind,
                        gstin,
                        phone,
                        email,
                        state_code,
                      }),
                    ),
                    "contacts.csv",
                  )
                }
              />
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>TYPE</th>
                      <th>GSTIN</th>
                      <th>PHONE</th>
                      <th>STATE</th>
                      <th>OPENING BALANCE</th>
                      <th>UNPAID INVOICES</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParties.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="item-cell">
                            <div className="party-thumb">
                              {p.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <strong>{p.name}</strong>
                              <span>{p.email || "Contact"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="type-label">{p.kind}</span>
                        </td>
                        <td className="mono">{p.gstin || "—"}</td>
                        <td>{p.phone || "—"}</td>
                        <td>{p.state_code || "—"}</td>
                        <td className="amount-cell">
                          {money(p.opening_balance)}
                        </td>
                        <td className="amount-cell">
                          {money(
                            outstandingInvoices
                              .filter((i) => i.party_id === p.id)
                              .reduce(
                                (sum, i) =>
                                  sum +
                                  Math.max(
                                    0,
                                    Number(i.grand_total) -
                                      Number(i.amount_paid),
                                  ),
                                0,
                              ),
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Edit contact"
                              onClick={() => {
                                setEditingParty(p);
                                setModal("party");
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredParties.length === 0 && (
                  <EmptyState
                    icon={Users}
                    title="Your contact book is empty"
                    description="Add customers and suppliers for faster billing."
                    action="Add contact"
                    onAction={() => openAction("party")}
                  />
                )}
              </div>
            </Card>
          )}
          {section === "Purchases" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="purchase bills"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() =>
                  exportCsv(
                    listPurchases.map(
                      ({
                        bill_number,
                        supplier_invoice_number,
                        bill_date,
                        status,
                        grand_total,
                        amount_paid,
                      }) => ({
                        bill_number,
                        supplier_invoice_number,
                        bill_date,
                        status,
                        grand_total,
                        amount_paid,
                      }),
                    ),
                    "purchases.csv",
                  )
                }
              />
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>OUR BILL NO.</th>
                      <th>SUPPLIER</th>
                      <th>SUPPLIER INVOICE</th>
                      <th>DATE</th>
                      <th>AMOUNT</th>
                      <th>PAYABLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listPurchases.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong className="mono">{p.bill_number}</strong>
                        </td>
                        <td>{p.parties?.name || "Supplier"}</td>
                        <td>{p.supplier_invoice_number || "—"}</td>
                        <td>{p.bill_date}</td>
                        <td className="amount-cell">{money(p.grand_total)}</td>
                        <td>
                          <div className="payable-cell">
                            <strong>
                              {money(
                                Number(p.grand_total) - Number(p.amount_paid),
                              )}
                            </strong>
                            {p.status !== "paid" && (
                              <button
                                onClick={() => {
                                  setPaymentPurchase(p);
                                  openAction("purchase_payment");
                                }}
                              >
                                Pay supplier
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listPurchases.length === 0 && !listLoading && (
                  <EmptyState
                    icon={ShoppingCart}
                    title="No purchases recorded"
                    description="Record a supplier bill to update stock on hand."
                    action="Record purchase"
                    onAction={() => openAction("purchase")}
                  />
                )}
              </div>
            </Card>
          )}
          {section === "Expenses" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="expenses"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() =>
                  exportCsv(
                    listExpenses.map(
                      ({
                        description,
                        category,
                        amount,
                        gst_amount,
                        expense_date,
                        payment_method,
                      }) => ({
                        description,
                        category,
                        amount,
                        gst_amount,
                        expense_date,
                        payment_method,
                      }),
                    ),
                    "expenses.csv",
                  )
                }
              />
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>DESCRIPTION</th>
                      <th>CATEGORY</th>
                      <th>DATE</th>
                      <th>GST INPUT</th>
                      <th>PAYMENT</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listExpenses.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <strong>{x.description}</strong>
                        </td>
                        <td>
                          <span className="type-label">{x.category}</span>
                        </td>
                        <td>{x.expense_date}</td>
                        <td>{money(x.gst_amount)}</td>
                        <td>{x.payment_method}</td>
                        <td className="amount-cell">{money(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listExpenses.length === 0 && !listLoading && (
                  <EmptyState
                    icon={Wallet}
                    title="No expenses added"
                    description="Track operating expenses in one place."
                    action="Add expense"
                    onAction={() => openAction("expense")}
                  />
                )}
              </div>
            </Card>
          )}
          {section === "GST reports" && (
            <>
              <div className="stats-grid report-stats">
                <StatCard
                  title="Taxable sales"
                  value={money(
                    invoices
                      .filter((x) => x.status !== "cancelled")
                      .reduce((a, x) => a + Number(x.subtotal), 0),
                  )}
                  note="Invoice taxable value"
                  icon={IndianRupee}
                  tone="green"
                  trend="Outward supplies"
                />
                <StatCard
                  title="Output GST"
                  value={money(taxCollected)}
                  note="GST on issued invoices"
                  icon={FileBarChart2}
                  tone="purple"
                  trend="Tax summary"
                />
                <StatCard
                  title="Purchase value"
                  value={money(
                    purchases.reduce((a, x) => a + Number(x.grand_total), 0),
                  )}
                  note="Supplier bills recorded"
                  icon={ShoppingCart}
                  tone="blue"
                  trend="Purchase register"
                />
                <StatCard
                  title="Expense value"
                  value={money(
                    expenses.reduce((a, x) => a + Number(x.amount), 0),
                  )}
                  note="Operating expenses"
                  icon={Wallet}
                  tone="amber"
                  trend="Expense register"
                />
              </div>
              <div className="report-grid">
                <Card className="surface-card report-card">
                  <div className="card-heading">
                    <div>
                      <h2>Outward supplies</h2>
                      <p>Invoice summary grouped by GST rate</p>
                    </div>
                    <span className="preview-badge">PREVIEW</span>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table compact">
                      <thead>
                        <tr>
                          <th>GST RATE</th>
                          <th>INVOICES</th>
                          <th>TAXABLE VALUE</th>
                          <th>GST AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 5, 12, 18, 28].map((rate) => {
                          const lines = invoices.flatMap((i) =>
                            i.status === "cancelled"
                              ? []
                              : (i.invoice_lines || []).filter(
                                  (l) => Number(l.gst_rate) === rate,
                                ),
                          );
                          const invoiceCount = invoices.filter(
                            (i) =>
                              i.status !== "cancelled" &&
                              (i.invoice_lines || []).some(
                                (l) => Number(l.gst_rate) === rate,
                              ),
                          ).length;
                          const base = lines.reduce(
                            (a, l) => a + Number(l.taxable_value),
                            0,
                          );
                          const gst = lines.reduce(
                            (a, l) => a + Number(l.tax_amount),
                            0,
                          );
                          return (
                            <tr key={rate}>
                              <td>{rate}%</td>
                              <td>{invoiceCount}</td>
                              <td>{money(base)}</td>
                              <td>{money(gst)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="report-footnote">
                    Summary only. Review and reconcile your GST data before
                    filing a return.
                  </p>
                </Card>
                <Card className="surface-card report-card">
                  <div className="card-heading">
                    <div>
                      <h2>Compliance checklist</h2>
                      <p>Complete these details for cleaner records</p>
                    </div>
                    <ClipboardList size={18} className="muted-icon" />
                  </div>
                  <div className="checklist">
                    <CheckItem
                      done={!!business.gstin}
                      label="Add your GSTIN"
                      detail={
                        business.gstin || "Needed for GST invoice details"
                      }
                    />
                    <CheckItem
                      done={products.length > 0}
                      label="Classify products with HSN/SAC"
                      detail={`${products.filter((x) => !x.hsn_sac).length} products without a code`}
                    />
                    <CheckItem
                      done={parties.length > 0}
                      label="Maintain customer GST details"
                      detail="Capture GSTIN and state for business customers"
                    />
                    <CheckItem
                      done={false}
                      label="Connect e-invoicing / GST portal"
                      detail="Portal filing and IRN generation are not connected yet"
                    />
                  </div>
                </Card>
              </div>
            </>
          )}
          {section === "Team" && (
            <>
              <Card className="surface-card team-card">
                <div className="team-header">
                  <div className="team-heading">
                    <div className="settings-avatar"><Users size={22} /></div>
                    <div>
                      <h2>People in {business?.name || "this workspace"}</h2>
                      <p>See who has access and what they can do.</p>
                    </div>
                  </div>
                  {["owner", "admin"].includes(memberRole) && (
                    <Button className="action-primary" onClick={() => setInviteOpen(true)}>
                      <Plus size={16} /> Invite person
                    </Button>
                  )}
                </div>

                <div className="team-section-heading">
                  <div>
                    <h3>Workspace members</h3>
                    <p>{teamLoading ? "Loading people…" : `${teamMembers.length} ${teamMembers.length === 1 ? "person has" : "people have"} access`}</p>
                  </div>
                  <span className="team-count">{teamMembers.length}</span>
                </div>

                {teamLoading ? (
                  <div className="team-empty">Loading workspace members…</div>
                ) : teamMembers.length === 0 ? (
                  <div className="team-empty">No members are available for this workspace.</div>
                ) : (
                  <div className="table-scroll team-table-wrap">
                    <table className="data-table team-table">
                      <thead>
                        <tr><th>PERSON</th><th>USER ID</th><th>ROLE</th><th>JOINED</th>{["owner", "admin"].includes(memberRole) && <th>ACCESS</th>}</tr>
                      </thead>
                      <tbody>
                        {teamMembers.map((member) => {
                          const protectedMember = member.role === "owner" || (memberRole === "admin" && member.role === "admin");
                          return (
                            <tr key={member.user_id}>
                              <td>
                                <div className="team-person">
                                  <span className="team-avatar">{member.display_name.trim().slice(0, 1).toUpperCase() || "U"}</span>
                                  <span className="team-person-copy"><strong>{member.display_name}</strong><small>{member.email || "Email unavailable"}</small></span>
                                </div>
                              </td>
                              <td className="mono team-user-id" title={member.user_id}>{member.user_id}</td>
                              <td><span className={`team-role role-${member.role}`}>{member.role.replaceAll("_", " ")}</span></td>
                              <td>{new Date(member.created_at).toLocaleDateString("en-IN")}</td>
                              {["owner", "admin"].includes(memberRole) && (
                                <td>
                                  {protectedMember ? <span className="type-label">Protected</span> : (
                                    <div className="row-actions team-row-actions">
                                      <select className={selectClass} value={member.role} aria-label={`Role for ${member.display_name}`} onChange={(event) => void changeMemberRole(member, event.target.value as MemberRole)}>
                                        <option value="accountant">Accountant</option>
                                        <option value="cashier">Cashier</option>
                                        <option value="stock_staff">Stock staff</option>
                                        {memberRole === "owner" && <option value="admin">Admin</option>}
                                      </select>
                                      <button title={`Remove ${member.display_name}`} aria-label={`Remove ${member.display_name}`} onClick={() => void removeMember(member)}><X size={14} /></button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {["owner", "admin"].includes(memberRole) && (
                  <div className="team-invitations">
                    <div className="team-section-heading">
                      <div>
                        <h3>Invitations</h3>
                        <p>Pending invitations expire after seven days.</p>
                      </div>
                    </div>
                    {businessInvitations.length > 0 ? (
                      <div className="table-scroll">
                        <table className="data-table team-table">
                          <thead><tr><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>EXPIRES</th><th /></tr></thead>
                          <tbody>
                            {businessInvitations.map((invitation) => (
                              <tr key={invitation.id}>
                                <td>{invitation.email}</td>
                                <td><span className={`team-role role-${invitation.role}`}>{invitation.role.replaceAll("_", " ")}</span></td>
                                <td><span className={`status-pill ${invitation.status === "pending" ? "status-due" : "status-paid"}`}>{invitation.status}</span></td>
                                <td>{new Date(invitation.expires_at).toLocaleDateString("en-IN")}</td>
                                <td>{invitation.status === "pending" && <button className="toolbar-export" onClick={() => void revokeInvitation(invitation)}>Revoke</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="team-empty team-empty-compact">No invitations yet. Use “Invite person” to add someone to this workspace.</div>
                    )}
                  </div>
                )}
              </Card>

              {inviteOpen && (
                <ModalShell
                  title="Invite a teammate"
                  subtitle={`Send an email invitation to join ${business?.name || "this workspace"}.`}
                  onClose={() => setInviteOpen(false)}
                >
                  <form onSubmit={inviteMember} className="form-grid">
                    <Field label="Email address">
                      <Input className={fieldClass} name="email" type="email" placeholder="person@business.in" autoFocus required />
                    </Field>
                    <Field label="Workspace role">
                      <select className={selectClass} name="role" defaultValue="accountant">
                        <option value="accountant">Accountant · finance and records</option>
                        <option value="cashier">Cashier · sales and receipts</option>
                        <option value="stock_staff">Stock staff · inventory</option>
                        {memberRole === "owner" && <option value="admin">Admin · workspace management</option>}
                      </select>
                    </Field>
                    <div className="team-invite-note">They’ll receive a secure link and will appear in this list after accepting.</div>
                    <div className="modal-actions">
                      <Button className="action-outline" type="button" disabled={inviteSending} onClick={() => setInviteOpen(false)}>Cancel</Button>
                      <Button className="action-primary" type="submit" disabled={inviteSending}>{inviteSending ? "Sending…" : "Send invitation"}</Button>
                    </div>
                  </form>
                </ModalShell>
              )}
            </>
          )}
          {section === "Journal" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="journal vouchers"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() => exportCsv(listJournalEntries.map((entry) => ({
                  journal_number: entry.journal_number,
                  entry_date: entry.entry_date,
                  description: entry.description,
                  source: entry.source_type,
                  status: entry.status,
                  debit_total: entry.business_journal_lines.reduce((sum, line) => sum + Number(line.debit), 0),
                  credit_total: entry.business_journal_lines.reduce((sum, line) => sum + Number(line.credit), 0),
                })), "journal-vouchers.csv")}
              />
              <div className="table-scroll">
                <table className="data-table journal-table">
                  <thead><tr><th>VOUCHER</th><th>DATE</th><th>DESCRIPTION</th><th>SOURCE</th><th>DEBIT</th><th>CREDIT</th><th>STATUS / ACTION</th></tr></thead>
                  <tbody>
                    {listJournalEntries.map((entry) => {
                      const debitTotal = entry.business_journal_lines.reduce((sum, line) => sum + Number(line.debit), 0);
                      const creditTotal = entry.business_journal_lines.reduce((sum, line) => sum + Number(line.credit), 0);
                      const canReverse = entry.status === "posted" && !entry.reversal_of_entry_id && ["owner", "admin", "accountant"].includes(memberRole);
                      return <Fragment key={entry.id}>
                        <tr>
                          <td><strong className="mono">{entry.journal_number}</strong></td>
                          <td>{new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString("en-IN")}</td>
                          <td className="journal-description">{entry.description}</td>
                          <td><span className="type-label">{entry.source_type.replaceAll("_", " ")}</span></td>
                          <td className="amount-cell">{money(debitTotal)}</td>
                          <td className="amount-cell">{money(creditTotal)}</td>
                          <td><div className="journal-actions"><span className={`status-pill ${entry.status === "posted" ? "status-paid" : "status-cancelled"}`}>{entry.status}</span><button className="toolbar-export" onClick={() => setExpandedJournalId(expandedJournalId === entry.id ? null : entry.id)}>{expandedJournalId === entry.id ? "Hide lines" : "View lines"}</button>{canReverse && <button className="toolbar-export journal-reverse" onClick={() => { setJournalToReverse(entry); setJournalDialog("reverse"); }}>Reverse</button>}</div></td>
                        </tr>
                        {expandedJournalId === entry.id && <tr className="journal-expanded"><td colSpan={7}><div className="journal-line-wrap"><table className="data-table"><thead><tr><th>ACCOUNT</th><th>DESCRIPTION</th><th>DEBIT</th><th>CREDIT</th></tr></thead><tbody>{entry.business_journal_lines.map((line) => <tr key={`${entry.id}-${line.line_number}`}><td><strong>{line.business_chart_of_accounts?.account_code || "—"}</strong> · {line.business_chart_of_accounts?.account_name || "Account"}</td><td>{line.description || entry.description}</td><td className="amount-cell">{Number(line.debit) > 0 ? money(line.debit) : "—"}</td><td className="amount-cell">{Number(line.credit) > 0 ? money(line.credit) : "—"}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Balanced total</th><th>{money(debitTotal)}</th><th>{money(creditTotal)}</th></tr></tfoot></table></div></td></tr>}
                      </Fragment>;
                    })}
                  </tbody>
                </table>
                {listJournalEntries.length === 0 && !listLoading && <EmptyState icon={BookOpen} title="No journal vouchers yet" description="Create a balanced manual journal or use a reversal to correct a posted entry." action="New journal entry" onAction={() => { setJournalDraftLines([{ account_id: "", debit: "0", credit: "0", description: "" }, { account_id: "", debit: "0", credit: "0", description: "" }]); setJournalDialog("entry"); }} />}
              </div>
            </Card>
          )}
          {section === "Audit history" && (
            <Card className="surface-card list-card">
              <ListToolbar
                count="audit events"
                search={search}
                onSearch={setSearch}
                page={listPage}
                totalCount={listTotal}
                loading={listLoading}
                onPageChange={setListPage}
                onExport={() =>
                  exportCsv(
                    listAuditEvents.map(
                      ({
                        operation,
                        table_name,
                        entity_key,
                        occurred_at,
                        actor_user_id,
                      }) => ({
                        operation,
                        table_name,
                        entity_key,
                        occurred_at,
                        actor_user_id,
                      }),
                    ),
                    "audit-history.csv",
                  )
                }
              />
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>WHEN</th>
                      <th>OPERATION</th>
                      <th>RECORD TYPE</th>
                      <th>RECORD</th>
                      <th>ACTOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listAuditEvents.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {new Date(item.occurred_at).toLocaleString("en-IN")}
                          </td>
                          <td>{item.operation}</td>
                          <td>{item.table_name.replaceAll("_", " ")}</td>
                          <td className="mono">{item.entity_key}</td>
                          <td className="mono">
                            {item.actor_user_id || "System"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {listAuditEvents.length === 0 && !listLoading && (
                  <p className="report-footnote">
                    No audit events have been recorded since the audit triggers
                    were installed.
                  </p>
                )}
              </div>
            </Card>
          )}
          {section === "Settings" && (
            <div className="settings-layout">
              <div className="settings-page-intro">
                <div>
                  <span className="settings-kicker">WORKSPACE CONFIGURATION</span>
                  <h2>Business settings</h2>
                  <p>Manage your business identity, tax registrations, and accounting setup in one place.</p>
                </div>
                <nav className="settings-nav" aria-label="Settings sections">
                  <a href="#settings-profile">Business</a>
                  <a href="#settings-gst">GST</a>
                  <a href="#settings-periods">Financial years</a>
                  <a href="#settings-accounts">Accounts</a>
                  <a href="#settings-opening-balances">Opening balances</a>
                </nav>
              </div>
              <Card id="settings-profile" className="surface-card settings-card">
                <div className="settings-intro settings-section-intro">
                  <div className="settings-title-group">
                    <div className="settings-avatar"><Building2 size={22} /></div>
                    <div><h2>Business profile</h2><p>These details appear on your invoices and business reports.</p></div>
                  </div>
                  <Button className="action-outline" type="button" onClick={() => setSettingsDialog("profile")}>Edit details</Button>
                </div>
                <div className="settings-summary-grid">
                  <div><span>Business name</span><strong>{business.name}</strong></div>
                  <div><span>GSTIN</span><strong>{business.gstin || "Not added"}</strong></div>
                  <div><span>State code</span><strong>{business.state_code || "Not added"}</strong></div>
                  <div><span>Phone</span><strong>{business.phone || "Not added"}</strong></div>
                  <div><span>Email</span><strong>{business.email || "Not added"}</strong></div>
                  <div><span>Business address</span><strong>{business.address || "Not added"}</strong></div>
                </div>
                <div className="settings-note">
                  <ShieldIcon />
                  <div>
                    <strong>Your workspace data is private</strong>
                    <p>
                      Business records are separated by membership access rules
                      in the database.
                    </p>
                  </div>
                </div>
              </Card>
              <Card id="settings-gst" className="surface-card settings-card">
                <div className="settings-intro settings-section-intro">
                  <div className="settings-avatar"><FileBarChart2 size={22} /></div>
                  <div><h2>GST registrations</h2><p>Manage GSTINs for each registered state and choose the primary registration used on new invoices.</p></div>
                  { ["owner", "admin", "accountant"].includes(memberRole) && <Button className="action-primary" type="button" onClick={() => setSettingsDialog("gst")}>Add GST registration</Button> }
                </div>
                <div className="table-scroll"><table className="data-table"><thead><tr><th>GSTIN</th><th>STATE</th><th>TYPE</th><th>RETURNS</th><th>LEGAL / TRADE NAME</th><th>STATUS</th><th /></tr></thead><tbody>{gstRegistrations.map((registration) => <tr key={registration.id}><td className="mono">{registration.gstin}</td><td>{registration.state_code}</td><td>{registration.registration_type.replaceAll("_", " ")}</td><td>{registration.return_frequency}</td><td>{registration.legal_name || registration.trade_name || "—"}</td><td>{registration.is_primary ? "Primary" : registration.is_active ? "Active" : "Inactive"}</td><td>{registration.is_active && !registration.is_primary && ["owner", "admin", "accountant"].includes(memberRole) && <button className="toolbar-export" onClick={() => void setPrimaryGstRegistration(registration)}>Make primary</button>}</td></tr>)}</tbody></table>{gstRegistrations.length === 0 && <p className="report-footnote">No GST registration records yet. Add a GSTIN to enable the full registration profile for your business.</p>}</div>
              </Card>
              <Card id="settings-periods" className="surface-card settings-card">
                <div className="settings-intro settings-section-intro">
                  <div className="settings-avatar">
                    <CalendarDays size={22} />
                  </div>
                  <div>
                    <h2>Financial years and accounting periods</h2>
                    <p>
                      Transactions in locked months cannot be added or
                      backdated.
                    </p>
                  </div>
                  { ["owner", "admin", "accountant"].includes(memberRole) && <Button className="action-primary" type="button" onClick={() => setSettingsDialog("financial-year")}>Add financial year</Button> }
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>FINANCIAL YEAR</th>
                        <th>START</th>
                        <th>END</th>
                        <th>STATUS</th>
                        <th>MONTHS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialYears.map((year) => (
                        <tr key={year.id}>
                          <td>
                            {year.name}
                            {year.is_current ? " · Current" : ""}
                          </td>
                          <td>{year.start_date}</td>
                          <td>{year.end_date}</td>
                          <td>{year.status}</td>
                          <td>
                            {
                              accountingPeriods.filter(
                                (p) =>
                                  p.period_start >= year.start_date &&
                                  p.period_start <= year.end_date,
                              ).length
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="settings-intro">
                  <div>
                    <h2>Period locks</h2>
                    <p>
                      Accountants can lock periods; only owners and admins can
                      unlock them.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>MONTH</th>
                        <th>STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingPeriods.map((periodItem) => (
                        <tr key={periodItem.id}>
                          <td>
                            {new Date(
                              `${periodItem.period_start}T00:00:00`,
                            ).toLocaleDateString("en-IN", {
                              month: "long",
                              year: "numeric",
                            })}
                          </td>
                          <td>{periodItem.status}</td>
                          <td>
                            <button
                              className="toolbar-export"
                              disabled={
                                periodItem.status === "locked" &&
                                !["owner", "admin"].includes(memberRole)
                              }
                              onClick={() =>
                                void toggleAccountingPeriodLock(periodItem)
                              }
                            >
                              {periodItem.status === "open"
                                ? "Lock period"
                                : "Unlock period"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card id="settings-accounts" className="surface-card settings-card">
                <div className="settings-intro">
                  <div className="settings-avatar">
                    <FileBarChart2 size={22} />
                  </div>
                  <div>
                    <h2>Chart of accounts</h2>
                    <p>
                      Starter accounts for assets, liabilities, equity, income,
                      and expenses.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>CODE</th>
                        <th>ACCOUNT</th>
                        <th>TYPE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartAccounts.map((account) => (
                        <tr key={account.id}>
                          <td className="mono">{account.account_code}</td>
                          <td>{account.account_name}</td>
                          <td>{account.account_type}</td>
                          <td>{account.is_active ? "Active" : "Inactive"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card id="settings-opening-balances" className="surface-card settings-card">
                <div className="settings-intro settings-section-intro">
                  <div className="settings-avatar"><IndianRupee size={22} /></div>
                  <div><h2>Opening balances</h2><p>Enter debit and credit balances for the selected financial year. Posting is atomic and requires the totals to match.</p></div>
                  {["owner", "admin", "accountant"].includes(memberRole) && financialYears.some((year) => !openingBalances.some((batch) => batch.financial_year_id === year.id && batch.status === "posted")) && <Button className="action-primary" type="button" onClick={() => setSettingsDialog("opening-balances")}>Add opening balance</Button>}
                </div>
                {! ["owner", "admin", "accountant"].includes(memberRole) && <p className="settings-permission-note">Your role does not have permission to post opening balances.</p>}
                <div className="settings-subheading"><div><h3>Posted batches</h3><p>Posted opening balances are preserved in the audit history.</p></div></div>
                <div className="table-scroll"><table className="data-table"><thead><tr><th>FINANCIAL YEAR</th><th>EFFECTIVE DATE</th><th>STATUS</th><th>POSTED AT</th></tr></thead><tbody>{openingBalances.map((batch) => <tr key={batch.id}><td>{financialYears.find((year) => year.id === batch.financial_year_id)?.name || batch.financial_year_id}</td><td>{batch.effective_date}</td><td>{batch.status}</td><td>{batch.posted_at ? new Date(batch.posted_at).toLocaleString("en-IN") : "—"}</td></tr>)}</tbody></table>{openingBalances.length === 0 && <p className="report-footnote">No opening balances posted yet.</p>}</div>
              </Card>
              {settingsDialog === "profile" && (
                <ModalShell title="Edit business profile" subtitle="These details appear on your invoices and business reports." onClose={() => setSettingsDialog(null)}>
                  <form onSubmit={saveSettings} className="form-grid settings-form">
                    <Field label="Business name"><Input className={fieldClass} name="name" defaultValue={business.name} required /></Field>
                    <Field label="GSTIN"><Input className={fieldClass} name="gstin" defaultValue={business.gstin || ""} placeholder="15-character GSTIN" maxLength={15} /></Field>
                    <Field label="State code"><Input className={fieldClass} name="state" defaultValue={business.state_code || ""} placeholder="e.g. 27" maxLength={2} /></Field>
                    <Field label="Phone"><Input className={fieldClass} name="phone" defaultValue={business.phone || ""} /></Field>
                    <Field label="Email"><Input className={fieldClass} name="email" type="email" defaultValue={business.email || ""} /></Field>
                    <Field label="Business address"><Input className={fieldClass} name="address" defaultValue={business.address || ""} /></Field>
                    <div className="modal-actions settings-modal-actions"><Button className="action-outline" type="button" onClick={() => setSettingsDialog(null)}>Cancel</Button><Button className="action-primary" type="submit">Save changes</Button></div>
                  </form>
                </ModalShell>
              )}
              {settingsDialog === "gst" && (
                <ModalShell title="Add GST registration" subtitle="Add a GSTIN for a registered state in this business." onClose={() => setSettingsDialog(null)}>
                  <form onSubmit={saveGstRegistration} className="form-grid settings-form">
                    <Field label="GSTIN"><Input className={fieldClass} name="gstin" maxLength={15} minLength={15} placeholder="15-character GSTIN" required /></Field>
                    <Field label="State code"><Input className={fieldClass} name="gst_state" maxLength={2} minLength={2} placeholder="e.g. 27" required /></Field>
                    <Field label="Registration type"><select className={selectClass} name="registration_type" defaultValue="regular"><option value="regular">Regular</option><option value="composition">Composition</option><option value="casual">Casual</option><option value="sez_unit">SEZ unit</option><option value="sez_developer">SEZ developer</option><option value="isd">Input service distributor</option><option value="tds_deductor">TDS deductor</option><option value="tcs_collector">TCS collector</option><option value="non_resident">Non-resident</option></select></Field>
                    <Field label="Return frequency"><select className={selectClass} name="return_frequency" defaultValue="monthly"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></Field>
                    <Field label="Legal name"><Input className={fieldClass} name="legal_name" /></Field>
                    <Field label="Trade name"><Input className={fieldClass} name="trade_name" /></Field>
                    <Field label="Effective from"><Input className={fieldClass} name="effective_from" type="date" /></Field>
                    <div className="modal-actions settings-modal-actions"><Button className="action-outline" type="button" onClick={() => setSettingsDialog(null)}>Cancel</Button><Button className="action-primary" type="submit">Add registration</Button></div>
                  </form>
                </ModalShell>
              )}
              {settingsDialog === "financial-year" && (
                <ModalShell title="Add financial year" subtitle="Create the year and its monthly accounting periods." onClose={() => setSettingsDialog(null)}>
                  <form onSubmit={createFinancialYear} className="form-grid settings-form">
                    <Field label="Financial year label"><Input className={fieldClass} name="year_name" placeholder="2027-28" required /></Field>
                    <Field label="Starts"><Input className={fieldClass} name="start_date" type="date" required /></Field>
                    <Field label="Ends"><Input className={fieldClass} name="end_date" type="date" required /></Field>
                    <div className="modal-actions settings-modal-actions"><Button className="action-outline" type="button" onClick={() => setSettingsDialog(null)}>Cancel</Button><Button className="action-primary" type="submit">Create financial year</Button></div>
                  </form>
                </ModalShell>
              )}
              {settingsDialog === "opening-balances" && (() => {
                const availableYears = financialYears.filter((year) => !openingBalances.some((batch) => batch.financial_year_id === year.id && batch.status === "posted"));
                return <ModalShell title="Post opening balances" subtitle="Enter the starting debit and credit balances. The totals must match before posting." onClose={() => setSettingsDialog(null)}>
                  {availableYears.length === 0 ? <div className="team-empty">Add a financial year before posting opening balances.</div> : <form onSubmit={saveOpeningBalance} className="settings-form opening-balance-form">
                    <div className="form-grid"><Field label="Financial year"><select className={selectClass} name="financial_year" required defaultValue={availableYears[0].id}>{availableYears.map((year) => <option key={year.id} value={year.id}>{year.name} · {year.start_date} to {year.end_date}</option>)}</select></Field><Field label="Effective date"><Input className={fieldClass} name="effective_date" type="date" defaultValue={availableYears[0].start_date} required /></Field></div>
                    <div className="table-scroll"><table className="data-table"><thead><tr><th>ACCOUNT</th><th>DEBIT (₹)</th><th>CREDIT (₹)</th></tr></thead><tbody>{chartAccounts.filter((account) => account.is_active).map((account, index) => <tr key={account.id}><td><strong>{account.account_code}</strong> · {account.account_name}<input type="hidden" name={`account_${index}`} value={account.id} /></td><td><Input className={fieldClass} name={`debit_${index}`} type="number" min="0" step="0.01" defaultValue="0" /></td><td><Input className={fieldClass} name={`credit_${index}`} type="number" min="0" step="0.01" defaultValue="0" /></td></tr>)}</tbody></table></div>
                    <div className="modal-actions settings-modal-actions"><Button className="action-outline" type="button" onClick={() => setSettingsDialog(null)}>Cancel</Button><Button className="action-primary" type="submit">Validate and post</Button></div>
                  </form>}
                </ModalShell>;
              })()}
            </div>
          )}
        </div>
        <footer className="app-footer">
          <span>Ledgerwise · Billing workspace</span>
          <span>
            <i className="online-dot" /> Connected to your cloud workspace
          </span>
        </footer>
      </main>
      {journalDialog === "entry" && (
        <ModalShell title="New journal voucher" subtitle="Enter balanced debit and credit lines. Posted entries can only be corrected with a linked reversal." onClose={() => setJournalDialog(null)}>
          <form onSubmit={createJournalEntry} className="journal-entry-form">
            <div className="form-grid">
              <Field label="Entry date"><Input className={fieldClass} type="date" name="entry_date" defaultValue={dateKey(new Date())} required /></Field>
              <Field label="Description"><Input className={fieldClass} name="description" placeholder="Reason for this journal" required /></Field>
            </div>
            <div className="journal-draft-heading"><div><strong>Journal lines</strong><span>Each line posts to one account.</span></div><button type="button" onClick={() => setJournalDraftLines((lines) => [...lines, { account_id: "", debit: "0", credit: "0", description: "" }])}><Plus size={14} /> Add line</button></div>
            <div className="journal-draft-lines">
              {journalDraftLines.map((line, index) => (
                <div className="journal-draft-row" key={index}>
                  <div className="journal-draft-row-head"><strong>Line {String(index + 1).padStart(2, "0")}</strong>{journalDraftLines.length > 2 && <button type="button" aria-label={`Remove line ${index + 1}`} onClick={() => setJournalDraftLines((lines) => lines.filter((_, rowIndex) => rowIndex !== index))}><X size={14} /></button>}</div>
                  <div className="form-grid">
                    <Field label="Account"><select className={selectClass} required value={line.account_id} onChange={(event) => setJournalDraftLines((lines) => lines.map((row, rowIndex) => rowIndex === index ? { ...row, account_id: event.target.value } : row))}><option value="">Select account</option>{chartAccounts.filter((account) => account.is_active).map((account) => <option value={account.id} key={account.id}>{account.account_code} · {account.account_name}</option>)}</select></Field>
                    <Field label="Line description"><Input className={fieldClass} name={`line_description_${index}`} placeholder="Optional detail" value={line.description} onChange={(event) => setJournalDraftLines((lines) => lines.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} /></Field>
                    <Field label="Debit (₹)"><Input className={fieldClass} type="number" min="0" step="0.01" name={`debit_${index}`} value={line.debit} onChange={(event) => setJournalDraftLines((lines) => lines.map((row, rowIndex) => rowIndex === index ? { ...row, debit: event.target.value, credit: Number(event.target.value) > 0 ? "0" : row.credit } : row))} /></Field>
                    <Field label="Credit (₹)"><Input className={fieldClass} type="number" min="0" step="0.01" name={`credit_${index}`} value={line.credit} onChange={(event) => setJournalDraftLines((lines) => lines.map((row, rowIndex) => rowIndex === index ? { ...row, credit: event.target.value, debit: Number(event.target.value) > 0 ? "0" : row.debit } : row))} /></Field>
                  </div>
                </div>
              ))}
            </div>
            <div className={`journal-totals ${journalDraftBalanced ? "is-balanced" : "is-unbalanced"}`}><span>{journalDraftBalanced ? "Balanced" : "Debits and credits must match"}</span><strong>Debit {money(journalDebitTotal)}</strong><strong>Credit {money(journalCreditTotal)}</strong></div>
            <div className="modal-actions"><Button className="action-outline" type="button" onClick={() => setJournalDialog(null)}>Cancel</Button><Button className="action-primary" type="submit" disabled={!journalDraftBalanced}>Post journal</Button></div>
          </form>
        </ModalShell>
      )}
      {journalDialog === "reverse" && journalToReverse && (
        <ModalShell title="Reverse journal entry" subtitle={`This posts a new entry with the exact debit and credit sides swapped for ${journalToReverse.journal_number}.`} onClose={() => { setJournalDialog(null); setJournalToReverse(null); }}>
          <form onSubmit={reverseJournalEntry}>
            <div className="form-grid"><Field label="Reversal date"><Input className={fieldClass} type="date" name="reversal_date" defaultValue={dateKey(new Date())} required /></Field><Field label="Reason"><Input className={fieldClass} name="reason" placeholder="Explain why this entry is being reversed" required /></Field></div>
            <div className="journal-reversal-note">The original voucher remains in the audit trail and will be marked reversed.</div>
            <div className="modal-actions"><Button className="action-outline" type="button" onClick={() => { setJournalDialog(null); setJournalToReverse(null); }}>Cancel</Button><Button className="action-primary" type="submit">Post reversal</Button></div>
          </form>
        </ModalShell>
      )}
      {modal && (
        <ModalShell
          title={
            modal === "invoice"
              ? "Create sales invoice"
              : modal === "product"
                ? editingProduct
                  ? "Edit product"
                  : "Add a product"
                : modal === "party"
                  ? editingParty
                    ? "Edit contact"
                    : "Add a contact"
                  : modal === "purchase"
                    ? "Record purchase bill"
                    : modal === "expense"
                      ? "Add business expense"
                      : modal === "payment"
                        ? "Record customer payment"
                        : modal === "purchase_payment"
                          ? "Record supplier payment"
                          : "Adjust inventory"
          }
          subtitle={
            modal === "invoice"
              ? "Issue a GST-ready invoice and update stock."
              : modal === "purchase"
                ? "Enter the supplier bill and receive stock."
                : undefined
          }
          onClose={() => {
            setModal(null);
            setPaymentInvoice(null);
            setPaymentPurchase(null);
            setAdjustmentProduct(null);
          }}
        >
          {modal === "stock" && adjustmentProduct && (
            <form onSubmit={saveStockAdjustment}>
              <div className="payment-context">
                <span>Current stock · {adjustmentProduct.name}</span>
                <strong>
                  {adjustmentProduct.stock_on_hand}{" "}
                  <small>{adjustmentProduct.unit}</small>
                </strong>
              </div>
              <div className="form-grid">
                <Field label={`Quantity change (${adjustmentProduct.unit})`}>
                  <Input
                    className={fieldClass}
                    name="delta"
                    required
                    type="number"
                    step="0.001"
                    defaultValue="0"
                  />
                </Field>
                <Field label="Reason">
                  <select className={selectClass} name="note">
                    <option value="Stock count">Stock count</option>
                    <option value="Damaged goods">Damaged goods</option>
                    <option value="Opening correction">
                      Opening correction
                    </option>
                    <option value="Other adjustment">Other adjustment</option>
                  </select>
                </Field>
              </div>
              <p className="transaction-hint">
                Use a positive number to add stock and a negative number to
                remove it. This creates an auditable stock movement.
              </p>
              <ModalActions
                onCancel={() => {
                  setModal(null);
                  setAdjustmentProduct(null);
                }}
                submit="Save adjustment"
              />
            </form>
          )}
          {modal === "product" && (
            <form onSubmit={saveProduct}>
              <div className="form-grid">
                <Field label="Product name">
                  <Input
                    className={fieldClass}
                    name="name"
                    required
                    defaultValue={editingProduct?.name || ""}
                    placeholder="e.g. Premium basmati rice"
                  />
                </Field>
                <Field label="SKU / barcode">
                  <Input
                    className={fieldClass}
                    name="sku"
                    defaultValue={editingProduct?.sku || ""}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="HSN / SAC">
                  <Input
                    className={fieldClass}
                    name="hsn"
                    defaultValue={editingProduct?.hsn_sac || ""}
                    placeholder="e.g. 1006"
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    className={fieldClass}
                    name="unit"
                    defaultValue={editingProduct?.unit || "pcs"}
                  />
                </Field>
                <Field label="Selling price">
                  <Input
                    className={fieldClass}
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={editingProduct?.sale_price || ""}
                  />
                </Field>
                <Field label="Purchase price">
                  <Input
                    className={fieldClass}
                    name="purchase_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingProduct?.purchase_price ?? 0}
                  />
                </Field>
                <Field label="GST rate">
                  <select
                    className={selectClass}
                    name="gst"
                    defaultValue={String(editingProduct?.gst_rate ?? 18)}
                  >
                    <option value="0">0% · Exempt / non-GST</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </Field>
                <Field
                  label={editingProduct ? "Current stock" : "Opening stock"}
                >
                  <Input
                    className={fieldClass}
                    name="stock"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={editingProduct?.stock_on_hand ?? 0}
                    disabled={!!editingProduct}
                  />
                </Field>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="track_stock"
                    defaultChecked={editingProduct?.track_stock ?? true}
                  />
                  <span>Track inventory for this product</span>
                </label>
              </div>
              <ModalActions
                onCancel={() => {
                  setModal(null);
                  setEditingProduct(null);
                }}
                submit="Save product"
              />
            </form>
          )}
          {modal === "party" && (
            <form onSubmit={saveParty}>
              <div className="form-grid">
                <Field label="Name">
                  <Input
                    className={fieldClass}
                    name="name"
                    required
                    defaultValue={editingParty?.name || ""}
                    placeholder="Customer or supplier name"
                  />
                </Field>
                <Field label="Contact type">
                  <select
                    className={selectClass}
                    name="kind"
                    defaultValue={editingParty?.kind || "customer"}
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                    <option value="both">Both</option>
                  </select>
                </Field>
                <Field label="GSTIN">
                  <Input
                    className={fieldClass}
                    name="gstin"
                    defaultValue={editingParty?.gstin || ""}
                    maxLength={15}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    className={fieldClass}
                    name="phone"
                    defaultValue={editingParty?.phone || ""}
                    type="tel"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    className={fieldClass}
                    name="email"
                    defaultValue={editingParty?.email || ""}
                    type="email"
                  />
                </Field>
                <Field label="State code">
                  <Input
                    className={fieldClass}
                    name="state"
                    defaultValue={editingParty?.state_code || ""}
                    maxLength={2}
                    placeholder="e.g. 27"
                  />
                </Field>
                <div className="field-full">
                  <Field label="Address">
                    <Input
                      className={fieldClass}
                      name="address"
                      defaultValue={editingParty?.address || ""}
                    />
                  </Field>
                </div>
              </div>
              <ModalActions
                onCancel={() => {
                  setModal(null);
                  setEditingParty(null);
                }}
                submit="Save contact"
              />
            </form>
          )}
          {(modal === "invoice" || modal === "purchase") && (
            <TransactionForm
              kind={modal}
              products={products}
              parties={parties}
              onSubmit={modal === "invoice" ? saveInvoice : savePurchase}
              onCancel={() => setModal(null)}
            />
          )}
          {modal === "expense" && (
            <form onSubmit={saveExpense}>
              <div className="form-grid">
                <div className="field-full">
                  <Field label="What was this expense for?">
                    <Input
                      className={fieldClass}
                      name="description"
                      required
                      placeholder="e.g. Shop rent"
                    />
                  </Field>
                </div>
                <Field label="Category">
                  <select className={selectClass} name="category">
                    <option>General</option>
                    <option>Rent</option>
                    <option>Utilities</option>
                    <option>Travel</option>
                    <option>Salary</option>
                    <option>Marketing</option>
                    <option>Repairs</option>
                  </select>
                </Field>
                <Field label="Amount">
                  <Input
                    className={fieldClass}
                    name="amount"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                  />
                </Field>
                <Field label="GST amount">
                  <Input
                    className={fieldClass}
                    name="gst"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </Field>
                <Field label="Date">
                  <Input
                    className={fieldClass}
                    name="date"
                    type="date"
                    defaultValue={today()}
                  />
                </Field>
                <Field label="Paid with">
                  <select className={selectClass} name="method">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
              <ModalActions
                onCancel={() => setModal(null)}
                submit="Save expense"
              />
            </form>
          )}
          {modal === "payment" && paymentInvoice && (
            <form onSubmit={savePayment}>
              <div className="payment-context">
                <span>Invoice {paymentInvoice.invoice_number}</span>
                <strong>
                  {money(
                    Number(paymentInvoice.grand_total) -
                      Number(paymentInvoice.amount_paid),
                  )}{" "}
                  <small>due</small>
                </strong>
              </div>
              <div className="form-grid">
                <Field label="Amount received">
                  <Input
                    className={fieldClass}
                    name="amount"
                    required
                    type="number"
                    min="0.01"
                    max={
                      Number(paymentInvoice.grand_total) -
                      Number(paymentInvoice.amount_paid)
                    }
                    step="0.01"
                    defaultValue={(
                      Number(paymentInvoice.grand_total) -
                      Number(paymentInvoice.amount_paid)
                    ).toFixed(2)}
                  />
                </Field>
                <Field label="Payment method">
                  <select className={selectClass} name="method">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Payment date">
                  <Input
                    className={fieldClass}
                    name="date"
                    type="date"
                    defaultValue={today()}
                  />
                </Field>
              </div>
              <ModalActions
                onCancel={() => setModal(null)}
                submit="Record payment"
              />
            </form>
          )}
          {modal === "purchase_payment" && paymentPurchase && (
            <form onSubmit={savePurchasePayment}>
              <div className="payment-context">
                <span>Supplier bill {paymentPurchase.bill_number}</span>
                <strong>
                  {money(
                    Number(paymentPurchase.grand_total) -
                      Number(paymentPurchase.amount_paid),
                  )}{" "}
                  <small>payable</small>
                </strong>
              </div>
              <div className="form-grid">
                <Field label="Amount paid">
                  <Input
                    className={fieldClass}
                    name="amount"
                    required
                    type="number"
                    min="0.01"
                    max={
                      Number(paymentPurchase.grand_total) -
                      Number(paymentPurchase.amount_paid)
                    }
                    step="0.01"
                    defaultValue={(
                      Number(paymentPurchase.grand_total) -
                      Number(paymentPurchase.amount_paid)
                    ).toFixed(2)}
                  />
                </Field>
                <Field label="Payment method">
                  <select className={selectClass} name="method">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Payment date">
                  <Input
                    className={fieldClass}
                    name="date"
                    type="date"
                    defaultValue={today()}
                  />
                </Field>
              </div>
              <ModalActions
                onCancel={() => setModal(null)}
                submit="Record payment"
              />
            </form>
          )}
        </ModalShell>
      )}
    </div>
  );
}

function LandingPage({
  onSignup,
  onSignin,
}: {
  onSignup: () => void;
  onSignin: () => void;
}) {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="Ledgerwise home">
          <span className="brand-mark">
            <Boxes size={20} />
          </span>
          <span>
            ledger<span>wise</span>
          </span>
        </a>
        <nav className="landing-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#about">For your business</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="landing-signin" onClick={onSignin}>
            Sign in
          </button>
          <button className="landing-nav-cta" onClick={onSignup}>
            Get started <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      <main id="top">
        <section className="landing-hero">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="eyebrow-dot" /> SMARTER BILLING FOR INDIAN
              BUSINESSES
            </div>
            <h1>
              Run your business.
              <br />
              <em>Not your paperwork.</em>
            </h1>
            <p>
              GST billing, inventory and everyday bookkeeping come together in
              one clear workspace—so you can spend more time with your
              customers.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-primary" onClick={onSignup}>
                Create your free workspace <ArrowUpRight size={17} />
              </button>
              <a className="landing-secondary" href="#features">
                Explore the platform <ArrowDownLeft size={16} />
              </a>
            </div>
            <div className="landing-assurance">
              <span>
                <Check size={14} /> GST-ready invoices
              </span>
              <i />
              <span>
                <Check size={14} /> Inventory in sync
              </span>
              <i />
              <span>
                <Check size={14} /> Clear business reports
              </span>
            </div>
          </div>
          <div className="hero-preview-wrap">
            <div className="preview-glow" />
            <div className="preview-card">
              <div className="preview-top">
                <div className="preview-brand">
                  <span className="preview-brand-mark">
                    <Boxes size={14} />
                  </span>
                  <div>
                    <strong>Business overview</strong>
                    <span>Illustrative dashboard preview</span>
                  </div>
                </div>
                <button aria-label="More options">···</button>
              </div>
              <div className="preview-period">
                OCTOBER 2026 <span>THIS MONTH⌄</span>
              </div>
              <div className="preview-total">
                <strong>₹4,82,650</strong>
                <span>
                  <TrendingUp size={14} /> Sales overview
                </span>
              </div>
              <div className="preview-chart">
                <div className="preview-chart-grid">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="preview-bars">
                  {[31, 48, 39, 68, 52, 82, 63, 94, 73, 100, 76, 88].map(
                    (height, index) => (
                      <i
                        className={index === 9 ? "active" : ""}
                        style={{ height: `${height}%` }}
                        key={index}
                      />
                    ),
                  )}
                </div>
              </div>
              <div className="preview-chart-labels">
                <span>01 OCT</span>
                <span>15 OCT</span>
                <span>31 OCT</span>
              </div>
              <div className="preview-divider" />
              <div className="preview-bottom">
                <div>
                  <span className="preview-icon invoice">
                    <FileText size={15} />
                  </span>
                  <span>
                    <strong>Invoices issued</strong>
                    <small>Across your business</small>
                  </span>
                </div>
                <strong>42</strong>
                <div className="preview-paid">
                  <Check size={13} /> Up to date
                </div>
              </div>
            </div>
            <div className="preview-float">
              <span>
                <Package size={16} />
              </span>
              <div>
                <small>Stock status</small>
                <strong>Inventory in view</strong>
              </div>
              <i />
            </div>
            <div className="hero-stamp">
              <span>01</span>
              <i /> BUILT FOR THE WAY YOU WORK
            </div>
          </div>
        </section>
        <div className="landing-ribbon">
          <span>ONE PLACE FOR THE DAILY DETAILS</span>
          <i />
          <span>BILLING</span>
          <i />
          <span>INVENTORY</span>
          <i />
          <span>PAYMENTS</span>
          <i />
          <span>REPORTS</span>
        </div>
        <section className="landing-features" id="features">
          <div className="section-intro">
            <div className="landing-eyebrow">YOUR BUSINESS, IN BALANCE</div>
            <h2>
              The essentials, working
              <br />
              better <em>together.</em>
            </h2>
            <p>
              Less switching between tools. A clearer picture of what’s
              happening in your business, every day.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-billing">
              <span className="feature-number">01 / BILLING</span>
              <span className="feature-icon">
                <FileText size={20} />
              </span>
              <h3>Make every bill feel simple.</h3>
              <p>
                Create clean GST invoices, track what’s paid, and keep customer
                details close at hand.
              </p>
              <div className="mini-invoice">
                <div>
                  <span>SALES INVOICE</span>
                  <strong>INV / 2026–27 / 0042</strong>
                </div>
                <i>
                  <Check size={13} /> ISSUED
                </i>
                <b>₹18,880.00</b>
              </div>
            </article>
            <article className="feature-card feature-stock">
              <span className="feature-number">02 / INVENTORY</span>
              <span className="feature-icon">
                <Package size={20} />
              </span>
              <h3>Know what’s on the shelf.</h3>
              <p>
                Keep products, prices and stock movements connected to your
                sales and purchases.
              </p>
              <div className="stock-lines">
                <span>
                  <i className="stock-box green-box">
                    <Package size={14} />
                  </i>
                  <b>Wireless keyboard</b>
                  <small>In stock</small>
                  <strong>24</strong>
                </span>
                <span>
                  <i className="stock-box blue-box">
                    <Package size={14} />
                  </i>
                  <b>Business laptop</b>
                  <small>In stock</small>
                  <strong>08</strong>
                </span>
              </div>
            </article>
            <article className="feature-card feature-books">
              <span className="feature-number">03 / BUSINESS BOOKS</span>
              <span className="feature-icon">
                <ShoppingCart size={20} />
              </span>
              <h3>Keep the whole day in view.</h3>
              <p>
                Record purchases, expenses and payments without losing sight of
                your cash flow.
              </p>
              <div className="book-flow">
                <span>Purchase</span>
                <ArrowUpRight size={14} />
                <span>Stock</span>
                <ArrowUpRight size={14} />
                <span>Sale</span>
                <ArrowUpRight size={14} />
                <span>Payment</span>
              </div>
            </article>
            <article className="feature-card feature-reports">
              <span className="feature-number">04 / REPORTS</span>
              <span className="feature-icon">
                <FileBarChart2 size={20} />
              </span>
              <h3>Make decisions with clarity.</h3>
              <p>
                See sales, outstanding balances and GST summaries in one
                straightforward view.
              </p>
              <div className="report-preview">
                <div>
                  <small>SALES THIS MONTH</small>
                  <strong>₹2,48,500</strong>
                </div>
                <div className="report-spark">
                  {[25, 37, 32, 57, 46, 68, 53, 81, 71, 100].map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>
        <section className="landing-workflow" id="workflow">
          <div className="workflow-copy">
            <div className="landing-eyebrow">A CALMER WAY TO KEEP UP</div>
            <h2>
              From first sale
              <br />
              to month-end.
              <br />
              <em>One clear flow.</em>
            </h2>
            <p>
              Start with the details you already know. Ledgerwise connects each
              invoice, stock change, payment and expense as your business moves.
            </p>
            <button className="landing-text-cta" onClick={onSignup}>
              Set up your workspace <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="workflow-steps">
            <div className="workflow-line" />
            <article>
              <span>01</span>
              <div>
                <strong>Add your products and services</strong>
                <p>
                  Set prices, GST rates and opening stock for the items you
                  sell.
                </p>
              </div>
              <i>
                <Package size={18} />
              </i>
            </article>
            <article>
              <span>02</span>
              <div>
                <strong>Create invoices and record purchases</strong>
                <p>Keep your customer bills and supplier entries together.</p>
              </div>
              <i>
                <FileText size={18} />
              </i>
            </article>
            <article>
              <span>03</span>
              <div>
                <strong>Follow the numbers as they change</strong>
                <p>
                  See payments, inventory and business summaries update with
                  your work.
                </p>
              </div>
              <i>
                <TrendingUp size={18} />
              </i>
            </article>
          </div>
        </section>
        <section className="landing-cta" id="about">
          <div className="cta-mark">
            <Boxes size={22} />
          </div>
          <div>
            <span className="landing-eyebrow">MAKE ROOM FOR WHAT’S NEXT</span>
            <h2>
              Your business deserves
              <br />a clearer workday.
            </h2>
            <p>
              Bring your daily billing and business records into one workspace.
            </p>
          </div>
          <button className="landing-primary cta-button" onClick={onSignup}>
            Get started <ArrowUpRight size={17} />
          </button>
          <div className="cta-decoration" />
        </section>
      </main>
      <footer className="landing-footer">
        <a className="landing-brand" href="#top">
          <span className="brand-mark">
            <Boxes size={18} />
          </span>
          <span>
            ledger<span>wise</span>
          </span>
        </a>
        <span>Clear books. Confident business.</span>
        <div>
          <button onClick={onSignin}>Sign in</button>
          <span>© 2026 Ledgerwise</span>
        </div>
      </footer>
    </div>
  );
}
function AuthScreen({
  mode,
  setMode,
  onSubmit,
  loading,
  error,
  notice,
  onBack,
}: {
  mode: "signin" | "signup";
  setMode: (v: "signin" | "signup") => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string;
  notice: string;
  onBack: () => void;
}) {
  return (
    <div className="auth-layout">
      <section className="auth-art">
        <div className="auth-brand">
          <div className="brand-mark">
            <Boxes size={20} />
          </div>
          ledger<span>wise</span>
        </div>
        <div className="auth-message">
          <span className="auth-kicker">
            <Sparkles size={14} /> YOUR BUSINESS, IN BALANCE
          </span>
          <h1>
            Every sale.
            <br />
            Every detail.
            <br />
            <em>In control.</em>
          </h1>
          <p>Billing and business tools that bring your day into focus.</p>
          <div className="auth-proof">
            <div className="proof-avatars">
              <span>A</span>
              <span>R</span>
              <span>M</span>
              <span>+</span>
            </div>
            <span>Made for the people who keep business moving.</span>
          </div>
        </div>
        <div className="auth-art-foot">
          <span>Simple books. Clear decisions.</span>
          <span>01 — BUILT FOR BUSINESS</span>
        </div>
        <div className="art-orb orb-one" />
        <div className="art-orb orb-two" />
        <div className="art-grid" />
      </section>
      <section className="auth-side">
        <div className="auth-form-wrap">
          <button className="auth-back" onClick={onBack}>
            <ArrowDownLeft size={14} /> Back to home
          </button>
          <div className="mobile-auth-brand">
            <div className="brand-mark">
              <Boxes size={18} />
            </div>
            ledger<span>wise</span>
          </div>
          <span className="eyebrow">
            WELCOME {mode === "signin" ? "BACK" : "ABOARD"}
          </span>
          <h2>
            {mode === "signin"
              ? "Sign in to your workspace"
              : "Create your workspace account"}
          </h2>
          <p className="auth-sub">
            {mode === "signin"
              ? "Enter your details to pick up where you left off."
              : "Start organising your billing and business in one place."}
          </p>
          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-success">{notice}</div>}
          <form onSubmit={onSubmit} className="auth-form">
            <Field label="Email address">
              <Input
                className="auth-input"
                type="email"
                name="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                className="auth-input"
                type="password"
                name="password"
                placeholder="At least 6 characters"
                minLength={6}
                required
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
            </Field>
            <Button type="submit" className="auth-submit" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              <ArrowUpRight size={16} />
            </Button>
          </form>
          <div className="auth-switch">
            {mode === "signin"
              ? "New to Ledgerwise?"
              : "Already have an account?"}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </div>
          <div className="auth-legal">
            By continuing, you agree to our <button>Terms</button> and{" "}
            <button>Privacy policy</button>.
          </div>
        </div>
        <div className="auth-side-foot">
          <span>© 2026 Ledgerwise</span>
          <span>
            <i className="online-dot" /> Secure sign-in
          </span>
        </div>
      </section>
    </div>
  );
}
function SetupScreen({
  onSubmit,
  loading,
  error,
  onSignOut,
}: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string;
  onSignOut: () => void;
}) {
  return (
    <div className="setup-screen">
      <div className="setup-top">
        <div className="brand">
          <div className="brand-mark">
            <Boxes size={19} />
          </div>
          <span>
            ledger<span className="brand-light">wise</span>
          </span>
        </div>
        <button onClick={onSignOut}>
          Sign out <LogOut size={14} />
        </button>
      </div>
      <div className="setup-card">
        <div className="setup-icon">
          <Building2 size={23} />
        </div>
        <span className="eyebrow">ONE QUICK SETUP</span>
        <h1>Let’s set up your business.</h1>
        <p>
          Add the basics now. You can fill in the rest of your business profile
          later.
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={onSubmit} className="form-grid">
          <div className="field-full">
            <Field label="Business name">
              <Input
                className={fieldClass}
                name="name"
                required
                placeholder="Your shop or company name"
              />
            </Field>
          </div>
          <Field label="GSTIN (optional)">
            <Input
              className={fieldClass}
              name="gstin"
              maxLength={15}
              placeholder="15-character GSTIN"
            />
          </Field>
          <Field label="State code">
            <Input
              className={fieldClass}
              name="state"
              maxLength={2}
              placeholder="e.g. 27"
            />
          </Field>
          <div className="field-full">
            <Button
              type="submit"
              className="action-primary setup-submit"
              disabled={loading}
            >
              {loading ? "Creating…" : "Create my workspace"}
              <ArrowUpRight size={16} />
            </Button>
          </div>
        </form>
        <div className="setup-security">
          <Check size={14} /> Your data is private to your business workspace.
        </div>
      </div>
      <div className="setup-foot">LEDGERWISE · YOUR BUSINESS, IN BALANCE</div>
    </div>
  );
}
function StatCard({
  title,
  value,
  note,
  icon: Icon,
  tone,
  trend,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof Home;
  tone: string;
  trend: string;
}) {
  return (
    <Card className="stat-card">
      <div className="stat-top">
        <div>
          <span>{title}</span>
          <span className={`stat-icon ${tone}`}>
            <Icon size={17} />
          </span>
        </div>
        <small>{trend}</small>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-bottom">
        <span>{note}</span>
        <span className="stat-spark">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </Card>
  );
}
function SalesChart({
  invoices,
  from,
  to,
  preset,
}: {
  invoices: Invoice[];
  from: string;
  to: string;
  preset: DatePreset;
}) {
  const data = useMemo(() => {
    let start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (preset === "all") {
      start = new Date(end);
      start.setMonth(start.getMonth() - 5, 1);
    }
    if (start.getTime() === end.getTime()) start.setDate(start.getDate() - 6);
    const span = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / 86400000) + 1,
    );
    return Array.from({ length: 6 }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + Math.floor((index * span) / 6));
      const bucketEnd = new Date(start);
      bucketEnd.setDate(
        start.getDate() + Math.floor(((index + 1) * span) / 6) - 1,
      );
      const lower = dateKey(bucketStart);
      const upper = dateKey(bucketEnd);
      return {
        label: bucketEnd.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        value: invoices
          .filter(
            (x) =>
              x.status !== "cancelled" &&
              x.invoice_date >= lower &&
              x.invoice_date <= upper,
          )
          .reduce((a, x) => a + Number(x.grand_total), 0),
        current: index === 5,
      };
    });
  }, [invoices, from, to, preset]);
  const max = Math.max(...data.map((x) => x.value), 1);
  return (
    <div className="chart-wrap">
      <div className="chart-y">
        <span>{money(max).replace(".00", "")}</span>
        <span>{money(max * 0.66).replace(".00", "")}</span>
        <span>{money(max * 0.33).replace(".00", "")}</span>
        <span>₹0</span>
      </div>
      <div className="chart-main">
        <div className="chart-lines">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="chart-bars">
          {data.map((x, i) => (
            <div className="bar-col" key={`${x.label}-${i}`}>
              <div
                className={`bar ${x.current ? "bar-current" : ""}`}
                style={{
                  height: `${Math.max((x.value / max) * 100, x.value ? 8 : 2)}%`,
                }}
                title={`${x.label}: ${money(x.value)}`}
              />
              <span>{x.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Snapshot({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="snapshot-row">
      <div className={`snapshot-icon ${tone}`}>
        <Icon size={17} />
      </div>
      <div className="snapshot-copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <b>{value}</b>
    </div>
  );
}
function Quick({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span>
        <Icon size={18} />
      </span>
      <strong>{label}</strong>
      <ArrowUpRight size={14} className="quick-arrow" />
    </button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ListToolbar({
  count,
  search,
  onSearch,
  onExport,
  page,
  totalCount,
  loading,
  onPageChange,
}: {
  count: string;
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  page?: number;
  totalCount?: number;
  loading?: boolean;
  onPageChange?: (page: number) => void;
}) {
  return (
    <div className="list-toolbar">
      <span>{loading ? "Loading…" : totalCount !== undefined ? `${totalCount.toLocaleString("en-IN")} ${count}` : count}</span>
      <div className="list-tools">
        <label className="table-search">
          <Search size={14} />
          <input
            aria-label="Filter this list"
            placeholder="Filter this list"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <button className="toolbar-export" onClick={onExport}>
          <ArrowDownLeft size={14} /> Export
        </button>
        {page !== undefined && onPageChange && (
          <div className="list-pagination" aria-label="List pages">
            <button className="toolbar-export" disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)}>Previous</button>
            <span>{page + 1} / {Math.max(1, Math.ceil((totalCount || 0) / 50))}</span>
            <button className="toolbar-export" disabled={loading || page + 1 >= Math.ceil((totalCount || 0) / 50)} onClick={() => onPageChange(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof Home;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <div>
        <Icon size={19} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      <Button className="action-primary" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function ModalActions({
  onCancel,
  submit,
}: {
  onCancel: () => void;
  submit: string;
}) {
  return (
    <div className="modal-actions">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button className="action-primary" type="submit">
        {submit}
        <ArrowUpRight size={15} />
      </Button>
    </div>
  );
}
function InvoiceTable({
  items,
  onPayment,
  onPrint,
  onCreate,
  todayKey,
}: {
  items: Invoice[];
  onPayment: (x: Invoice) => void;
  onPrint: (x: Invoice) => void;
  onCreate: () => void;
  todayKey: string;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>INVOICE</th>
            <th>CUSTOMER</th>
            <th>DATE</th>
            <th>DUE DATE</th>
            <th>STATUS</th>
            <th>AMOUNT</th>
            <th>OUTSTANDING</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const overdue =
              !["paid", "cancelled"].includes(i.status) &&
              Boolean(i.due_date && todayKey && i.due_date < todayKey);
            return (
              <tr key={i.id}>
                <td>
                  <strong className="mono">{i.invoice_number}</strong>
                </td>
                <td>
                  <div className="customer-cell">
                    <span className="party-thumb small-thumb">
                      {(i.party_name || i.parties?.name || "W")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                    {i.party_name || i.parties?.name || "Walk-in customer"}
                  </div>
                </td>
                <td>{i.invoice_date}</td>
                <td>{i.due_date || "—"}</td>
                <td>
                  <span
                    className={`status-pill ${overdue ? "status-overdue" : i.status === "paid" ? "status-paid" : i.status === "cancelled" ? "status-cancelled" : "status-due"}`}
                  >
                    <i />
                    {overdue ? "overdue" : i.status}
                  </span>
                </td>
                <td className="amount-cell">{money(i.grand_total)}</td>
                <td>
                  {money(
                    Math.max(0, Number(i.grand_total) - Number(i.amount_paid)),
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button title="Print invoice" onClick={() => onPrint(i)}>
                      <FileText size={15} />
                    </button>
                    {!["paid", "cancelled"].includes(i.status) && (
                      <button
                        title="Record payment"
                        onClick={() => onPayment(i)}
                      >
                        <CreditCard size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice to start tracking sales."
          action="Create invoice"
          onAction={onCreate}
        />
      )}
    </div>
  );
}
function TransactionForm({
  kind,
  products,
  parties,
  onSubmit,
  onCancel,
}: {
  kind: "invoice" | "purchase";
  products: Product[];
  parties: Party[];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState([0]);
  const [selected, setSelected] = useState<Record<number, Product | undefined>>(
    {},
  );
  const [qty, setQty] = useState<Record<number, number>>({ 0: 1 });
  const [price, setPrice] = useState<Record<number, number>>({});
  const [discount, setDiscount] = useState<Record<number, number>>({});
  const invoice = kind === "invoice";
  const addRow = () => setRows((r) => [...r, Math.max(...r) + 1]);
  const total = rows.reduce((sum, id) => {
    const p = selected[id];
    const amount =
      (qty[id] || 0) *
      (price[id] ?? Number(p?.sale_price || p?.purchase_price || 0)) *
      (1 - (discount[id] || 0) / 100);
    return sum + amount * (1 + Number(p?.gst_rate || 0) / 100);
  }, 0);
  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <Field label={invoice ? "Customer" : "Supplier"}>
          <select className={selectClass} name="party" defaultValue="">
            <option value="">
              {invoice ? "Walk-in customer" : "Select supplier"}
            </option>
            {parties
              .filter((p) =>
                invoice
                  ? ["customer", "both"].includes(p.kind)
                  : ["supplier", "both"].includes(p.kind),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={invoice ? "Invoice date" : "Bill date"}>
          <Input
            className={fieldClass}
            name="date"
            type="date"
            defaultValue={today()}
            required
          />
        </Field>
        {invoice && (
          <Field label="Due date">
            <Input className={fieldClass} name="due" type="date" />
          </Field>
        )}
        {!invoice && (
          <Field label="Supplier invoice no.">
            <Input
              className={fieldClass}
              name="supplier_invoice"
              placeholder="From supplier bill"
            />
          </Field>
        )}
      </div>
      <div className="line-items-head">
        <div>
          <strong>Items</strong>
          <span>Select a product from your catalogue</span>
        </div>
        <button type="button" onClick={addRow}>
          <Plus size={14} /> Add line
        </button>
      </div>
      <div className="line-list">
        {rows.map((id) => (
          <div className="line-row" key={id}>
            <div className="line-product">
              <label>PRODUCT</label>
              <select
                className={selectClass}
                name={`product_${id}`}
                required
                value={selected[id]?.id || ""}
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  setSelected((s) => ({ ...s, [id]: p }));
                  setPrice((s) => ({
                    ...s,
                    [id]: p
                      ? Number(invoice ? p.sale_price : p.purchase_price)
                      : 0,
                  }));
                }}
              >
                <option value="">Choose product</option>
                {products
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ·{" "}
                      {money(invoice ? p.sale_price : p.purchase_price)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label>QTY</label>
              <Input
                className={fieldClass}
                name={`qty_${id}`}
                required
                type="number"
                min="0.001"
                step="0.001"
                value={qty[id] ?? 1}
                onChange={(e) =>
                  setQty((s) => ({ ...s, [id]: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <label>RATE</label>
              <Input
                className={fieldClass}
                name={`price_${id}`}
                required
                type="number"
                min="0"
                step="0.01"
                value={
                  price[id] ??
                  (selected[id]
                    ? Number(
                        invoice
                          ? selected[id]?.sale_price
                          : selected[id]?.purchase_price,
                      )
                    : "")
                }
                onChange={(e) =>
                  setPrice((s) => ({ ...s, [id]: Number(e.target.value) }))
                }
              />
            </div>
            {invoice && (
              <div>
                <label>DISC. %</label>
                <Input
                  className={fieldClass}
                  name={`discount_${id}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discount[id] ?? 0}
                  onChange={(e) =>
                    setDiscount((s) => ({ ...s, [id]: Number(e.target.value) }))
                  }
                />
              </div>
            )}
            <div className="line-total">
              <label>GST</label>
              <span>{selected[id]?.gst_rate || 0}%</span>
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                className="remove-line"
                onClick={() => setRows((r) => r.filter((x) => x !== id))}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {invoice && (
        <div className="invoice-note">
          <label>Note on invoice</label>
          <Input
            className={fieldClass}
            name="notes"
            placeholder="Optional note for your customer"
          />
        </div>
      )}
      <div className="transaction-total">
        <div>
          <span>Estimated total including GST</span>
          <strong>{money(total)}</strong>
        </div>
        <p>Tax is calculated using each product’s saved GST rate.</p>
      </div>
      <ModalActions
        onCancel={onCancel}
        submit={invoice ? "Issue invoice" : "Save purchase"}
      />
    </form>
  );
}
function CheckItem({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="check-row">
      <div className={done ? "check-done" : "check-pending"}>
        {done ? <Check size={13} /> : <span />}
      </div>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
      <span className={done ? "check-status complete" : "check-status"}>
        {done ? "DONE" : "TODO"}
      </span>
    </div>
  );
}
function ShieldIcon() {
  return (
    <div className="shield-icon">
      <Check size={16} />
    </div>
  );
}
