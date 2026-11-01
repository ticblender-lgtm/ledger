"use client";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  HandCoins,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Search,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  Dictionary,
  Lang,
  dictionaries,
  isLang,
} from "@/lib/i18n";
import {
  ApiError,
  clearStoredToken,
  fetchLedgerData,
  getStoredToken,
  login as apiLogin,
  normalizeLedgerPayload,
  register as apiRegister,
  setStoredToken,
  syncLedgerData,
} from "@/lib/api";

type AccountKey = "bank" | "ewallet" | "cash";
type MovementType = "expense" | "income";
type ModalType =
  | MovementType
  | "loan_new"
  | "loan_collect"
  | "debt_new"
  | "debt_pay"
  | "edit";
type TransactionType =
  | MovementType
  | "loan"
  | "loan_collect"
  | "debt"
  | "debt_pay";
type TypeFilter = "all" | "expense" | "income" | "loans";
type AccountFilter = "all" | AccountKey;
type ReportPeriod = "month" | "year";

type Accounts = Record<AccountKey, number>;

type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  account: AccountKey;
  amount: number;
  type: TransactionType;
  relatedId?: string;
};

type Loan = {
  id: string;
  date: string;
  concept: string;
  counterparty: string;
  total: number;
  collected: number;
  account: AccountKey;
};

type Debt = {
  id: string;
  date: string;
  concept: string;
  creditor: string;
  total: number;
  paid: number;
  account: AccountKey;
};

type PersistedLedger = {
  accounts: Accounts;
  transactions: Transaction[];
  loans: Loan[];
  debts: Debt[];
  language?: Lang;
};

type TabId = "overview" | "transactions" | "loans" | "reports";
type LoanSection = "prestamos" | "deudas";

type MovementForm = {
  date: string;
  concept: string;
  account: AccountKey;
  amount: string;
};

type ObligationForm = {
  date: string;
  concept: string;
  person: string;
  account: AccountKey;
  amount: string;
  targetId: string;
};

type I18nContextValue = {
  lang: Lang;
  t: Dictionary;
  setLang: (lang: Lang) => void;
  formatCurrency: (value: number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nContext");
  }
  return ctx;
}

const TABS: TabId[] = ["overview", "transactions", "loans", "reports"];

const ACCOUNT_ICONS: Record<AccountKey, typeof Landmark> = {
  bank: Landmark,
  ewallet: Smartphone,
  cash: Banknote,
};

const ACCOUNT_OPTIONS: AccountKey[] = ["bank", "ewallet", "cash"];
const TYPE_FILTER_IDS: TypeFilter[] = ["all", "expense", "income", "loans"];
const ACCOUNT_FILTER_IDS: AccountFilter[] = [
  "all",
  "bank",
  "ewallet",
  "cash",
];
const STORAGE_KEY = "ledger.app.v1";
const DEFAULT_ACCOUNTS: Accounts = {
  bank: 0,
  ewallet: 0,
  cash: 0,
};

const INPUT_CLASS =
  "w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-500/30";

const SCROLLBAR_HIDE =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function isLoanFamily(type: TransactionType) {
  return (
    type === "loan" ||
    type === "loan_collect" ||
    type === "debt" ||
    type === "debt_pay"
  );
}

function loadPersistedLedger(): PersistedLedger | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedLedger>;
    if (!parsed.accounts || !parsed.transactions) return null;
    return {
      accounts: {
        bank: Number(parsed.accounts.bank) || 0,
        ewallet: Number(parsed.accounts.ewallet) || 0,
        cash: Number(parsed.accounts.cash) || 0,
      },
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
        : [],
      loans: Array.isArray(parsed.loans) ? parsed.loans : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      language: isLang(parsed.language) ? parsed.language : undefined,
    };
  } catch {
    return null;
  }
}

function savePersistedLedger(data: PersistedLedger) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createEmptyForm(date = ""): MovementForm {
  return {
    date,
    concept: "",
    account: "bank",
    amount: "",
  };
}

function createEmptyObligationForm(date = ""): ObligationForm {
  return {
    date,
    concept: "",
    person: "",
    account: "bank",
    amount: "",
    targetId: "",
  };
}

function formatCurrencyValue(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateLabel(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseAmount(raw: string) {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return NaN;
  return Number(normalized);
}

function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function remainingOf(total: number, settled: number) {
  return Math.max(0, total - settled);
}

function progressOf(total: number, settled: number) {
  if (total <= 0) return 0;
  return Math.min(100, (settled / total) * 100);
}

export default function Home() {
  const [accounts, setAccounts] = useState<Accounts>(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [lang, setLang] = useState<Lang>("es");
  const [storageReady, setStorageReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [authBooting, setAuthBooting] = useState(true);
  const [syncPending, setSyncPending] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loanSection, setLoanSection] = useState<LoanSection>("prestamos");
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MovementForm>(() => createEmptyForm(""));
  const [obligationForm, setObligationForm] = useState<ObligationForm>(() =>
    createEmptyObligationForm(""),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const modalTypeRef = useRef<ModalType | null>(null);
  const isClosingRef = useRef(false);
  const skipNextSyncRef = useRef(true);

  const t = dictionaries[lang];

  const formatCurrency = useCallback(
    (value: number) => formatCurrencyValue(value, lang),
    [lang],
  );

  const i18nValue = useMemo<I18nContextValue>(
    () => ({ lang, t, setLang, formatCurrency }),
    [lang, t, formatCurrency],
  );

  const applyLedgerPayload = useCallback(
    (payload: {
      accounts: Accounts;
      transactions: Transaction[];
      loans: Loan[];
      debts: Debt[];
    }) => {
      skipNextSyncRef.current = true;
      setAccounts(payload.accounts);
      setTransactions(payload.transactions);
      setLoans(payload.loans);
      setDebts(payload.debts);
    },
    [],
  );

  const loadRemoteLedger = useCallback(
    async (authToken: string) => {
      const remote = normalizeLedgerPayload(await fetchLedgerData(authToken));
      applyLedgerPayload({
        accounts: remote.accounts,
        transactions: remote.transactions as Transaction[],
        loans: remote.loans as Loan[],
        debts: remote.debts as Debt[],
      });
      setSyncPending(false);
    },
    [applyLedgerPayload],
  );

  useEffect(() => {
    modalTypeRef.current = modalType;
  }, [modalType]);

  useEffect(() => {
    isClosingRef.current = isClosing;
  }, [isClosing]);

  // Hydrate auth + data after mount (client-only).
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const saved = loadPersistedLedger();
      if (saved?.language) setLang(saved.language);

      const storedToken = getStoredToken();
      if (!storedToken) {
        if (saved) {
          applyLedgerPayload({
            accounts: saved.accounts,
            transactions: saved.transactions,
            loans: saved.loans,
            debts: saved.debts,
          });
        }
        if (!cancelled) {
          setToken(null);
          setStorageReady(true);
          setAuthBooting(false);
        }
        return;
      }

      try {
        await loadRemoteLedger(storedToken);
        if (!cancelled) setToken(storedToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearStoredToken();
          if (!cancelled) setToken(null);
        } else if (saved) {
          // API unreachable — keep working offline with local cache.
          applyLedgerPayload({
            accounts: saved.accounts,
            transactions: saved.transactions,
            loans: saved.loans,
            debts: saved.debts,
          });
          if (!cancelled) {
            setToken(storedToken);
            setSyncPending(true);
          }
        } else if (!cancelled) {
          setToken(storedToken);
        }
      } finally {
        if (!cancelled) {
          setStorageReady(true);
          setAuthBooting(false);
        }
      }
    }

    const frame = window.requestAnimationFrame(() => {
      void boot();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [applyLedgerPayload, loadRemoteLedger]);

  // Persist locally always; sync to API when authenticated.
  useEffect(() => {
    if (!storageReady) return;
    savePersistedLedger({
      accounts,
      transactions,
      loans,
      debts,
      language: lang,
    });

    if (!token) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void syncLedgerData(token, {
        accounts,
        transactions,
        loans,
        debts,
      })
        .then(() => setSyncPending(false))
        .catch((error) => {
          setSyncPending(true);
          if (error instanceof ApiError && error.status === 401) {
            clearStoredToken();
            setToken(null);
          }
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [accounts, transactions, loans, debts, lang, storageReady, token]);

  // Client-only date label — avoids unstable Date during prerender.
  useEffect(() => {
    if (!storageReady) return;
    const frame = window.requestAnimationFrame(() => {
      setTodayLabel(formatDateLabel(new Date(), lang));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lang, storageReady]);

  async function handleAuthSuccess(authToken: string) {
    setStoredToken(authToken);
    setToken(authToken);
    try {
      await loadRemoteLedger(authToken);
    } catch {
      // Keep any local state already loaded; mark sync pending.
      setSyncPending(true);
    }
  }

  function handleLogout() {
    clearStoredToken();
    setToken(null);
    skipNextSyncRef.current = true;
    setAccounts(DEFAULT_ACCOUNTS);
    setTransactions([]);
    setLoans([]);
    setDebts([]);
    setSyncPending(false);
    setActiveTab("overview");
  }

  const netWorth = useMemo(
    () => accounts.bank + accounts.ewallet + accounts.cash,
    [accounts],
  );

  const loanTotals = useMemo(() => {
    const total = loans.reduce((sum, loan) => sum + loan.total, 0);
    const collected = loans.reduce((sum, loan) => sum + loan.collected, 0);
    return {
      total,
      collected,
      remaining: remainingOf(total, collected),
    };
  }, [loans]);

  const debtTotals = useMemo(() => {
    const total = debts.reduce((sum, debt) => sum + debt.total, 0);
    const paid = debts.reduce((sum, debt) => sum + debt.paid, 0);
    return {
      total,
      paid,
      remaining: remainingOf(total, paid),
    };
  }, [debts]);

  const editingTx = editingId
    ? transactions.find((tx) => tx.id === editingId) ?? null
    : null;

  const amountValue = parseAmount(form.amount);
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const currentBalance = accounts[form.account];
  const editPreviewSign =
    modalType === "edit"
      ? editingTx?.type === "expense" ||
        editingTx?.type === "loan" ||
        editingTx?.type === "debt_pay"
        ? -1
        : 1
      : modalType === "expense"
        ? -1
        : 1;
  const signedDelta = hasValidAmount ? amountValue * editPreviewSign : 0;
  // For edit, preview accounts as if old impact is rolled back first.
  const previewBaseBalance =
    modalType === "edit" && editingTx
      ? editingTx.account === form.account
        ? currentBalance - editingTx.amount
        : currentBalance
      : currentBalance;
  const projectedBalance = previewBaseBalance + signedDelta;

  const filteredTransactions = useMemo(() => {
    const query = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter === "expense" && tx.type !== "expense") return false;
      if (typeFilter === "income" && tx.type !== "income") return false;
      if (typeFilter === "loans" && !isLoanFamily(tx.type)) return false;
      if (accountFilter !== "all" && tx.account !== accountFilter) return false;
      if (!query) return true;
      return (
        tx.description.toLowerCase().includes(query) ||
        tx.category.toLowerCase().includes(query)
      );
    });
  }, [transactions, txSearch, typeFilter, accountFilter]);

  const obligationAmount = parseAmount(obligationForm.amount);
  const hasValidObligationAmount =
    Number.isFinite(obligationAmount) && obligationAmount > 0;
  const obligationBalance = accounts[obligationForm.account];

  const selectedLoan = loans.find((loan) => loan.id === obligationForm.targetId);
  const selectedDebt = debts.find((debt) => debt.id === obligationForm.targetId);

  const openMovementModal = useCallback((type: MovementType) => {
    setEditingId(null);
    setForm(createEmptyForm(todayISO()));
    setFormError(null);
    setIsClosing(false);
    setModalType(type);
  }, []);

  const openEditModal = useCallback((tx: Transaction) => {
    setEditingId(tx.id);
    setForm({
      date: tx.date,
      concept: tx.description,
      account: tx.account,
      amount: String(Math.abs(tx.amount)),
    });
    setFormError(null);
    setIsClosing(false);
    setModalType("edit");
  }, []);

  const openObligationModal = useCallback(
    (
      type: Exclude<ModalType, MovementType | "edit">,
      presetTargetId = "",
    ) => {
      const openItems =
        type === "loan_collect"
          ? loans.filter((loan) => remainingOf(loan.total, loan.collected) > 0)
          : type === "debt_pay"
            ? debts.filter((debt) => remainingOf(debt.total, debt.paid) > 0)
            : [];

      setObligationForm({
        ...createEmptyObligationForm(todayISO()),
        targetId: presetTargetId || openItems[0]?.id || "",
        account: openItems[0]?.account ?? "bank",
      });
      setFormError(null);
      setIsClosing(false);
      setModalType(type);
      setActiveTab("loans");
      setLoanSection(
        type === "loan_new" || type === "loan_collect" ? "prestamos" : "deudas",
      );
    },
    [debts, loans],
  );

  const closeModal = useCallback(() => {
    if (!modalTypeRef.current || isClosingRef.current) return;
    setIsClosing(true);
    window.setTimeout(() => {
      setModalType(null);
      setEditingId(null);
      setIsClosing(false);
      setForm(createEmptyForm(""));
      setObligationForm(createEmptyObligationForm(""));
      setFormError(null);
    }, 180);
  }, []);

  function handleDateKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    source: "movement" | "obligation",
  ) {
    if (event.key !== "Enter") return;
    const current =
      source === "movement" ? form.date.trim() : obligationForm.date.trim();
    if (current !== "") return;
    event.preventDefault();
    if (source === "movement") {
      setForm((prev) => ({ ...prev, date: todayISO() }));
    } else {
      setObligationForm((prev) => ({ ...prev, date: todayISO() }));
    }
  }

  function appendTransaction(entry: Omit<Transaction, "id">) {
    setTransactions((prev) => [{ id: crypto.randomUUID(), ...entry }, ...prev]);
  }

  function applyAccountDelta(account: AccountKey, delta: number) {
    setAccounts((prev) => ({
      ...prev,
      [account]: prev[account] + delta,
    }));
  }

  function handleDeleteTransaction(id: string) {
    const tx = transactions.find((item) => item.id === id);
    if (!tx) return;

    if (tx.type === "loan" && tx.relatedId) {
      const loan = loans.find((item) => item.id === tx.relatedId);
      if (loan && loan.collected > 0) {
        window.alert(t.alertLoanHasCollections);
        return;
      }
    }
    if (tx.type === "debt" && tx.relatedId) {
      const debt = debts.find((item) => item.id === tx.relatedId);
      if (debt && debt.paid > 0) {
        window.alert(t.alertDebtHasPayments);
        return;
      }
    }

    // Reverse the signed cash impact.
    applyAccountDelta(tx.account, -tx.amount);

    if (tx.type === "loan" && tx.relatedId) {
      setLoans((prev) => prev.filter((loan) => loan.id !== tx.relatedId));
    }
    if (tx.type === "debt" && tx.relatedId) {
      setDebts((prev) => prev.filter((debt) => debt.id !== tx.relatedId));
    }
    if (tx.type === "loan_collect" && tx.relatedId) {
      setLoans((prev) =>
        prev.map((loan) =>
          loan.id === tx.relatedId
            ? {
                ...loan,
                collected: Math.max(0, loan.collected - Math.abs(tx.amount)),
              }
            : loan,
        ),
      );
    }
    if (tx.type === "debt_pay" && tx.relatedId) {
      setDebts((prev) =>
        prev.map((debt) =>
          debt.id === tx.relatedId
            ? { ...debt, paid: Math.max(0, debt.paid - Math.abs(tx.amount)) }
            : debt,
        ),
      );
    }

    setTransactions((prev) => prev.filter((item) => item.id !== id));
  }

  function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      modalType !== "expense" &&
      modalType !== "income" &&
      modalType !== "edit"
    ) {
      return;
    }

    const date = form.date.trim() || todayISO();
    const concept = form.concept.trim();
    const amount = parseAmount(form.amount);

    if (!isValidISODate(date)) {
      setFormError(t.errValidDate);
      return;
    }
    if (!concept) {
      setFormError(t.errConcept);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError(t.errAmount);
      return;
    }

    if (modalType === "edit" && editingTx) {
      const nextSign =
        editingTx.type === "expense" ||
        editingTx.type === "loan" ||
        editingTx.type === "debt_pay"
          ? -1
          : 1;
      const nextAmount = amount * nextSign;

      // Roll back previous impact, then apply the edited one.
      setAccounts((prev) => {
        const rolled = {
          ...prev,
          [editingTx.account]: prev[editingTx.account] - editingTx.amount,
        };
        return {
          ...rolled,
          [form.account]: rolled[form.account] + nextAmount,
        };
      });

      if (editingTx.type === "loan" && editingTx.relatedId) {
        const loan = loans.find((item) => item.id === editingTx.relatedId);
        if (loan && amount < loan.collected) {
          setFormError(t.errBelowCollected(formatCurrency(loan.collected)));
          return;
        }
        setLoans((prev) =>
          prev.map((item) =>
            item.id === editingTx.relatedId
              ? {
                  ...item,
                  concept: concept.includes(":")
                    ? concept.split(":").slice(1).join(":").trim() || item.concept
                    : concept,
                  total: amount,
                  account: form.account,
                  date,
                }
              : item,
          ),
        );
      }

      if (editingTx.type === "debt" && editingTx.relatedId) {
        const debt = debts.find((item) => item.id === editingTx.relatedId);
        if (debt && amount < debt.paid) {
          setFormError(t.errBelowPaid(formatCurrency(debt.paid)));
          return;
        }
        setDebts((prev) =>
          prev.map((item) =>
            item.id === editingTx.relatedId
              ? {
                  ...item,
                  concept: concept.includes(":")
                    ? concept.split(":").slice(1).join(":").trim() || item.concept
                    : concept,
                  total: amount,
                  account: form.account,
                  date,
                }
              : item,
          ),
        );
      }

      if (editingTx.type === "loan_collect" && editingTx.relatedId) {
        const loan = loans.find((item) => item.id === editingTx.relatedId);
        if (!loan) {
          setFormError(t.errLoanMissing);
          return;
        }
        const nextCollected =
          loan.collected - Math.abs(editingTx.amount) + amount;
        if (nextCollected < 0 || nextCollected > loan.total) {
          setFormError(t.errAbonoExceeds);
          return;
        }
        setLoans((prev) =>
          prev.map((item) =>
            item.id === editingTx.relatedId
              ? { ...item, collected: nextCollected }
              : item,
          ),
        );
      }

      if (editingTx.type === "debt_pay" && editingTx.relatedId) {
        const debt = debts.find((item) => item.id === editingTx.relatedId);
        if (!debt) {
          setFormError(t.errDebtMissing);
          return;
        }
        const nextPaid = debt.paid - Math.abs(editingTx.amount) + amount;
        if (nextPaid < 0 || nextPaid > debt.total) {
          setFormError(t.errPagoExceeds);
          return;
        }
        setDebts((prev) =>
          prev.map((item) =>
            item.id === editingTx.relatedId
              ? { ...item, paid: nextPaid }
              : item,
          ),
        );
      }

      setTransactions((prev) =>
        prev.map((item) =>
          item.id === editingTx.id
            ? {
                ...item,
                date,
                description: concept,
                account: form.account,
                amount: nextAmount,
              }
            : item,
        ),
      );
      closeModal();
      return;
    }

    const movementType: MovementType =
      modalType === "income" ? "income" : "expense";
    const signedAmount = movementType === "expense" ? -amount : amount;
    appendTransaction({
      date,
      description: concept,
      category:
        movementType === "expense" ? t.categoryExpense : t.categoryIncome,
      account: form.account,
      amount: signedAmount,
      type: movementType,
    });
    applyAccountDelta(form.account, signedAmount);
    closeModal();
  }

  function handleObligationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      modalType !== "loan_new" &&
      modalType !== "loan_collect" &&
      modalType !== "debt_new" &&
      modalType !== "debt_pay"
    ) {
      return;
    }

    const date = obligationForm.date.trim() || todayISO();
    const concept = obligationForm.concept.trim();
    const person = obligationForm.person.trim();
    const amount = parseAmount(obligationForm.amount);

    if (!isValidISODate(date)) {
      setFormError(t.errValidDate);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError(t.errAmount);
      return;
    }

    if (modalType === "loan_new") {
      if (!concept) {
        setFormError(t.errLoanConcept);
        return;
      }
      if (!person) {
        setFormError(t.errLoanPerson);
        return;
      }
      if (accounts[obligationForm.account] < amount) {
        setFormError(t.errInsufficient);
        return;
      }

      const loanId = crypto.randomUUID();
      const loan: Loan = {
        id: loanId,
        date,
        concept,
        counterparty: person,
        total: amount,
        collected: 0,
        account: obligationForm.account,
      };
      setLoans((prev) => [loan, ...prev]);
      applyAccountDelta(obligationForm.account, -amount);
      appendTransaction({
        date,
        description: t.txLoanTo(person, concept),
        category: t.categoryLoan,
        account: obligationForm.account,
        amount: -amount,
        type: "loan",
        relatedId: loanId,
      });
      closeModal();
      return;
    }

    if (modalType === "debt_new") {
      if (!concept) {
        setFormError(t.errDebtConcept);
        return;
      }
      if (!person) {
        setFormError(t.errDebtPerson);
        return;
      }

      const debtId = crypto.randomUUID();
      const debt: Debt = {
        id: debtId,
        date,
        concept,
        creditor: person,
        total: amount,
        paid: 0,
        account: obligationForm.account,
      };
      setDebts((prev) => [debt, ...prev]);
      applyAccountDelta(obligationForm.account, amount);
      appendTransaction({
        date,
        description: t.txDebtWith(person, concept),
        category: t.categoryDebt,
        account: obligationForm.account,
        amount,
        type: "debt",
        relatedId: debtId,
      });
      closeModal();
      return;
    }

    if (modalType === "loan_collect") {
      if (!selectedLoan) {
        setFormError(t.errSelectLoan);
        return;
      }
      const remaining = remainingOf(selectedLoan.total, selectedLoan.collected);
      if (amount > remaining) {
        setFormError(t.errExceedsRemaining(formatCurrency(remaining)));
        return;
      }

      setLoans((prev) =>
        prev.map((loan) =>
          loan.id === selectedLoan.id
            ? { ...loan, collected: loan.collected + amount }
            : loan,
        ),
      );
      applyAccountDelta(obligationForm.account, amount);
      appendTransaction({
        date,
        description: t.txCollectFrom(
          selectedLoan.counterparty,
          selectedLoan.concept,
        ),
        category: t.categoryLoanCollect,
        account: obligationForm.account,
        amount,
        type: "loan_collect",
        relatedId: selectedLoan.id,
      });
      closeModal();
      return;
    }

    if (modalType === "debt_pay") {
      if (!selectedDebt) {
        setFormError(t.errSelectDebt);
        return;
      }
      const remaining = remainingOf(selectedDebt.total, selectedDebt.paid);
      if (amount > remaining) {
        setFormError(t.errExceedsRemaining(formatCurrency(remaining)));
        return;
      }
      if (accounts[obligationForm.account] < amount) {
        setFormError(t.errInsufficient);
        return;
      }

      setDebts((prev) =>
        prev.map((debt) =>
          debt.id === selectedDebt.id
            ? { ...debt, paid: debt.paid + amount }
            : debt,
        ),
      );
      applyAccountDelta(obligationForm.account, -amount);
      appendTransaction({
        date,
        description: t.txPayTo(selectedDebt.creditor, selectedDebt.concept),
        category: t.categoryDebtPay,
        account: obligationForm.account,
        amount: -amount,
        type: "debt_pay",
        relatedId: selectedDebt.id,
      });
      closeModal();
    }
  }

  const headerCopy =
    activeTab === "loans"
      ? { title: t.loansTitle, hint: t.loansHint }
      : activeTab === "reports"
        ? { title: t.reportsTitle, hint: t.reportsHint }
        : activeTab === "transactions"
          ? { title: t.transactionsTitle, hint: t.transactionsHint }
          : { title: t.netWorth, hint: t.netWorthHint };

  if (authBooting) {
    return (
      <I18nContext.Provider value={i18nValue}>
        <div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-500">
          {t.authLoading}
        </div>
      </I18nContext.Provider>
    );
  }

  if (!token) {
    return (
      <I18nContext.Provider value={i18nValue}>
        <AuthScreen onSuccess={handleAuthSuccess} />
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={i18nValue}>
    <div className="relative min-h-screen bg-black text-zinc-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_55%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 pb-16 pt-4 sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
        {/* Top Bar */}
        <header className="sticky top-3 z-20 rounded-2xl border border-zinc-800/60 bg-zinc-950/70 px-3 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors sm:top-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:justify-start sm:gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-900/80">
                  <Wallet className="h-4 w-4 text-zinc-200" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h1 className="text-[17px] font-semibold tracking-tight text-zinc-50">
                    Ledger
                  </h1>
                  <p className="truncate text-xs text-zinc-500 sm:hidden">
                    {todayLabel}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="inline-flex rounded-full border border-zinc-800/80 bg-zinc-950/70 p-0.5">
                  {(["es", "en"] as Lang[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all ${
                        lang === code
                          ? "bg-zinc-100 text-zinc-950"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {code === "es" ? t.langEs : t.langEn}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  {t.authLogout}
                </button>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              {syncPending && (
                <span className="text-[11px] text-amber-400/90">
                  {t.syncOffline}
                </span>
              )}
              <p className="min-h-5 text-sm text-zinc-500">{todayLabel}</p>
            </div>
          </div>
          {syncPending && (
            <p className="mt-2 text-[11px] text-amber-400/90 sm:hidden">
              {t.syncOffline}
            </p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
            {ACCOUNT_OPTIONS.map((key) => {
              const Icon = ACCOUNT_ICONS[key];
              return (
                <div
                  key={key}
                  className="group flex min-w-0 items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/80"
                >
                  <Icon
                    className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300"
                    strokeWidth={1.75}
                  />
                  <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    {t.accountLabels[key]}
                  </span>
                  <span className="ml-auto font-mono text-[13px] tabular-nums text-zinc-100">
                    {formatCurrency(accounts[key])}
                  </span>
                </div>
              );
            })}
          </div>
        </header>

        {/* Navigation — horizontally scrollable on mobile */}
        <nav aria-label="Primary" className="w-full">
          <div
            className={`mx-auto w-full max-w-xl overflow-x-auto rounded-full border border-zinc-800/60 bg-zinc-950/60 p-1 backdrop-blur-md ${SCROLLBAR_HIDE}`}
          >
            <div className="flex min-w-max gap-1 sm:grid sm:min-w-0 sm:grid-cols-4">
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 sm:px-3 ${
                      isActive
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                    }`}
                  >
                    {t.tabs[tab]}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Dashboard Header */}
        <section className="rounded-3xl border border-zinc-800/60 bg-[#09090b] px-4 py-5 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                {headerCopy.title}
              </p>
              <p className="break-all font-mono text-3xl font-medium tracking-tight text-zinc-50 tabular-nums sm:text-5xl">
                {activeTab === "loans"
                  ? formatCurrency(loanTotals.remaining - debtTotals.remaining)
                  : formatCurrency(netWorth)}
              </p>
              <p className="text-sm text-zinc-500">{headerCopy.hint}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeTab === "loans" ? (
                <>
                  <QuickAction
                    label={t.addLoan}
                    icon={ArrowUpRight}
                    onClick={() => openObligationModal("loan_new")}
                  />
                  <QuickAction
                    label={t.addLoanCollect}
                    icon={HandCoins}
                    onClick={() => openObligationModal("loan_collect")}
                  />
                  <QuickAction
                    label={t.addDebt}
                    icon={ArrowDownLeft}
                    onClick={() => openObligationModal("debt_new")}
                  />
                  <QuickAction
                    label={t.addDebtPay}
                    icon={Plus}
                    onClick={() => openObligationModal("debt_pay")}
                  />
                </>
              ) : (
                <>
                  <QuickAction
                    label={t.addExpense}
                    icon={ArrowUpRight}
                    onClick={() => openMovementModal("expense")}
                  />
                  <QuickAction
                    label={t.addIncome}
                    icon={ArrowDownLeft}
                    onClick={() => openMovementModal("income")}
                  />
                  <QuickAction
                    label={t.addLoanDebt}
                    icon={Plus}
                    onClick={() => {
                      setActiveTab("loans");
                      setLoanSection("prestamos");
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        {activeTab === "loans" ? (
          <LoansDebtsView
            loans={loans}
            debts={debts}
            loanSection={loanSection}
            loanTotals={loanTotals}
            debtTotals={debtTotals}
            onSectionChange={setLoanSection}
            onCollect={(loanId) => openObligationModal("loan_collect", loanId)}
            onPay={(debtId) => openObligationModal("debt_pay", debtId)}
            onNewLoan={() => openObligationModal("loan_new")}
            onNewDebt={() => openObligationModal("debt_new")}
          />
        ) : null}

        {activeTab === "transactions" ? (
          <TransactionsView
            transactions={filteredTransactions}
            totalCount={transactions.length}
            search={txSearch}
            typeFilter={typeFilter}
            accountFilter={accountFilter}
            onSearchChange={setTxSearch}
            onTypeFilterChange={setTypeFilter}
            onAccountFilterChange={setAccountFilter}
            onEdit={openEditModal}
            onDelete={handleDeleteTransaction}
          />
        ) : null}

        {activeTab === "reports" ? (
          <ReportsView
            transactions={transactions}
            period={reportPeriod}
            onPeriodChange={setReportPeriod}
          />
        ) : null}

        {activeTab === "overview" ? (
          <section className="overflow-hidden rounded-3xl border border-zinc-800/60 bg-[#09090b]">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800/60 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-zinc-100">
                  {t.recentActivity}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {transactions.length === 0
                    ? t.noMovements
                    : t.movementsCount(transactions.length)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("transactions")}
                className="shrink-0 rounded-full border border-zinc-800/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
              >
                {t.viewAll}
              </button>
            </div>

            {transactions.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="space-y-2 p-3 sm:hidden">
                  {transactions.slice(0, 8).map((tx) => (
                    <TransactionCard key={tx.id} tx={tx} />
                  ))}
                </div>
                <div className={`hidden overflow-x-auto sm:block ${SCROLLBAR_HIDE}`}>
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800/60 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                        <th className="px-5 py-3 font-medium sm:px-6">
                          {t.dateCol}
                        </th>
                        <th className="px-5 py-3 font-medium sm:px-6">
                          {t.descriptionCol}
                        </th>
                        <th className="px-5 py-3 font-medium sm:px-6">
                          {t.categoryCol}
                        </th>
                        <th className="px-5 py-3 font-medium sm:px-6">
                          {t.accountCol}
                        </th>
                        <th className="px-5 py-3 text-right font-medium sm:px-6">
                          {t.amountCol}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 8).map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-zinc-800/40 transition-colors last:border-0 hover:bg-zinc-900/40"
                        >
                          <td className="px-5 py-3.5 text-zinc-400 sm:px-6">
                            {tx.date}
                          </td>
                          <td className="px-5 py-3.5 text-zinc-100 sm:px-6">
                            {tx.description}
                          </td>
                          <td className="px-5 py-3.5 text-zinc-400 sm:px-6">
                            {tx.category}
                          </td>
                          <td className="px-5 py-3.5 text-zinc-400 sm:px-6">
                            {t.accountShort[tx.account]}
                          </td>
                          <td
                            className={`px-5 py-3.5 text-right font-mono tabular-nums sm:px-6 ${
                              tx.amount >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>

      {(modalType === "expense" ||
        modalType === "income" ||
        modalType === "edit") && (
        <MovementModal
          type={editPreviewSign < 0 ? "expense" : "income"}
          mode={modalType === "edit" ? "edit" : "create"}
          form={form}
          formError={formError}
          isClosing={isClosing}
          currentBalance={previewBaseBalance}
          projectedBalance={projectedBalance}
          hasValidAmount={hasValidAmount}
          onClose={closeModal}
          onSubmit={handleMovementSubmit}
          onDateKeyDown={(event) => handleDateKeyDown(event, "movement")}
          onChange={(patch) => {
            setFormError(null);
            setForm((prev) => ({ ...prev, ...patch }));
          }}
        />
      )}

      {(modalType === "loan_new" ||
        modalType === "loan_collect" ||
        modalType === "debt_new" ||
        modalType === "debt_pay") && (
        <ObligationModal
          type={modalType}
          form={obligationForm}
          formError={formError}
          isClosing={isClosing}
          loans={loans}
          debts={debts}
          currentBalance={obligationBalance}
          amountValue={hasValidObligationAmount ? obligationAmount : 0}
          hasValidAmount={hasValidObligationAmount}
          onClose={closeModal}
          onSubmit={handleObligationSubmit}
          onDateKeyDown={(event) => handleDateKeyDown(event, "obligation")}
          onChange={(patch) => {
            setFormError(null);
            setObligationForm((prev) => ({ ...prev, ...patch }));
          }}
        />
      )}
    </div>
    </I18nContext.Provider>
  );
}

function AuthScreen({
  onSuccess,
}: {
  onSuccess: (token: string) => Promise<void>;
}) {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t.authErrEmail);
      return;
    }
    if (password.length < 8) {
      setError(t.authErrPassword);
      return;
    }

    setLoading(true);
    try {
      const auth =
        mode === "login"
          ? await apiLogin(trimmedEmail, password)
          : await apiRegister(trimmedEmail, password);
      await onSuccess(auth.token);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(t.authErrNetwork);
      } else if (err instanceof ApiError) {
        setError(err.message || t.authErrGeneric);
      } else {
        setError(t.authErrGeneric);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-end justify-center bg-black px-4 pb-0 text-zinc-50 sm:items-center sm:pb-8 sm:pt-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.07),_transparent_55%)]"
      />

      <div className="relative w-full max-w-md origin-bottom rounded-t-2xl border border-zinc-800/80 bg-zinc-900 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:rounded-2xl sm:p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700/80 sm:hidden" />

        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-950/80">
              <Wallet className="h-4 w-4 text-zinc-200" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
                Ledger
              </h1>
              <p className="text-xs text-zinc-500">{t.authSubtitle}</p>
            </div>
          </div>

          <div className="inline-flex rounded-full border border-zinc-800/80 bg-zinc-950/70 p-0.5">
            {(["es", "en"] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all ${
                  lang === code
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {code === "es" ? t.langEs : t.langEn}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/60 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.authLogin}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-all ${
              mode === "register"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.authRegister}
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">
              {t.authEmail}
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.authEmailPh}
              className={INPUT_CLASS}
              disabled={loading}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">
              {t.authPassword}
            </span>
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t.authPasswordPh}
              className={INPUT_CLASS}
              disabled={loading}
            />
          </label>

          {error && (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? t.authLoading
              : mode === "login"
                ? t.authSubmitLogin
                : t.authSubmitRegister}
          </button>
        </form>
      </div>
    </div>
  );
}

function TransactionCard({
  tx,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
}) {
  const { t, formatCurrency } = useI18n();
  return (
    <article className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">
            {tx.description}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {tx.date} · {t.accountShort[tx.account]} · {tx.category}
          </p>
        </div>
        <p
          className={`shrink-0 font-mono text-sm tabular-nums ${
            tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatCurrency(tx.amount)}
        </p>
      </div>
      {(onEdit || onDelete) && (
        <div className="mt-3 flex items-center justify-end gap-1.5">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(tx)}
              className="rounded-lg border border-zinc-800/70 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-950 hover:text-zinc-100"
              aria-label={t.editTx}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.deleteConfirm)) onDelete(tx.id);
              }}
              className="rounded-lg border border-zinc-800/70 p-1.5 text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
              aria-label={t.deleteTx}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function LoansDebtsView({
  loans,
  debts,
  loanSection,
  loanTotals,
  debtTotals,
  onSectionChange,
  onCollect,
  onPay,
  onNewLoan,
  onNewDebt,
}: {
  loans: Loan[];
  debts: Debt[];
  loanSection: LoanSection;
  loanTotals: { total: number; collected: number; remaining: number };
  debtTotals: { total: number; paid: number; remaining: number };
  onSectionChange: (section: LoanSection) => void;
  onCollect: (loanId: string) => void;
  onPay: (debtId: string) => void;
  onNewLoan: () => void;
  onNewDebt: () => void;
}) {
  const { t, formatCurrency } = useI18n();

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryStat
          label={t.toCollect}
          value={loanTotals.remaining}
          hint={t.collectedOf(
            formatCurrency(loanTotals.collected),
            formatCurrency(loanTotals.total),
          )}
          accent="text-emerald-400"
        />
        <SummaryStat
          label={t.toPay}
          value={debtTotals.remaining}
          hint={t.paidOf(
            formatCurrency(debtTotals.paid),
            formatCurrency(debtTotals.total),
          )}
          accent="text-rose-400"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800/60 bg-[#09090b]">
        <div className="flex flex-col gap-3 border-b border-zinc-800/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">
              {t.loansDebtsHeading}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{t.loansDebtsSub}</p>
          </div>

          <div className="inline-flex self-start rounded-full border border-zinc-800/80 bg-zinc-950/60 p-1">
            <button
              type="button"
              onClick={() => onSectionChange("prestamos")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                loanSection === "prestamos"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.prestamos}
            </button>
            <button
              type="button"
              onClick={() => onSectionChange("deudas")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                loanSection === "deudas"
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.deudas}
            </button>
          </div>
        </div>

        {loanSection === "prestamos" ? (
          loans.length === 0 ? (
            <ObligationEmpty
              title={t.noLoansTitle}
              body={t.noLoansBody}
              actionLabel={t.addLoan}
              onAction={onNewLoan}
            />
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {loans.map((loan) => {
                const remaining = remainingOf(loan.total, loan.collected);
                const progress = progressOf(loan.total, loan.collected);
                const settled = remaining === 0;
                return (
                  <article
                    key={loan.id}
                    className="px-4 py-4 transition-colors hover:bg-zinc-900/30 sm:px-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-zinc-100">
                            {loan.concept}
                          </h3>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
                              settled
                                ? "border-emerald-500/30 text-emerald-400"
                                : "border-zinc-800/80 text-zinc-500"
                            }`}
                          >
                            {settled ? t.settled : t.open}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {loan.counterparty} · {loan.date} ·{" "}
                          {t.accountShort[loan.account]}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-mono text-sm tabular-nums text-zinc-100">
                          {formatCurrency(remaining)}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {t.remaining}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                        <div
                          className="h-full rounded-full bg-emerald-400/80 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[11px] tabular-nums text-zinc-500">
                          {formatCurrency(loan.collected)} {t.of}{" "}
                          {formatCurrency(loan.total)}
                        </p>
                        {!settled && (
                          <button
                            type="button"
                            onClick={() => onCollect(loan.id)}
                            className="text-[11px] font-medium text-zinc-300 transition-colors hover:text-zinc-50"
                          >
                            {t.abono}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : debts.length === 0 ? (
          <ObligationEmpty
            title={t.noDebtsTitle}
            body={t.noDebtsBody}
            actionLabel={t.addDebt}
            onAction={onNewDebt}
          />
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {debts.map((debt) => {
              const remaining = remainingOf(debt.total, debt.paid);
              const progress = progressOf(debt.total, debt.paid);
              const settled = remaining === 0;
              return (
                <article
                  key={debt.id}
                  className="px-4 py-4 transition-colors hover:bg-zinc-900/30 sm:px-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-zinc-100">
                          {debt.concept}
                        </h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
                            settled
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-zinc-800/80 text-zinc-500"
                          }`}
                        >
                          {settled ? t.settled : t.open}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {debt.creditor} · {debt.date} ·{" "}
                        {t.accountShort[debt.account]}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-sm tabular-nums text-zinc-100">
                        {formatCurrency(remaining)}
                      </p>
                      <p className="text-[11px] text-zinc-500">{t.remaining}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                      <div
                        className="h-full rounded-full bg-rose-400/80 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[11px] tabular-nums text-zinc-500">
                        {formatCurrency(debt.paid)} {t.of}{" "}
                        {formatCurrency(debt.total)}
                      </p>
                      {!settled && (
                        <button
                          type="button"
                          onClick={() => onPay(debt.id)}
                          className="text-[11px] font-medium text-zinc-300 transition-colors hover:text-zinc-50"
                        >
                          {t.pago}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  const { formatCurrency } = useI18n();
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 break-all font-mono text-2xl tabular-nums ${accent}`}>
        {formatCurrency(value)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function ObligationEmpty({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-950/80">
        <HandCoins className="h-5 w-5 text-zinc-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-zinc-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
        {body}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-full border border-zinc-800/80 bg-zinc-950/60 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function ModalShell({
  title,
  eyebrow,
  isClosing,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  isClosing: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const { t } = useI18n();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 ${
        isClosing ? "pointer-events-none" : ""
      }`}
      role="presentation"
    >
      <button
        type="button"
        aria-label={t.closeDialog}
        className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative max-h-[92vh] w-full max-w-md origin-bottom overflow-y-auto rounded-t-2xl border border-zinc-800/80 bg-zinc-900 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-all duration-200 sm:origin-center sm:rounded-2xl sm:p-6 ${
          isClosing
            ? "translate-y-3 scale-[0.98] opacity-0 sm:translate-y-2"
            : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700/80 sm:hidden" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              {eyebrow}
            </p>
            <h2
              id={titleId}
              className="mt-1 text-lg font-semibold tracking-tight text-zinc-50"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-950 hover:text-zinc-100"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AccountSelector({
  value,
  onChange,
  label,
}: {
  value: AccountKey;
  onChange: (account: AccountKey) => void;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-zinc-400">
        {label ?? t.account}
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/60 p-1">
        {ACCOUNT_OPTIONS.map((key) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`rounded-full px-1.5 py-2 text-[11px] font-medium transition-all duration-200 sm:px-2 sm:text-sm ${
                selected
                  ? "bg-zinc-100 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {t.accountShort[key]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function BalancePreview({
  currentBalance,
  projectedBalance,
  hasValidAmount,
  accentClass,
}: {
  currentBalance: number;
  projectedBalance: number;
  hasValidAmount: boolean;
  accentClass: string;
}) {
  const { t, formatCurrency } = useI18n();
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {t.balancePreview}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
        {t.balanceCurrent}:{" "}
        <span className="font-mono tabular-nums text-zinc-100">
          {formatCurrency(currentBalance)}
        </span>
        <span className="mx-1.5 text-zinc-600">→</span>
        {t.balanceFinal}:{" "}
        <span
          className={`font-mono tabular-nums ${
            hasValidAmount ? accentClass : "text-zinc-100"
          }`}
        >
          {formatCurrency(projectedBalance)}
        </span>
      </p>
    </div>
  );
}

function MovementModal({
  type,
  mode = "create",
  form,
  formError,
  isClosing,
  currentBalance,
  projectedBalance,
  hasValidAmount,
  onClose,
  onSubmit,
  onDateKeyDown,
  onChange,
}: {
  type: MovementType;
  mode?: "create" | "edit";
  form: MovementForm;
  formError: string | null;
  isClosing: boolean;
  currentBalance: number;
  projectedBalance: number;
  hasValidAmount: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDateKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onChange: (patch: Partial<MovementForm>) => void;
}) {
  const { t } = useI18n();
  const conceptRef = useRef<HTMLInputElement>(null);
  const isExpense = type === "expense";
  const isEdit = mode === "edit";

  useEffect(() => {
    const timer = window.setTimeout(() => conceptRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ModalShell
      title={
        isEdit
          ? t.editTransaction
          : isExpense
            ? t.newExpense
            : t.newIncome
      }
      eyebrow={isEdit ? t.modifyRecord : isExpense ? t.expense : t.income}
      isClosing={isClosing}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">{t.date}</span>
          <input
            type="date"
            value={form.date}
            onChange={(event) => onChange({ date: event.target.value })}
            onKeyDown={onDateKeyDown}
            onBlur={() => {
              if (!form.date.trim()) onChange({ date: todayISO() });
            }}
            className={`${INPUT_CLASS} [color-scheme:dark]`}
          />
          <span className="block text-[11px] text-zinc-600">{t.dateHint}</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">{t.concept}</span>
          <input
            ref={conceptRef}
            type="text"
            value={form.concept}
            onChange={(event) => onChange({ concept: event.target.value })}
            placeholder={
              isExpense ? t.placeholderExpense : t.placeholderIncome
            }
            className={INPUT_CLASS}
            autoComplete="off"
          />
        </label>

        <AccountSelector
          value={form.account}
          onChange={(account) => onChange({ account })}
        />

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">{t.amount}</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => onChange({ amount: event.target.value })}
              placeholder="0.00"
              className={`${INPUT_CLASS} pl-7 font-mono tabular-nums`}
            />
          </div>
        </label>

        <BalancePreview
          currentBalance={currentBalance}
          projectedBalance={projectedBalance}
          hasValidAmount={hasValidAmount}
          accentClass={isExpense ? "text-rose-400" : "text-emerald-400"}
        />

        {formError && (
          <p className="text-sm text-rose-400" role="alert">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-950 hover:text-zinc-50"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            className="flex-1 rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-white active:scale-[0.98]"
          >
            {isEdit
              ? t.saveChanges
              : isExpense
                ? t.registerExpense
                : t.registerIncome}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function TransactionsView({
  transactions,
  totalCount,
  search,
  typeFilter,
  accountFilter,
  onSearchChange,
  onTypeFilterChange,
  onAccountFilterChange,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  totalCount: number;
  search: string;
  typeFilter: TypeFilter;
  accountFilter: AccountFilter;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  onAccountFilterChange: (value: AccountFilter) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const { t, formatCurrency } = useI18n();
  const typeOptions = TYPE_FILTER_IDS.map((id) => ({
    id,
    label: t.typeFilters[id],
  }));
  const accountOptions = ACCOUNT_FILTER_IDS.map((id) => ({
    id,
    label: id === "all" ? t.filterAll : t.accountShort[id],
  }));

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800/60 bg-[#09090b]">
      <div className="space-y-4 border-b border-zinc-800/60 px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">
            {t.registroGeneral}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {t.showingOf(transactions.length, totalCount)}
          </p>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t.searchPlaceholder}
            className={`${INPUT_CLASS} pl-10`}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SegmentedFilters
            label={t.filterType}
            options={typeOptions}
            value={typeFilter}
            onChange={onTypeFilterChange}
          />
          <SegmentedFilters
            label={t.filterAccount}
            options={accountOptions}
            value={accountFilter}
            onChange={onAccountFilterChange}
          />
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm text-zinc-400">{t.noMatching}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 p-3 sm:hidden">
            {transactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
          <div className={`hidden overflow-x-auto sm:block ${SCROLLBAR_HIDE}`}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                  <th className="px-5 py-3 font-medium sm:px-6">{t.dateCol}</th>
                  <th className="px-5 py-3 font-medium sm:px-6">
                    {t.descriptionCol}
                  </th>
                  <th className="px-5 py-3 font-medium sm:px-6">
                    {t.categoryCol}
                  </th>
                  <th className="px-5 py-3 font-medium sm:px-6">
                    {t.accountCol}
                  </th>
                  <th className="px-5 py-3 text-right font-medium sm:px-6">
                    {t.amountCol}
                  </th>
                  <th className="px-5 py-3 text-right font-medium sm:px-6">
                    {t.actionsCol}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-zinc-800/40 transition-colors last:border-0 hover:bg-zinc-900/40"
                  >
                    <td className="px-5 py-3.5 text-zinc-400 sm:px-6">
                      {tx.date}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-100 sm:px-6">
                      {tx.description}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 sm:px-6">
                      {tx.category}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 sm:px-6">
                      {t.accountShort[tx.account]}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right font-mono tabular-nums sm:px-6 ${
                        tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3.5 sm:px-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEdit(tx)}
                          className="rounded-lg border border-zinc-800/70 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-950 hover:text-zinc-100"
                          aria-label={t.editTx}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t.deleteConfirm)) {
                              onDelete(tx.id);
                            }
                          }}
                          className="rounded-lg border border-zinc-800/70 p-1.5 text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                          aria-label={t.deleteTx}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SegmentedFilters<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <div
        className={`flex gap-1 overflow-x-auto rounded-full border border-zinc-800/80 bg-zinc-950/60 p-1 ${SCROLLBAR_HIDE}`}
      >
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:text-sm ${
                selected
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportsView({
  transactions,
  period,
  onPeriodChange,
}: {
  transactions: Transaction[];
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
}) {
  const { t, lang, formatCurrency } = useI18n();

  const summary = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const inScope = transactions.filter((tx) => {
      const date = new Date(`${tx.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      if (period === "year") return date.getFullYear() === year;
      return date.getFullYear() === year && date.getMonth() === month;
    });

    const income = inScope
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
    const expenses = inScope
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const spendByAccount: Accounts = { bank: 0, ewallet: 0, cash: 0 };
    for (const tx of inScope) {
      if (tx.type === "expense") {
        spendByAccount[tx.account] += Math.abs(tx.amount);
      }
    }

    const net = income - expenses;
    const daysInPeriod =
      period === "year"
        ? 365 + (isLeapYear(year) ? 1 : 0)
        : new Date(year, month + 1, 0).getDate();
    const elapsedDays =
      period === "year"
        ? dayOfYear(now)
        : Math.min(now.getDate(), daysInPeriod);
    const avgDaily = elapsedDays > 0 ? expenses / elapsedDays : 0;
    const savingsRate = income > 0 ? (net / income) * 100 : 0;
    const spendTotal =
      spendByAccount.bank + spendByAccount.ewallet + spendByAccount.cash;

    return {
      income,
      expenses,
      net,
      avgDaily,
      savingsRate,
      spendByAccount,
      spendTotal,
      count: inScope.length,
      label:
        period === "year"
          ? String(year)
          : now.toLocaleString(lang === "es" ? "es-ES" : "en-US", {
              month: "long",
              year: "numeric",
            }),
    };
  }, [transactions, period, lang]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {t.period}
          </p>
          <p className="mt-0.5 text-sm capitalize text-zinc-200">
            {summary.label}
          </p>
        </div>
        <div className="inline-flex self-start rounded-full border border-zinc-800/80 bg-zinc-950/60 p-1">
          <button
            type="button"
            onClick={() => onPeriodChange("month")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              period === "month"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.monthly}
          </button>
          <button
            type="button"
            onClick={() => onPeriodChange("year")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              period === "year"
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.annual}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label={t.totalIncome}
          value={summary.income}
          hint={t.movementsInScope(summary.count)}
          accent="text-emerald-400"
        />
        <SummaryStat
          label={t.totalExpenses}
          value={summary.expenses}
          hint={t.expenseCategoryOnly}
          accent="text-rose-400"
        />
        <SummaryStat
          label={t.netCashFlow}
          value={summary.net}
          hint={summary.net >= 0 ? t.surplus : t.deficit}
          accent={summary.net >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {t.avgDaily}
          </p>
          <p className="mt-1 break-all font-mono text-2xl tabular-nums text-zinc-100">
            {formatCurrency(summary.avgDaily)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {t.avgDailyHint(
              period === "year" ? t.periodYear : t.periodMonth,
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {t.savingsRate}
          </p>
          <p
            className={`mt-1 font-mono text-2xl tabular-nums ${
              summary.savingsRate >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {summary.savingsRate.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-zinc-500">{t.savingsRateHint}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800/60 bg-[#09090b] px-4 py-5 sm:px-6">
        <h3 className="text-sm font-medium text-zinc-100">
          {t.spendingByAccount}
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500">{t.spendingByAccountHint}</p>

        <div className="mt-5 space-y-4">
          {ACCOUNT_OPTIONS.map((key) => {
            const value = summary.spendByAccount[key];
            const pct =
              summary.spendTotal > 0 ? (value / summary.spendTotal) * 100 : 0;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{t.accountShort[key]}</span>
                  <span className="font-mono tabular-nums text-zinc-100">
                    {formatCurrency(value)}
                    <span className="ml-2 text-xs text-zinc-500">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                  <div
                    className="h-full rounded-full bg-zinc-200/80 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function ObligationModal({
  type,
  form,
  formError,
  isClosing,
  loans,
  debts,
  currentBalance,
  amountValue,
  hasValidAmount,
  onClose,
  onSubmit,
  onDateKeyDown,
  onChange,
}: {
  type: Exclude<ModalType, MovementType | "edit">;
  form: ObligationForm;
  formError: string | null;
  isClosing: boolean;
  loans: Loan[];
  debts: Debt[];
  currentBalance: number;
  amountValue: number;
  hasValidAmount: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDateKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onChange: (patch: Partial<ObligationForm>) => void;
}) {
  const { t, formatCurrency } = useI18n();
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const meta = {
    loan_new: {
      title: t.newLoan,
      eyebrow: t.moneyLent,
      submit: t.registerLoan,
      accountLabel: t.sourceAccount,
      delta: -1 as const,
      accent: "text-rose-400",
    },
    loan_collect: {
      title: t.loanCollect,
      eyebrow: t.collection,
      submit: t.registerCollect,
      accountLabel: t.depositTo,
      delta: 1 as const,
      accent: "text-emerald-400",
    },
    debt_new: {
      title: t.newDebt,
      eyebrow: t.moneyBorrowed,
      submit: t.registerDebt,
      accountLabel: t.fundsLanded,
      delta: 1 as const,
      accent: "text-emerald-400",
    },
    debt_pay: {
      title: t.debtPay,
      eyebrow: t.payment,
      submit: t.registerPay,
      accountLabel: t.payFrom,
      delta: -1 as const,
      accent: "text-rose-400",
    },
  }[type];

  const openLoans = loans.filter(
    (loan) => remainingOf(loan.total, loan.collected) > 0,
  );
  const openDebts = debts.filter(
    (debt) => remainingOf(debt.total, debt.paid) > 0,
  );
  const selectedLoan = loans.find((loan) => loan.id === form.targetId);
  const selectedDebt = debts.find((debt) => debt.id === form.targetId);
  const remaining =
    type === "loan_collect" && selectedLoan
      ? remainingOf(selectedLoan.total, selectedLoan.collected)
      : type === "debt_pay" && selectedDebt
        ? remainingOf(selectedDebt.total, selectedDebt.paid)
        : null;

  const projectedBalance =
    currentBalance + (hasValidAmount ? amountValue * meta.delta : 0);

  useEffect(() => {
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <ModalShell
      title={meta.title}
      eyebrow={meta.eyebrow}
      isClosing={isClosing}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">{t.date}</span>
          <input
            type="date"
            value={form.date}
            onChange={(event) => onChange({ date: event.target.value })}
            onKeyDown={onDateKeyDown}
            onBlur={() => {
              if (!form.date.trim()) onChange({ date: todayISO() });
            }}
            className={`${INPUT_CLASS} [color-scheme:dark]`}
          />
        </label>

        {type === "loan_new" || type === "debt_new" ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                {t.concept}
              </span>
              <input
                ref={firstFieldRef as RefObject<HTMLInputElement>}
                type="text"
                value={form.concept}
                onChange={(event) => onChange({ concept: event.target.value })}
                placeholder={
                  type === "loan_new" ? t.loanConceptPh : t.debtConceptPh
                }
                className={INPUT_CLASS}
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                {type === "loan_new" ? t.counterparty : t.creditor}
              </span>
              <input
                type="text"
                value={form.person}
                onChange={(event) => onChange({ person: event.target.value })}
                placeholder={
                  type === "loan_new" ? t.counterpartyPh : t.creditorPh
                }
                className={INPUT_CLASS}
                autoComplete="off"
              />
            </label>
          </>
        ) : (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">
              {type === "loan_collect" ? t.prestamos : t.deudas}
            </span>
            <select
              ref={firstFieldRef as RefObject<HTMLSelectElement>}
              value={form.targetId}
              onChange={(event) => onChange({ targetId: event.target.value })}
              className={INPUT_CLASS}
            >
              <option value="">
                {type === "loan_collect"
                  ? openLoans.length
                    ? t.selectLoan
                    : t.noOpenLoans
                  : openDebts.length
                    ? t.selectDebt
                    : t.noOpenDebts}
              </option>
              {(type === "loan_collect" ? openLoans : openDebts).map((item) => {
                if (type === "loan_collect") {
                  const loan = item as Loan;
                  return (
                    <option key={loan.id} value={loan.id}>
                      {loan.concept} · {loan.counterparty} (
                      {formatCurrency(remainingOf(loan.total, loan.collected))}{" "}
                      {t.remaining})
                    </option>
                  );
                }
                const debt = item as Debt;
                return (
                  <option key={debt.id} value={debt.id}>
                    {debt.concept} · {debt.creditor} (
                    {formatCurrency(remainingOf(debt.total, debt.paid))}{" "}
                    {t.remaining})
                  </option>
                );
              })}
            </select>
            {remaining !== null && (
              <span className="block font-mono text-[11px] tabular-nums text-zinc-500">
                {t.remainingLabel(formatCurrency(remaining))}
              </span>
            )}
          </label>
        )}

        <AccountSelector
          value={form.account}
          onChange={(account) => onChange({ account })}
          label={meta.accountLabel}
        />

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">{t.amount}</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => onChange({ amount: event.target.value })}
              placeholder="0.00"
              className={`${INPUT_CLASS} pl-7 font-mono tabular-nums`}
            />
          </div>
        </label>

        <BalancePreview
          currentBalance={currentBalance}
          projectedBalance={projectedBalance}
          hasValidAmount={hasValidAmount}
          accentClass={meta.accent}
        />

        {formError && (
          <p className="text-sm text-rose-400" role="alert">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-950 hover:text-zinc-50"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            className="flex-1 rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-all hover:bg-white active:scale-[0.98]"
          >
            {meta.submit}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-200 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50 active:scale-[0.98] sm:px-3.5 sm:text-sm"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-950/80">
        <Receipt className="h-5 w-5 text-zinc-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-zinc-100">
        {t.emptyActivityTitle}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
        {t.emptyActivityBody}
      </p>

      <div className="mt-8 hidden w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800/40 sm:block">
        <div className="grid grid-cols-5 gap-0 border-b border-zinc-800/40 bg-zinc-950/50 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">
          <span>{t.dateCol}</span>
          <span className="col-span-2">{t.descriptionCol}</span>
          <span>{t.accountCol}</span>
          <span className="text-right">{t.amountCol}</span>
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="grid grid-cols-5 items-center gap-0 border-b border-zinc-800/30 px-4 py-3.5 last:border-0"
          >
            <div className="h-2 w-14 rounded-full bg-zinc-800/70" />
            <div className="col-span-2 h-2 w-28 rounded-full bg-zinc-800/50" />
            <div className="h-2 w-16 rounded-full bg-zinc-800/50" />
            <div className="ml-auto h-2 w-12 rounded-full bg-zinc-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
