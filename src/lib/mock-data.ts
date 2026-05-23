export type ProjectStatus = "in_progress" | "live" | "maintenance" | "review";
export type ProjectType = "website" | "mobile_app";

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  liveUrl?: string;
  cmsUrl?: string;
  progress: number;
  updatedAt: string;
}

export interface ClientAccount {
  id: string;
  name: string;
  company: string;
  email: string;
  password: string;
  createdAt: string;
  projects: Project[];
  finance: {
    income: number;
    expenses: number;
    netProfit: number;
    months: { month: string; income: number; expenses: number }[];
    breakdown: { name: string; value: number }[];
  };
  emails: {
    id: string;
    from: string;
    subject: string;
    preview: string;
    time: string;
    unread: boolean;
  }[];
}

export const ADMIN = {
  email: "admin@madar.com",
  password: "admin123",
  name: "Madar Admin",
};

export const INITIAL_CLIENTS: ClientAccount[] = [
  {
    id: "c1",
    name: "Layla Haddad",
    company: "Acme Atelier",
    email: "client@acme.com",
    password: "client123",
    createdAt: "2025-01-12",
    projects: [
      {
        id: "p1",
        name: "Acme Storefront",
        type: "website",
        status: "live",
        liveUrl: "https://acme.example.com",
        cmsUrl: "/cms/acme",
        progress: 100,
        updatedAt: "2026-05-18",
      },
      {
        id: "p2",
        name: "Acme Loyalty App",
        type: "mobile_app",
        status: "in_progress",
        progress: 64,
        updatedAt: "2026-05-21",
      },
    ],
    finance: {
      income: 48200,
      expenses: 27340,
      netProfit: 20860,
      months: [
        { month: "Dec", income: 38000, expenses: 24000 },
        { month: "Jan", income: 41000, expenses: 25500 },
        { month: "Feb", income: 39500, expenses: 23800 },
        { month: "Mar", income: 44200, expenses: 26100 },
        { month: "Apr", income: 46800, expenses: 26900 },
        { month: "May", income: 48200, expenses: 27340 },
      ],
      breakdown: [
        { name: "Payroll", value: 14200 },
        { name: "Marketing", value: 5400 },
        { name: "Software", value: 3100 },
        { name: "Operations", value: 4640 },
      ],
    },
    emails: [
      { id: "e1", from: "stripe@stripe.com", subject: "Payout completed", preview: "Your payout of $4,820 has been deposited…", time: "09:14", unread: true },
      { id: "e2", from: "noor@suppliers.co", subject: "Q3 Catalog", preview: "Hi Layla, attached is the updated catalog…", time: "Yesterday", unread: true },
      { id: "e3", from: "team@madar.com", subject: "Sprint review notes", preview: "Summary from today's review and next steps…", time: "Mon", unread: false },
      { id: "e4", from: "billing@figma.com", subject: "Receipt", preview: "Thanks for your payment of $45.00…", time: "May 18", unread: false },
    ],
  },
  {
    id: "c2",
    name: "Omar Faris",
    company: "Northwind Capital",
    email: "omar@northwind.com",
    password: "client123",
    createdAt: "2024-11-04",
    projects: [
      {
        id: "p3",
        name: "Investor Portal",
        type: "website",
        status: "maintenance",
        liveUrl: "https://northwind.example.com",
        cmsUrl: "/cms/northwind",
        progress: 100,
        updatedAt: "2026-05-10",
      },
    ],
    finance: {
      income: 128400,
      expenses: 74200,
      netProfit: 54200,
      months: [
        { month: "Dec", income: 110000, expenses: 70000 },
        { month: "Jan", income: 118000, expenses: 72000 },
        { month: "Feb", income: 121000, expenses: 71500 },
        { month: "Mar", income: 124500, expenses: 73000 },
        { month: "Apr", income: 126000, expenses: 73800 },
        { month: "May", income: 128400, expenses: 74200 },
      ],
      breakdown: [
        { name: "Payroll", value: 42000 },
        { name: "Compliance", value: 12200 },
        { name: "Software", value: 8400 },
        { name: "Operations", value: 11600 },
      ],
    },
    emails: [
      { id: "e1", from: "compliance@sec.gov", subject: "Filing reminder", preview: "Your quarterly filing is due in 14 days…", time: "08:02", unread: true },
      { id: "e2", from: "team@madar.com", subject: "Maintenance window", preview: "We'll deploy minor updates Saturday 02:00…", time: "Tue", unread: false },
    ],
  },
  {
    id: "c3",
    name: "Sara Khalil",
    company: "Bloom & Co.",
    email: "sara@bloom.co",
    password: "client123",
    createdAt: "2025-03-22",
    projects: [
      {
        id: "p4",
        name: "Bloom Marketing Site",
        type: "website",
        status: "review",
        liveUrl: "https://bloom.example.com",
        cmsUrl: "/cms/bloom",
        progress: 92,
        updatedAt: "2026-05-22",
      },
      {
        id: "p5",
        name: "Bloom Order App",
        type: "mobile_app",
        status: "in_progress",
        progress: 38,
        updatedAt: "2026-05-20",
      },
    ],
    finance: {
      income: 22400,
      expenses: 14800,
      netProfit: 7600,
      months: [
        { month: "Dec", income: 16000, expenses: 12000 },
        { month: "Jan", income: 18500, expenses: 12800 },
        { month: "Feb", income: 19200, expenses: 13100 },
        { month: "Mar", income: 20100, expenses: 13700 },
        { month: "Apr", income: 21300, expenses: 14200 },
        { month: "May", income: 22400, expenses: 14800 },
      ],
      breakdown: [
        { name: "Inventory", value: 6200 },
        { name: "Marketing", value: 3400 },
        { name: "Software", value: 1800 },
        { name: "Operations", value: 3400 },
      ],
    },
    emails: [
      { id: "e1", from: "orders@shopify.com", subject: "New order #1284", preview: "You received a new order for $128.40…", time: "11:42", unread: true },
    ],
  },
];

export const STATUS_META: Record<ProjectStatus, { label: string; tone: string }> = {
  in_progress: { label: "In Progress", tone: "bg-[oklch(0.95_0.04_250)] text-[oklch(0.35_0.12_250)]" },
  live: { label: "Live", tone: "bg-[oklch(0.94_0.06_155)] text-[oklch(0.32_0.13_155)]" },
  maintenance: { label: "Maintenance", tone: "bg-[oklch(0.95_0.05_75)] text-[oklch(0.4_0.13_75)]" },
  review: { label: "In Review", tone: "bg-[oklch(0.94_0.04_300)] text-[oklch(0.38_0.14_300)]" },
};
