export type Lang = "es" | "en";

export type Dictionary = {
  tabs: Record<"overview" | "transactions" | "loans" | "reports", string>;
  accountLabels: Record<"bank" | "ewallet" | "cash", string>;
  accountShort: Record<"bank" | "ewallet" | "cash", string>;
  typeFilters: Record<"all" | "expense" | "income" | "loans", string>;
  filterAll: string;
  langEs: string;
  langEn: string;
  netWorth: string;
  netWorthHint: string;
  loansTitle: string;
  loansHint: string;
  reportsTitle: string;
  reportsHint: string;
  transactionsTitle: string;
  transactionsHint: string;
  recentActivity: string;
  noMovements: string;
  movementsCount: (n: number) => string;
  viewAll: string;
  addExpense: string;
  addIncome: string;
  addLoanDebt: string;
  addLoan: string;
  addLoanCollect: string;
  addDebt: string;
  addDebtPay: string;
  newExpense: string;
  newIncome: string;
  editTransaction: string;
  modifyRecord: string;
  expense: string;
  income: string;
  date: string;
  dateHint: string;
  concept: string;
  account: string;
  amount: string;
  balancePreview: string;
  balanceCurrent: string;
  balanceFinal: string;
  cancel: string;
  saveChanges: string;
  registerExpense: string;
  registerIncome: string;
  placeholderExpense: string;
  placeholderIncome: string;
  closeDialog: string;
  registroGeneral: string;
  showingOf: (shown: number, total: number) => string;
  searchPlaceholder: string;
  filterType: string;
  filterAccount: string;
  noMatching: string;
  dateCol: string;
  descriptionCol: string;
  categoryCol: string;
  accountCol: string;
  amountCol: string;
  actionsCol: string;
  editTx: string;
  deleteTx: string;
  deleteConfirm: string;
  toCollect: string;
  toPay: string;
  collectedOf: (collected: string, total: string) => string;
  paidOf: (paid: string, total: string) => string;
  loansDebtsHeading: string;
  loansDebtsSub: string;
  prestamos: string;
  deudas: string;
  noLoansTitle: string;
  noLoansBody: string;
  noDebtsTitle: string;
  noDebtsBody: string;
  settled: string;
  open: string;
  remaining: string;
  of: string;
  abono: string;
  pago: string;
  period: string;
  monthly: string;
  annual: string;
  totalIncome: string;
  totalExpenses: string;
  netCashFlow: string;
  movementsInScope: (n: number) => string;
  expenseCategoryOnly: string;
  surplus: string;
  deficit: string;
  avgDaily: string;
  avgDailyHint: (period: string) => string;
  periodMonth: string;
  periodYear: string;
  savingsRate: string;
  savingsRateHint: string;
  spendingByAccount: string;
  spendingByAccountHint: string;
  emptyActivityTitle: string;
  emptyActivityBody: string;
  newLoan: string;
  newDebt: string;
  loanCollect: string;
  debtPay: string;
  moneyLent: string;
  moneyBorrowed: string;
  collection: string;
  payment: string;
  registerLoan: string;
  registerDebt: string;
  registerCollect: string;
  registerPay: string;
  sourceAccount: string;
  depositTo: string;
  fundsLanded: string;
  payFrom: string;
  counterparty: string;
  creditor: string;
  selectLoan: string;
  selectDebt: string;
  noOpenLoans: string;
  noOpenDebts: string;
  remainingLabel: (amount: string) => string;
  loanConceptPh: string;
  debtConceptPh: string;
  counterpartyPh: string;
  creditorPh: string;
  errValidDate: string;
  errConcept: string;
  errAmount: string;
  errLoanConcept: string;
  errLoanPerson: string;
  errInsufficient: string;
  errDebtConcept: string;
  errDebtPerson: string;
  errSelectLoan: string;
  errSelectDebt: string;
  errExceedsRemaining: (amount: string) => string;
  errBelowCollected: (amount: string) => string;
  errBelowPaid: (amount: string) => string;
  errLoanMissing: string;
  errDebtMissing: string;
  errAbonoExceeds: string;
  errPagoExceeds: string;
  alertLoanHasCollections: string;
  alertDebtHasPayments: string;
  categoryExpense: string;
  categoryIncome: string;
  categoryLoan: string;
  categoryDebt: string;
  categoryLoanCollect: string;
  categoryDebtPay: string;
  txLoanTo: (person: string, concept: string) => string;
  txDebtWith: (person: string, concept: string) => string;
  txCollectFrom: (person: string, concept: string) => string;
  txPayTo: (person: string, concept: string) => string;
  noActivityYet: string;
  authLogin: string;
  authRegister: string;
  authEmail: string;
  authPassword: string;
  authEmailPh: string;
  authPasswordPh: string;
  authSubmitLogin: string;
  authSubmitRegister: string;
  authLoading: string;
  authSubtitle: string;
  authLogout: string;
  authErrEmail: string;
  authErrPassword: string;
  authErrGeneric: string;
  authErrNetwork: string;
  syncOffline: string;
};

const en: Dictionary = {
  tabs: {
    overview: "Overview",
    transactions: "Transactions",
    loans: "Loans & Debts",
    reports: "Reports",
  },
  accountLabels: {
    bank: "Bank Balance",
    ewallet: "E-Wallet",
    cash: "Cash",
  },
  accountShort: {
    bank: "Bank",
    ewallet: "E-Wallet",
    cash: "Cash",
  },
  typeFilters: {
    all: "All",
    expense: "Expenses",
    income: "Income",
    loans: "Loans/Debts",
  },
  filterAll: "All",
  langEs: "ES",
  langEn: "EN",
  netWorth: "Total Net Worth",
  netWorthHint: "Across bank, e-wallet, and cash accounts",
  loansTitle: "Loans & Debts",
  loansHint: "Net position · owed to you minus what you owe",
  reportsTitle: "Reports",
  reportsHint: "Income, expenses, and savings insights",
  transactionsTitle: "General Ledger",
  transactionsHint: "Search, filter, edit, and delete movements",
  recentActivity: "Recent Activity",
  noMovements: "No movements yet",
  movementsCount: (n) => `${n} transaction${n === 1 ? "" : "s"}`,
  viewAll: "View all",
  addExpense: "+ Expense",
  addIncome: "+ Income",
  addLoanDebt: "+ Loan/Debt",
  addLoan: "+ Loan",
  addLoanCollect: "+ Loan Collection",
  addDebt: "+ Debt",
  addDebtPay: "+ Debt Payment",
  newExpense: "New Expense",
  newIncome: "New Income",
  editTransaction: "Edit Transaction",
  modifyRecord: "Modify record",
  expense: "Expense",
  income: "Income",
  date: "Date",
  dateHint: "Press Enter on an empty date to use today.",
  concept: "Comment / Concept",
  account: "Account",
  amount: "Amount",
  balancePreview: "Balance preview",
  balanceCurrent: "Current balance",
  balanceFinal: "Final balance",
  cancel: "Cancel",
  saveChanges: "Save changes",
  registerExpense: "Save expense",
  registerIncome: "Save income",
  placeholderExpense: "Lunch",
  placeholderIncome: "Freelance work",
  closeDialog: "Close dialog",
  registroGeneral: "General Ledger",
  showingOf: (shown, total) => `Showing ${shown} of ${total}`,
  searchPlaceholder: "Search by concept or counterparty…",
  filterType: "Type",
  filterAccount: "Account",
  noMatching: "No matching transactions.",
  dateCol: "Date",
  descriptionCol: "Description",
  categoryCol: "Category",
  accountCol: "Account",
  amountCol: "Amount",
  actionsCol: "Actions",
  editTx: "Edit transaction",
  deleteTx: "Delete transaction",
  deleteConfirm:
    "Delete this transaction and roll back its balance impact?",
  toCollect: "To collect",
  toPay: "To pay",
  collectedOf: (collected, total) => `${collected} collected of ${total}`,
  paidOf: (paid, total) => `${paid} paid of ${total}`,
  loansDebtsHeading: "Loans & Debts",
  loansDebtsSub: "Track money lent out and money you still owe",
  prestamos: "Loans",
  deudas: "Debts",
  noLoansTitle: "No loans yet",
  noLoansBody:
    "Register money you lent to someone. Collections will increase your account balance.",
  noDebtsTitle: "No debts yet",
  noDebtsBody:
    "Register money you borrowed. Payments will deduct from your selected account.",
  settled: "Settled",
  open: "Open",
  remaining: "remaining",
  of: "of",
  abono: "+ Collection",
  pago: "+ Payment",
  period: "Period",
  monthly: "Monthly",
  annual: "Annual",
  totalIncome: "Total Income",
  totalExpenses: "Total Expenses",
  netCashFlow: "Net Cash Flow",
  movementsInScope: (n) => `${n} movements in scope`,
  expenseCategoryOnly: "Expense category only",
  surplus: "Surplus",
  deficit: "Deficit",
  avgDaily: "Avg daily spending",
  avgDailyHint: (period) => `Based on elapsed days in this ${period}`,
  periodMonth: "month",
  periodYear: "year",
  savingsRate: "Net savings rate",
  savingsRateHint: "(Income − Expenses) ÷ Income",
  spendingByAccount: "Spending by account",
  spendingByAccountHint:
    "Expense distribution across Bank, E-Wallet, and Cash",
  emptyActivityTitle: "No activity yet",
  emptyActivityBody:
    "Your recent expenses, income, and loans will appear here. Use the quick actions above to record your first movement.",
  newLoan: "New Loan",
  newDebt: "New Debt",
  loanCollect: "Loan Collection",
  debtPay: "Debt Payment",
  moneyLent: "Money lent",
  moneyBorrowed: "Money borrowed",
  collection: "Collection",
  payment: "Payment",
  registerLoan: "Save loan",
  registerDebt: "Save debt",
  registerCollect: "Save collection",
  registerPay: "Save payment",
  sourceAccount: "Source account",
  depositTo: "Deposit to",
  fundsLanded: "Funds landed in",
  payFrom: "Pay from",
  counterparty: "Counterparty",
  creditor: "Creditor",
  selectLoan: "Select a loan",
  selectDebt: "Select a debt",
  noOpenLoans: "No open loans",
  noOpenDebts: "No open debts",
  remainingLabel: (amount) => `Remaining: ${amount}`,
  loanConceptPh: "Help with rent",
  debtConceptPh: "Family loan",
  counterpartyPh: "Ana Pérez",
  creditorPh: "Bank XYZ",
  errValidDate: "Enter a valid date (YYYY-MM-DD).",
  errConcept: "Add a short concept / comment.",
  errAmount: "Enter an amount greater than zero.",
  errLoanConcept: "Add a concept for this loan.",
  errLoanPerson: "Who received the loan?",
  errInsufficient: "Insufficient balance in the selected account.",
  errDebtConcept: "Add a concept for this debt.",
  errDebtPerson: "Who is the creditor?",
  errSelectLoan: "Select a loan to collect against.",
  errSelectDebt: "Select a debt to pay against.",
  errExceedsRemaining: (amount) =>
    `Amount exceeds remaining balance (${amount}).`,
  errBelowCollected: (amount) =>
    `Amount cannot be below collected (${amount}).`,
  errBelowPaid: (amount) => `Amount cannot be below paid (${amount}).`,
  errLoanMissing: "Linked loan no longer exists.",
  errDebtMissing: "Linked debt no longer exists.",
  errAbonoExceeds: "Edited collection exceeds the loan total.",
  errPagoExceeds: "Edited payment exceeds the debt total.",
  alertLoanHasCollections:
    "This loan has collections. Delete collections first, then the origin.",
  alertDebtHasPayments:
    "This debt has payments. Delete payments first, then the origin.",
  categoryExpense: "Expense",
  categoryIncome: "Income",
  categoryLoan: "Loan",
  categoryDebt: "Debt",
  categoryLoanCollect: "Loan Collection",
  categoryDebtPay: "Debt Payment",
  txLoanTo: (person, concept) => `Loan to ${person}: ${concept}`,
  txDebtWith: (person, concept) => `Debt with ${person}: ${concept}`,
  txCollectFrom: (person, concept) => `Collection from ${person}: ${concept}`,
  txPayTo: (person, concept) => `Payment to ${person}: ${concept}`,
  noActivityYet: "No activity yet",
  authLogin: "Login",
  authRegister: "Register",
  authEmail: "Email",
  authPassword: "Password",
  authEmailPh: "you@example.com",
  authPasswordPh: "At least 8 characters",
  authSubmitLogin: "Sign in",
  authSubmitRegister: "Create account",
  authLoading: "Please wait…",
  authSubtitle: "Your personal ledger, synced securely.",
  authLogout: "Log out",
  authErrEmail: "Enter a valid email.",
  authErrPassword: "Password must be at least 8 characters.",
  authErrGeneric: "Authentication failed. Try again.",
  authErrNetwork: "Cannot reach the server. Check the API is running.",
  syncOffline: "Saved locally · sync pending",
};

const es: Dictionary = {
  tabs: {
    overview: "Resumen",
    transactions: "Registros",
    loans: "Préstamos y Deudas",
    reports: "Reportes",
  },
  accountLabels: {
    bank: "Saldo Banco",
    ewallet: "E-Wallet",
    cash: "Efectivo",
  },
  accountShort: {
    bank: "Banco",
    ewallet: "E-Wallet",
    cash: "Efectivo",
  },
  typeFilters: {
    all: "Todos",
    expense: "Gastos",
    income: "Ingresos",
    loans: "Préstamos/Deudas",
  },
  filterAll: "Todos",
  langEs: "ES",
  langEn: "EN",
  netWorth: "Patrimonio Neto",
  netWorthHint: "Entre banco, e-wallet y efectivo",
  loansTitle: "Préstamos y Deudas",
  loansHint: "Posición neta · te deben menos lo que debes",
  reportsTitle: "Reportes",
  reportsHint: "Ingresos, gastos y ahorro",
  transactionsTitle: "Registro General",
  transactionsHint: "Busca, filtra, edita y elimina movimientos",
  recentActivity: "Actividad Reciente",
  noMovements: "Sin movimientos aún",
  movementsCount: (n) =>
    `${n} transacción${n === 1 ? "" : "es"}`,
  viewAll: "Ver todo",
  addExpense: "+ Gasto",
  addIncome: "+ Ingreso",
  addLoanDebt: "+ Préstamo/Deuda",
  addLoan: "+ Préstamo",
  addLoanCollect: "+ Abono a Préstamo",
  addDebt: "+ Deuda",
  addDebtPay: "+ Pago de Deuda",
  newExpense: "Nuevo Gasto",
  newIncome: "Nuevo Ingreso",
  editTransaction: "Editar Transacción",
  modifyRecord: "Modificar registro",
  expense: "Gasto",
  income: "Ingreso",
  date: "Fecha",
  dateHint: "Pulsa Enter en una fecha vacía para usar hoy.",
  concept: "Comentario / Concepto",
  account: "Cuenta",
  amount: "Monto",
  balancePreview: "Previsualización de saldo",
  balanceCurrent: "Saldo actual",
  balanceFinal: "Saldo final",
  cancel: "Cancelar",
  saveChanges: "Guardar cambios",
  registerExpense: "Registrar gasto",
  registerIncome: "Registrar ingreso",
  placeholderExpense: "Almuerzo",
  placeholderIncome: "Trabajo freelance",
  closeDialog: "Cerrar diálogo",
  registroGeneral: "Registro General",
  showingOf: (shown, total) => `Mostrando ${shown} de ${total}`,
  searchPlaceholder: "Buscar por concepto o contraparte…",
  filterType: "Tipo",
  filterAccount: "Cuenta",
  noMatching: "No hay transacciones que coincidan.",
  dateCol: "Fecha",
  descriptionCol: "Descripción",
  categoryCol: "Categoría",
  accountCol: "Cuenta",
  amountCol: "Monto",
  actionsCol: "Acciones",
  editTx: "Editar transacción",
  deleteTx: "Eliminar transacción",
  deleteConfirm:
    "¿Eliminar esta transacción y revertir su impacto en el saldo?",
  toCollect: "Por cobrar",
  toPay: "Por pagar",
  collectedOf: (collected, total) => `${collected} cobrado de ${total}`,
  paidOf: (paid, total) => `${paid} pagado de ${total}`,
  loansDebtsHeading: "Préstamos y Deudas",
  loansDebtsSub: "Controla lo que prestaste y lo que aún debes",
  prestamos: "Préstamos",
  deudas: "Deudas",
  noLoansTitle: "Sin préstamos aún",
  noLoansBody:
    "Registra dinero que prestaste. Los abonos aumentarán el saldo de tu cuenta.",
  noDebtsTitle: "Sin deudas aún",
  noDebtsBody:
    "Registra dinero que pediste prestado. Los pagos se descontarán de la cuenta seleccionada.",
  settled: "Liquidado",
  open: "Pendiente",
  remaining: "restante",
  of: "de",
  abono: "+ Abono",
  pago: "+ Pago",
  period: "Periodo",
  monthly: "Mensual",
  annual: "Anual",
  totalIncome: "Ingresos Totales",
  totalExpenses: "Gastos Totales",
  netCashFlow: "Flujo Neto",
  movementsInScope: (n) => `${n} movimientos en el periodo`,
  expenseCategoryOnly: "Solo categoría de gasto",
  surplus: "Superávit",
  deficit: "Déficit",
  avgDaily: "Gasto diario promedio",
  avgDailyHint: (period) => `Según días transcurridos de este ${period}`,
  periodMonth: "mes",
  periodYear: "año",
  savingsRate: "Tasa de ahorro neta",
  savingsRateHint: "(Ingresos − Gastos) ÷ Ingresos",
  spendingByAccount: "Gasto por cuenta",
  spendingByAccountHint:
    "Distribución de gastos entre Banco, E-Wallet y Efectivo",
  emptyActivityTitle: "Sin actividad aún",
  emptyActivityBody:
    "Tus gastos, ingresos y préstamos aparecerán aquí. Usa las acciones rápidas para registrar el primero.",
  newLoan: "Nuevo Préstamo",
  newDebt: "Nueva Deuda",
  loanCollect: "Abono a Préstamo",
  debtPay: "Pago de Deuda",
  moneyLent: "Dinero prestado",
  moneyBorrowed: "Dinero adeudado",
  collection: "Cobro",
  payment: "Pago",
  registerLoan: "Registrar préstamo",
  registerDebt: "Registrar deuda",
  registerCollect: "Registrar abono",
  registerPay: "Registrar pago",
  sourceAccount: "Cuenta de origen",
  depositTo: "Depositar en",
  fundsLanded: "Fondos recibidos en",
  payFrom: "Pagar desde",
  counterparty: "Contraparte",
  creditor: "Acreedor",
  selectLoan: "Selecciona un préstamo",
  selectDebt: "Selecciona una deuda",
  noOpenLoans: "No hay préstamos abiertos",
  noOpenDebts: "No hay deudas abiertas",
  remainingLabel: (amount) => `Restante: ${amount}`,
  loanConceptPh: "Ayuda para renta",
  debtConceptPh: "Préstamo familiar",
  counterpartyPh: "Ana Pérez",
  creditorPh: "Banco XYZ",
  errValidDate: "Ingresa una fecha válida (AAAA-MM-DD).",
  errConcept: "Agrega un concepto / comentario corto.",
  errAmount: "Ingresa un monto mayor a cero.",
  errLoanConcept: "Agrega un concepto para este préstamo.",
  errLoanPerson: "¿Quién recibió el préstamo?",
  errInsufficient: "Saldo insuficiente en la cuenta seleccionada.",
  errDebtConcept: "Agrega un concepto para esta deuda.",
  errDebtPerson: "¿Quién es el acreedor?",
  errSelectLoan: "Selecciona un préstamo para cobrar.",
  errSelectDebt: "Selecciona una deuda para pagar.",
  errExceedsRemaining: (amount) =>
    `El monto supera el saldo restante (${amount}).`,
  errBelowCollected: (amount) =>
    `El monto no puede ser menor a lo cobrado (${amount}).`,
  errBelowPaid: (amount) =>
    `El monto no puede ser menor a lo pagado (${amount}).`,
  errLoanMissing: "El préstamo vinculado ya no existe.",
  errDebtMissing: "La deuda vinculada ya no existe.",
  errAbonoExceeds: "El abono editado supera el total del préstamo.",
  errPagoExceeds: "El pago editado supera el total de la deuda.",
  alertLoanHasCollections:
    "Este préstamo tiene abonos. Elimina los abonos primero y luego el origen.",
  alertDebtHasPayments:
    "Esta deuda tiene pagos. Elimina los pagos primero y luego el origen.",
  categoryExpense: "Gasto",
  categoryIncome: "Ingreso",
  categoryLoan: "Préstamo",
  categoryDebt: "Deuda",
  categoryLoanCollect: "Abono",
  categoryDebtPay: "Pago de Deuda",
  txLoanTo: (person, concept) => `Préstamo a ${person}: ${concept}`,
  txDebtWith: (person, concept) => `Deuda con ${person}: ${concept}`,
  txCollectFrom: (person, concept) => `Abono de ${person}: ${concept}`,
  txPayTo: (person, concept) => `Pago a ${person}: ${concept}`,
  noActivityYet: "Sin actividad aún",
  authLogin: "Iniciar Sesión",
  authRegister: "Registrarse",
  authEmail: "Correo",
  authPassword: "Contraseña",
  authEmailPh: "tu@ejemplo.com",
  authPasswordPh: "Mínimo 8 caracteres",
  authSubmitLogin: "Entrar",
  authSubmitRegister: "Crear cuenta",
  authLoading: "Un momento…",
  authSubtitle: "Tu contabilidad personal, sincronizada.",
  authLogout: "Cerrar Sesión",
  authErrEmail: "Ingresa un correo válido.",
  authErrPassword: "La contraseña debe tener al menos 8 caracteres.",
  authErrGeneric: "Autenticación fallida. Intenta de nuevo.",
  authErrNetwork: "No se puede conectar al servidor. ¿Está la API activa?",
  syncOffline: "Guardado local · sync pendiente",
};

export const dictionaries: Record<Lang, Dictionary> = { en, es };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "es";
}
