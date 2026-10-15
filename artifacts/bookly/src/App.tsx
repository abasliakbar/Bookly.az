import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Route, Switch, Router as WouterRouter, Link, Redirect, useLocation, useRoute } from 'wouter';
import type { ChangeEvent } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, LayoutDashboard,
  Link2, ListFilter, LoaderCircle, LogOut, Menu, Pencil, Plus, Search,
  Settings2, Sparkles, Users, X, BriefcaseBusiness, CircleHelp, Scissors, CalendarCheck2,
  Phone, MapPin, Trash2, LockKeyhole, Globe2
} from 'lucide-react';
import {
  getGetDashboardAppointmentsQueryKey, getGetDashboardBusinessQueryKey,
  getGetDashboardHolidaysQueryKey,
  getGetDashboardOverviewQueryKey,
  getGetDashboardServicesQueryKey, getGetDashboardStaffQueryKey,
  getGetAvailableSlotsQueryKey, useCreateDashboardBusiness, useCreatePublicAppointment,
  useCreateDashboardHoliday, useCreateService, useCreateStaff,
  useDeleteDashboardHoliday, useDeleteService, useDeleteStaff,
  useGetAvailableSlots, useGetDashboardAppointments, useGetDashboardBusiness,
  useGetDashboardCustomers, useGetDashboardHolidays, useGetDashboardOverview, useGetDashboardServices,
  useGetDashboardStaff, useGetPublicBookingPage, useUpdateAppointmentStatus,
  useUpdateDashboardBusiness, useUpdateService, useUpdateStaff
} from '@workspace/api-client-react';
import type { Appointment, Customer, Service, Staff } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const appearance = {
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: { colorPrimary: '#059669', colorForeground: '#1d2b3e', colorMutedForeground: '#687788', colorBackground: '#ffffff', colorInput: '#ffffff', colorInputForeground: '#1d2b3e', colorNeutral: '#dce6e1', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.75rem' },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-bold text-slate-800',
    headerSubtitle: 'text-slate-500',
    formFieldLabel: 'text-slate-600',
    formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-700',
    formFieldInput: 'rounded-xl',
    socialButtonsBlockButton: 'rounded-xl border-slate-200',
  },
};
if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment');
}

const navItems = [
  { href: '/dashboard', label: 'İcmal', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/appointments', label: 'Görüşlər', icon: CalendarDays },
  { href: '/dashboard/services', label: 'Xidmətlər', icon: Scissors },
  { href: '/dashboard/staff', label: 'Komanda', icon: Users },
  { href: '/dashboard/customers', label: 'Müştərilər', icon: BriefcaseBusiness },
  { href: '/dashboard/holidays', label: 'Bağlı günlər', icon: CalendarCheck2 },
  { href: '/dashboard/settings', label: 'Tənzimləmələr', icon: Settings2 },
];

const DEFAULT_STAFF_HOURS = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '10:00', close: '16:00', closed: false },
  sunday: { open: '10:00', close: '16:00', closed: true },
};

function bakuDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function Brand({ light = false }: { light?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${light ? 'text-white' : 'text-[#1d2b3e]'}`}>
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#059669] text-white"><CalendarCheck2 size={19} strokeWidth={2.5} /></span>
    <span className="text-[21px]">Bookly</span>
  </span>;
}

function LanguageSwitch() {
  const [lang, setLang] = useState('AZ');
  return <div className="flex items-center rounded-lg border border-white/15 bg-white/5 p-1 text-[11px] font-bold">
    {['AZ', 'EN', 'RU'].map((locale) => <button key={locale} onClick={() => setLang(locale)} className={`rounded-md px-2 py-1 transition ${lang === locale ? 'bg-white text-[#172638]' : 'text-white/65 hover:text-white'}`} aria-label={`Language ${locale}`} data-testid={`language-${locale.toLowerCase()}`}>{locale}</button>)}
  </div>;
}

function Button({ children, className = '', onClick, type = 'button', disabled = false }: { children: ReactNode; className?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`${className || 'btn-primary'} disabled:cursor-not-allowed disabled:opacity-60`} data-testid="button-action">{children}</button>;
}

function Field({ label, ...props }: { label: string; name?: string; type?: string; placeholder?: string; defaultValue?: string | number; required?: boolean; value?: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="block"><span className="field-label">{label}</span><input className="field" {...props} /></label>;
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#059669]">Bookly idarəetmə</p><h1 className="font-serif text-[27px] font-extrabold tracking-[-.04em] text-[#1d2b3e] sm:text-[32px]">{title}</h1><p className="mt-1 text-sm text-[#758294]">{subtitle}</p></div>{action}</div>;
}

function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Yüklənir">{Array.from({ length: rows }, (_, i) => <div className="panel flex items-center gap-4 p-4" key={i}><div className="skeleton h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-3 w-1/2" /></div><div className="skeleton h-7 w-20" /></div>)}</div>;
}

function QueryError({ retry }: { retry: () => void }) {
  return <div className="panel flex flex-col items-center px-6 py-12 text-center"><span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600"><CircleHelp size={22} /></span><h3 className="font-bold text-[#1d2b3e]">Məlumatı yükləmək mümkün olmadı</h3><p className="mt-1 max-w-sm text-sm text-[#758294]">İnternet bağlantınızı yoxlayın və yenidən cəhd edin.</p><button className="btn-secondary mt-5" onClick={retry} data-testid="button-retry">Yenidən yoxla</button></div>;
}

function Empty({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="panel flex flex-col items-center px-6 py-12 text-center"><span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#edf8f2] text-[#059669]"><CalendarDays size={24} /></span><h3 className="font-bold text-[#1d2b3e]">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-[#758294]">{copy}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function DashboardShell({ children, title }: { children: ReactNode; title: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: business } = useGetDashboardBusiness();
  const sidebar = <aside className="flex h-full flex-col px-4 pb-5 pt-6">
    <div className="mb-8 px-2"><Brand light /></div>
    <div className="mb-5 rounded-xl border border-white/10 bg-white/[.055] px-3 py-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/40">İş məkanı</div>
      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-white">{business?.name ?? 'Biznesiniz'}</span><ChevronDown size={14} className="shrink-0 text-white/50" /></div>
    </div>
    <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-white/35">İş masası</div>
    <nav className="space-y-1">
      {navItems.map(({ href, label, icon: Icon, exact }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`sidebar-link ${location === href || (!exact && location.startsWith(`${href}/`)) ? 'active' : ''}`} data-testid={`nav-${href.split('/').pop()}`}><Icon size={18} strokeWidth={1.9} /><span>{label}</span></Link>)}
    </nav>
    <div className="mt-auto">
      <div className="mb-4 rounded-xl bg-[#203b3b] p-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#aff0d0]"><Sparkles size={14} /> Kitab sifarişləri sadələşdirin</div>
        <p className="mt-1.5 text-[11px] leading-5 text-white/55">Rezervasiyalarınızı bir keçiddən idarə edin.</p>
        <Link href="/dashboard/settings" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#aff0d0]">Keçidə bax <ArrowRight size={12} /></Link>
      </div>
      <LanguageSwitch />
      <button onClick={() => signOut({ redirectUrl: '/' })} className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white" data-testid="button-sign-out"><LogOut size={17} /> Çıxış</button>
    </div>
  </aside>;
  return <div className="app-shell flex min-h-[100dvh] bg-[#f5f8f6]">
    <aside className="desktop-sidebar fixed inset-y-0 left-0 z-30 hidden w-[248px] md:block"><div className="h-full overflow-y-auto sidebar">{sidebar}</div></aside>
    {mobileOpen && <div className="fixed inset-0 z-40 md:hidden"><button className="absolute inset-0 bg-[#142334]/50" aria-label="Menyunu bağla" onClick={() => setMobileOpen(false)} /><div className="sidebar absolute inset-y-0 left-0 w-[275px]">{sidebar}</div></div>}
    <main className="min-w-0 flex-1 md:ml-[248px]">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e5ece8] bg-[#f9fbfa]/95 px-4 backdrop-blur-md sm:px-7">
        <div className="flex items-center gap-3"><button className="grid h-9 w-9 place-items-center rounded-lg text-[#536273] hover:bg-white md:hidden" aria-label="Menyunu aç" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><div className="hidden text-[11px] text-[#84918f] sm:block">Bookly / İdarəetmə</div><div className="text-sm font-bold text-[#25374a] sm:mt-0.5">{title}</div></div></div>
        <div className="flex items-center gap-3"><button className="relative grid h-9 w-9 place-items-center rounded-full border border-[#e4ebe7] bg-white text-[#607168]" aria-label="Bildirişlər"><Activity size={17} /><span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#059669]" /></button><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e0f2e9] text-xs font-bold text-[#087c59]">BK</div></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">{children}</div>
      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-30 hidden justify-around border-t border-[#e4ebe7] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-6px_25px_rgba(20,50,38,.06)] backdrop-blur">
      {navItems.map(({ href, icon: Icon, label }) => <Link key={href} href={href} className={`flex min-w-0 flex-col items-center gap-1 px-1.5 py-1 text-[10px] font-semibold ${location === href ? 'text-[#059669]' : 'text-[#89948f]'}`}><Icon size={18} /><span className="truncate">{label}</span></Link>)}
      </nav>
    </main>
  </div>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#172638]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={close}><section className="panel w-full max-w-lg animate-in rounded-b-none p-5 sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}><header className="mb-5 flex items-center justify-between"><h2 className="font-serif text-xl font-extrabold text-[#1d2b3e]">{title}</h2><button onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-[#7a8792] hover:bg-[#f1f5f3]" aria-label="Bağla"><X size={18} /></button></header>{children}</section></div>;
}

function HomePage() {
  return <Show when="signed-in"><Redirect to="/dashboard" /></Show>;
}
function Landing() {
  const [tab, setTab] = useState<'AZ' | 'EN' | 'RU'>('AZ');
  const [demoStep, setDemoStep] = useState(0);
  const localeCopy = {
    AZ: { how: 'Necə işləyir', features: 'İmkanlar', pricingNav: 'Qiymətlər', faqNav: 'Suallar', signIn: 'Daxil ol', trial: '14 gün pulsuz sınaq', eyebrow: 'Kiçik bizneslər üçün onlayn randevu sistemi', hero: 'Biznesiniz üçün onlayn randevu sistemi', sub: 'Müştərilər 24/7 özləri randevu alır. Siz sadəcə işinizə fokuslanın.', details: 'Necə işləyir', demo: 'Bookly-ni tanıyın', howTitle: 'Bir neçə addım. Daha rahat gün.', pricingTitle: 'Biznesinizə uyğun plan seçin', faqTitle: 'Tez-tez verilən suallar', stories: 'İstifadəçi hekayələri tezliklə' },
    EN: { how: 'How it works', features: 'Features', pricingNav: 'Pricing', faqNav: 'FAQ', signIn: 'Sign in', trial: 'Try free for 14 days', eyebrow: 'Online appointment booking for small businesses', hero: 'An online appointment system for your business', sub: 'Customers book for themselves, 24/7. You focus on your work.', details: 'How it works', demo: 'Meet Bookly', howTitle: 'A few steps. A smoother day.', pricingTitle: 'Choose a plan for your business', faqTitle: 'Frequently asked questions', stories: 'Customer stories coming soon' },
    RU: { how: 'Как это работает', features: 'Возможности', pricingNav: 'Тарифы', faqNav: 'Вопросы', signIn: 'Войти', trial: '14 дней бесплатно', eyebrow: 'Онлайн-запись для малого бизнеса', hero: 'Онлайн-система записи для вашего бизнеса', sub: 'Клиенты записываются сами, 24/7. Вы сосредотачиваетесь на работе.', details: 'Как это работает', demo: 'Знакомство с Bookly', howTitle: 'Несколько шагов. День проще.', pricingTitle: 'Выберите план для бизнеса', faqTitle: 'Частые вопросы', stories: 'Истории клиентов скоро появятся' },
  }[tab];
  return <main className="min-h-[100dvh] bg-[#fafcfb] text-[#1d2b3e]">
    <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8"><Link href="/" className="no-underline"><Brand /></Link><nav className="hidden items-center gap-8 text-sm font-semibold text-[#5b6877] md:flex"><a href="#how" className="hover:text-[#059669]">{localeCopy.how}</a><a href="#features" className="hover:text-[#059669]">{localeCopy.features}</a><a href="#pricing" className="hover:text-[#059669]">{localeCopy.pricingNav}</a><a href="#faq" className="hover:text-[#059669]">{localeCopy.faqNav}</a></nav><div className="flex items-center gap-2 sm:gap-3"><div className="flex rounded-lg border border-[#e5ece8] p-1">{(['AZ','EN','RU'] as const).map(l => <button key={l} onClick={() => {setTab(l);document.documentElement.lang=l.toLowerCase();}} className={`rounded-md px-2 py-1 text-[11px] font-bold ${tab === l ? 'bg-[#e7f6ee] text-[#087c59]' : 'text-[#78858f]'}`} aria-label={`Language ${l}`}>{l}</button>)}</div><Link href="/sign-in" className="hidden px-2 py-2 text-sm font-bold text-[#334155] sm:block">{localeCopy.signIn}</Link><Link href="/sign-up" className="btn-primary px-3.5 py-2.5 text-xs sm:px-4 sm:text-sm">{localeCopy.trial} <ArrowRight size={15} /></Link></div></header>
    <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-4">
      <div className="animate-in max-w-[630px]"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6eee2] bg-[#eff9f3] px-3.5 py-2 text-xs font-bold text-[#087c59]"><span className="h-2 w-2 rounded-full bg-[#059669]" /> {localeCopy.eyebrow}</div><h1 className="font-serif text-[42px] font-extrabold leading-[1.06] tracking-[-.055em] text-[#172638] sm:text-6xl lg:text-[68px]">{localeCopy.hero}</h1><p className="mt-6 max-w-[500px] text-base leading-7 text-[#687788] sm:text-lg sm:leading-8">{localeCopy.sub}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-up" className="btn-primary px-5 py-3.5">{localeCopy.trial} <ArrowRight size={16} /></Link><a href="#demo" className="btn-secondary px-5 py-3.5">{localeCopy.demo} <ChevronDown size={15} /></a></div><div className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#edf8f2] px-3.5 py-2 text-xs font-bold text-[#087c59]"><CheckCircle2 size={15}/> 14 gün ödənişsiz istifadə</div></div>
      <div className="relative mx-auto w-full max-w-[570px] animate-in lg:ml-auto" style={{animationDelay:'.12s'}}><div className="absolute -right-4 -top-8 h-44 w-44 rounded-full bg-[#e2f5e9] blur-2xl" /><div className="absolute -bottom-6 -left-5 h-40 w-40 rounded-full bg-[#d8eee6] blur-2xl" /><div className="relative rounded-[26px] border border-[#e1ebe6] bg-white p-3 shadow-[0_25px_75px_rgba(24,59,43,.11)] sm:p-5"><div className="flex items-center justify-between border-b border-[#edf1ee] pb-4"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f6ef] text-[#05865e]"><Scissors size={17} /></span><div><div className="text-sm font-bold">Lalə Studio</div><div className="text-[11px] text-[#87938d]">Gözəllik salonu · Bakı</div></div></div><span className="rounded-full bg-[#eaf8ef] px-2.5 py-1 text-[10px] font-bold text-[#087c59]">Onlayn rezervasiya</span></div><div className="flex items-center justify-between py-4"><div><p className="text-xs font-semibold text-[#82908a]">Çərşənbə axşamı</p><p className="mt-0.5 font-serif text-lg font-extrabold">Bugünkü görüşlər</p></div><button className="grid h-8 w-8 place-items-center rounded-lg border border-[#e8eeeb] text-[#65756c]"><ChevronRight size={16} /></button></div><div className="space-y-2.5">{[['10:00','Aylin Məmmədova','Saç kəsimi','#e6f5ed'],['11:30','Nigar Əliyeva','Manikür',' #fff2e4'],['13:00','Leyla Həsənli','Qaş dizaynı','#e9f1fb']].map(([time,name,service,bg])=><div key={time} className="flex items-center gap-3 rounded-xl border border-[#edf1ee] px-3.5 py-3"><div className="w-[42px] text-xs font-bold text-[#435367]">{time}</div><div className="h-9 w-[3px] rounded-full bg-[#059669]" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{name}</div><div className="mt-0.5 text-[11px] text-[#87938d]">{service}</div></div><span className="hidden rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#526155] sm:inline" style={{background:bg}}>Təsdiqlənib</span></div>)}</div><div className="mt-4 flex items-center justify-between rounded-xl bg-[#f4f8f6] px-3.5 py-3"><div><div className="text-[10px] font-semibold text-[#83918b]">Bu ayın gəliri</div><div className="mt-0.5 font-serif text-xl font-extrabold">₼ 2 840</div></div><div className="flex items-center gap-1 rounded-full bg-[#e5f5eb] px-2.5 py-1 text-[11px] font-bold text-[#087c59]"><ArrowUpRight size={13} /> 12.8%</div></div></div><div className="absolute -left-4 top-[40%] hidden items-center gap-2 rounded-xl border border-[#e5ece8] bg-white p-3 shadow-lg sm:flex"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf8ef] text-[#059669]"><Check size={16} /></span><span className="text-xs font-bold">Yeni rezervasiya<br /><span className="font-medium text-[#83918b]">10:30 üçün · indi</span></span></div></div>
    </section>
    <section className="border-y border-[#e7efea] bg-[#f2f8f4] py-7"><div className="mx-auto flex max-w-[1120px] flex-wrap justify-center gap-x-14 gap-y-4 px-5 text-center text-xs font-bold text-[#7b8a82] sm:justify-between sm:px-8"><span>Salonlar</span><span>Barber shop-lar</span><span>Fərdi müəllimlər</span><span>Sağlamlıq studiyaları</span><span>Usta xidmətləri</span></div></section>
    <section id="how" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-[650px] text-center"><span className="text-[11px] font-bold uppercase tracking-[.16em] text-[#059669]">Sadə başlanğıc</span><h2 className="mt-3 font-serif text-3xl font-extrabold tracking-[-.04em] sm:text-[42px]">{localeCopy.howTitle}</h2><p className="mt-4 leading-7 text-[#718073]">Görüş qəbulunu sistemə keçirmək üçün texniki bilik lazım deyil. Bookly iş axınınıza uyğunlaşır.</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{[['01','Biznesinizi qurun','Xidmətlərinizi, iş saatlarınızı və komandanızı bir dəfə əlavə edin.'],['02','Keçidinizi paylaşın','Sizə məxsus rezervasiya linkini sosial şəbəkədə və müştərilərlə paylaşın.'],['03','Gününüzü izləyin','Bütün görüşlər, dəyişikliklər və müştəri tarixçəsi bir baxışda qarşınızda.']].map(([n,title,copy])=><article key={n} className="panel relative overflow-hidden p-6 sm:p-7"><span className="font-serif text-5xl font-extrabold tracking-[-.06em] text-[#d9f1e3]">{n}</span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#758294]">{copy}</p><span className="absolute -right-6 -top-6 h-24 w-24 rounded-full border-[14px] border-[#f1f8f4]" /></article>)}</div></section>
    <section id="features" className="bg-[#172638] py-20 text-white sm:py-24"><div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr]"><div><div className="text-[11px] font-bold uppercase tracking-[.16em] text-[#7ee0b3]">Bir mərkəzdən idarəetmə</div><h2 className="mt-4 font-serif text-3xl font-extrabold leading-tight tracking-[-.04em] sm:text-4xl">İşiniz böyüsün.<br />Gündəlik qarışıqlıq yox.</h2><p className="mt-5 max-w-md leading-7 text-white/65">Bookly görüşləri, komandanı və müştəri əlaqələrini eyni yerdə saxlayır. Daha az yazışma, daha dəqiq plan.</p><Link href="/sign-up" className="mt-7 inline-flex items-center gap-2 font-bold text-[#a6edc9]">İndi başlayın <ArrowRight size={16} /></Link></div><div className="grid gap-3 sm:grid-cols-2">{[['Görüş təqvimi','Günlük planı bir baxışda görün.',CalendarDays],['Xidmət kataloqu','Qiymət və müddət həmişə aydın.',Scissors],['Komanda idarəetməsi','Hər mütəxəssisin işi öz qaydasında.',Users],['Müştəri tarixçəsi','Daimi müştəriləri və ziyarətləri tanıyın.',BriefcaseBusiness]].map(([title,copy,Icon]: any)=><div key={title} className="rounded-2xl border border-white/10 bg-white/[.055] p-5 transition hover:bg-white/[.09]"><Icon size={20} className="text-[#87e0b7]" /><h3 className="mt-5 font-bold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-white/55">{copy}</p></div>)}</div></div></section>
    <section id="demo" className="bg-[#f1f7f3] py-20 sm:py-24"><div className="mx-auto max-w-[1240px] px-5 sm:px-8"><div className="grid items-center gap-9 lg:grid-cols-[.8fr_1.2fr]"><div><span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#059669]">Məhsul walkthrough</span><h2 className="mt-3 font-serif text-3xl font-extrabold tracking-[-.04em] sm:text-[40px]">{localeCopy.demo}</h2><p className="mt-4 max-w-md leading-7 text-[#718073]">Qısa interaktiv tanışlıq: biznes profilindən rezervasiya linkinə, müştərinin seçimindən görüş cədvəlinə qədər.</p><p className="mt-3 text-xs font-semibold text-[#89948f]">Bu, məhsulun canlı interfeys nümunəsidir — qeydə alınmış video deyil.</p><div className="mt-6 space-y-2">{[['01','Biznes profilinizi qurun'],['02','Müştəri xidmət seçir'],['03','Görüş təqvimə düşür']].map(([n,label],i)=><button key={n} onClick={()=>setDemoStep(i)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${demoStep===i?'bg-white text-[#087c59] shadow-sm':'text-[#748278] hover:bg-white/70'}`}><span className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] font-extrabold ${demoStep===i?'bg-[#e3f5ea] text-[#087c59]':'bg-[#e5ece8] text-[#819088]'}`}>{n}</span>{label}<ArrowRight size={14} className="ml-auto"/></button>)}</div></div><div className="panel overflow-hidden p-4 sm:p-6"><div className="flex items-center justify-between border-b border-[#edf1ee] pb-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f6ee] text-[#059669]">{demoStep===0?<Settings2 size={18}/>:demoStep===1?<CalendarCheck2 size={18}/>:<CalendarDays size={18}/>}</span><div><div className="text-sm font-bold text-[#26394b]">{['Biznes profiliniz','Onlayn rezervasiya','Görüş cədvəli'][demoStep]}</div><div className="mt-0.5 text-[11px] text-[#89948f]">Bookly məhsul nümunəsi</div></div></div><span className="rounded-full bg-[#edf8f2] px-2.5 py-1 text-[10px] font-bold text-[#087c59]">İnteraktiv demo</span></div><div className="grid min-h-[250px] place-items-center py-6"><div className="w-full max-w-md rounded-2xl border border-[#e5ece8] bg-[#fbfdfc] p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><div className="text-xs text-[#89948f]">{['İş məkanının quraşdırılması','Müştəri rezervasiya edir','Komanda üçün gün planı'][demoStep]}</div><div className="mt-1 font-serif text-xl font-extrabold">{['Başlayaq','Vaxtı seçin','Bu gün'][demoStep]}</div></div><span className="text-[11px] font-bold text-[#059669]">{demoStep+1} / 3</span></div>{demoStep===0?<div className="space-y-3"><div className="rounded-xl border border-[#e5ece8] bg-white p-3"><div className="text-[10px] font-bold text-[#89948f]">BİZNES ADI</div><div className="mt-1 text-sm font-semibold">Biznesinizin adı</div></div><div className="rounded-xl border border-[#e5ece8] bg-white p-3"><div className="text-[10px] font-bold text-[#89948f]">XİDMƏTLƏR</div><div className="mt-1 text-sm font-semibold">Xidmət və müddət əlavə edin</div></div></div>:demoStep===1?<div className="space-y-2"><div className="rounded-xl border border-[#d7eee1] bg-white p-3 text-sm font-semibold">Xidmət seçimi <span className="float-right text-[#059669]">›</span></div><div className="rounded-xl border border-[#d7eee1] bg-[#eff9f3] p-3 text-sm font-semibold">Tarix və saat <span className="float-right text-[#059669]">›</span></div><div className="flex gap-2">{['10:00','11:30','14:00'].map(t=><span key={t} className="rounded-lg border border-[#dce7e1] bg-white px-3 py-2 text-xs font-bold text-[#526273]">{t}</span>)}</div></div>:<div className="space-y-2"><div className="flex items-center gap-3 rounded-xl bg-white p-3"><span className="text-xs font-bold text-[#059669]">10:00</span><span className="h-8 w-1 rounded-full bg-[#059669]"/><span className="text-sm font-semibold">Rezervasiya cədvəldə</span></div><div className="flex items-center gap-3 rounded-xl bg-white p-3"><span className="text-xs font-bold text-[#059669]">11:30</span><span className="h-8 w-1 rounded-full bg-[#8bb8a0]"/><span className="text-sm font-semibold">Növbəti görüş vaxtı</span></div></div>}<div className="mt-5 flex gap-2"><button onClick={()=>setDemoStep(Math.max(0,demoStep-1))} disabled={demoStep===0} className="btn-secondary flex-1 disabled:opacity-40">Geri</button><button onClick={()=>setDemoStep((demoStep+1)%3)} className="btn-primary flex-1">{demoStep===2?'Yenidən bax':'Növbəti'} <ArrowRight size={14}/></button></div></div></div></div></div></div></section>
    <section id="pricing" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24"><div className="mx-auto max-w-[680px] text-center"><span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#059669]">Aydın qiymətlər</span><h2 className="mt-3 font-serif text-3xl font-extrabold tracking-[-.04em] sm:text-[42px]">{localeCopy.pricingTitle}</h2><p className="mt-4 text-sm leading-6 text-[#718073]">14 günlük pulsuz sınaq müddəti ilə başlayın. Sonra ehtiyacınıza uyğun plan seçin.</p></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{[{name:'Free',price:'$0',period:tab==='EN'?'/ month':tab==='RU'?'/ месяц':'/ ay',desc:tab==='EN'?'For a solo business getting started':tab==='RU'?'Для самостоятельного старта':'Başlamaq üçün',items:tab==='EN'?['1 staff member','30 bookings / month']:tab==='RU'?['1 сотрудник','30 записей в месяц']:['1 əməkdaş','Ayda 30 rezervasiya'],highlight:false},{name:'Pro',price:'$17',period:tab==='EN'?'/ month':tab==='RU'?'/ месяц':'/ ay',desc:tab==='EN'?'For a growing team':tab==='RU'?'Для растущей команды':'Böyüyən komanda üçün',items:tab==='EN'?['Unlimited staff','Unlimited bookings','SMS reminders']:tab==='RU'?['Безлимит сотрудников','Безлимит записей','SMS-напоминания']:['Limitsiz əməkdaş','Limitsiz rezervasiya','SMS xatırlatmaları'],highlight:true},{name:'Business',price:'$47',period:tab==='EN'?'/ month':tab==='RU'?'/ месяц':'/ ay',desc:tab==='EN'?'For multiple locations':tab==='RU'?'Для нескольких локаций':'Bir neçə məkan üçün',items:tab==='EN'?['Multiple locations','Analytics','API access']:tab==='RU'?['Несколько локаций','Аналитика','Доступ к API']:['Bir neçə məkan','Analitika','API girişi'],highlight:false}].map(plan=><article key={plan.name} className={`relative rounded-2xl border p-6 ${plan.highlight?'border-[#059669] bg-[#f1faf5] shadow-[0_15px_38px_rgba(5,150,105,.09)]':'border-[#e3ebe6] bg-white'}`}><div className="flex items-start justify-between"><div><h3 className="text-lg font-extrabold">{plan.name}</h3><p className="mt-1 text-xs text-[#82908a]">{plan.desc}</p></div>{plan.highlight&&<span className="rounded-full bg-[#dff3e7] px-2.5 py-1 text-[10px] font-bold text-[#087c59]">Seçilən</span>}</div><div className="mt-6 flex items-baseline gap-1"><span className="font-serif text-4xl font-extrabold tracking-[-.05em]">{plan.price}</span><span className="text-xs text-[#82908a]">{plan.period}</span></div><ul className="mt-6 space-y-3">{plan.items.map(item=><li key={item} className="flex items-center gap-2.5 text-sm text-[#526273]"><CheckCircle2 size={16} className="shrink-0 text-[#059669]"/>{item}</li>)}</ul><Link href="/sign-up" className={`${plan.highlight?'btn-primary':'btn-secondary'} mt-7 w-full`}>{localeCopy.trial}<ArrowRight size={15}/></Link></article>)}</div></section>
    <section className="bg-[#f7faf8] py-8"><div className="mx-auto max-w-[1240px] px-5 sm:px-8"><div className="rounded-2xl border border-dashed border-[#cddbd3] px-5 py-7 text-center"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8c9992]">Bookly icması</p><h2 className="mt-2 font-serif text-xl font-extrabold text-[#46584d]">{localeCopy.stories}</h2><p className="mt-1 text-xs text-[#89948f]">Hələlik paylaşılacaq real müştəri hekayəsi yoxdur.</p></div></div></section>
    <section id="faq" className="mx-auto max-w-[900px] px-5 py-20 sm:px-8 sm:py-24"><div className="text-center"><span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#059669]">Bookly haqqında</span><h2 className="mt-3 font-serif text-3xl font-extrabold tracking-[-.04em] sm:text-[40px]">{localeCopy.faqTitle}</h2></div><div className="mt-9 space-y-3">{(tab==='EN'?[['How long is the free trial?','Bookly starts with a 14-day free trial. Choose the plan that fits your business after trying the product.'],['What is included in Free?','The Free plan includes 1 staff member and up to 30 bookings per month.'],['Can customers book outside working hours?','Customers select from the available times configured for your business.'],['What does Business include?','Business includes multiple locations, analytics, and API access.']]:tab==='RU'?[['Сколько длится бесплатный пробный период?','Начните с 14-дневного бесплатного периода, затем выберите подходящий план.'],['Что входит в Free?','Тариф Free включает 1 сотрудника и до 30 записей в месяц.'],['Могут ли клиенты записываться вне рабочего времени?','Клиенты выбирают доступное время, настроенное для вашего бизнеса.'],['Что входит в Business?','Business включает несколько локаций, аналитику и доступ к API.']]:[['Pulsuz sınaq müddəti nə qədərdir?','Bookly-ni 14 gün pulsuz sınaqdan keçirin. Sınaqdan sonra biznesinizə uyğun plan seçə bilərsiniz.'],['Free planına nələr daxildir?','Free planında 1 əməkdaş və ayda 30 rezervasiya limiti var.'],['Müştərilər iş saatlarından kənar vaxt seçə bilər?','Müştərilər biznesiniz üçün mövcud etdiyiniz vaxtlardan seçim edir.'],['Business planına nələr daxildir?','Business planına bir neçə məkan, analitika və API girişi daxildir.']]).map(([question,answer])=><details key={question} className="panel group px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-[#344658]">{question}<ChevronDown size={17} className="shrink-0 text-[#059669] transition group-open:rotate-180"/></summary><p className="mt-3 max-w-2xl text-sm leading-6 text-[#758294]">{answer}</p></details>)}</div></section>
    <section id="for-who" className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 sm:py-16"><div className="panel grid items-center gap-8 overflow-hidden bg-[#eaf6ef] p-7 sm:p-10 lg:grid-cols-[1fr_auto]"><div><div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#087c59]">İşiniz üçün doğru ölçü</div><h2 className="mt-3 max-w-xl font-serif text-3xl font-extrabold tracking-[-.04em] sm:text-[38px]">Müştəriniz üçün rahat. Sizin üçün aydın.</h2><p className="mt-4 max-w-xl leading-7 text-[#64786c]">Kiçik komandalar üçün hazırlanmış, yerli biznesin gündəlik ehtiyaclarına uyğun görüş sistemi.</p></div><Link href="/sign-up" className="btn-primary w-fit whitespace-nowrap px-5 py-3">{localeCopy.trial} <ArrowRight size={16} /></Link></div></section>
    <footer className="border-t border-[#e5ece8]"><div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand /><span className="text-xs text-[#89948f]">Bookly © 2025 · bookly.az</span><div className="flex gap-4 text-xs font-semibold text-[#687788]"><a href="#how">Necə işləyir</a><Link href="/sign-in">Daxil ol</Link></div></div></footer>
  </main>;
}

function LandingRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function SetupBusiness() {
  const createBusiness = useCreateDashboardBusiness();
  const qc = useQueryClient();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createBusiness.mutate({ data: { name: String(fd.get('name')), category: String(fd.get('category')), phone: String(fd.get('phone')), address: String(fd.get('address')) } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetDashboardBusinessQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardOverviewQueryKey() }); } });
  };
  return <div className="mx-auto max-w-2xl py-4"><div className="mb-7 flex items-center gap-3"><Brand /><span className="rounded-full bg-[#eaf8ef] px-3 py-1 text-xs font-bold text-[#087c59]">İlk addım</span></div><div className="panel p-5 sm:p-8"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf8ef] text-[#059669]"><Sparkles size={20} /></span><h1 className="mt-5 font-serif text-3xl font-extrabold tracking-[-.04em]">Biznesinizi tanıyaq</h1><p className="mt-2 text-sm leading-6 text-[#758294]">Müştərilərinizin sizi asanlıqla tapması üçün əsas məlumatları əlavə edin.</p><form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="Biznesin adı" name="name" placeholder="Məsələn, Lalə Studio" required /><Field label="Kateqoriya" name="category" placeholder="Gözəllik salonu" required /><Field label="Telefon" name="phone" placeholder="+994 50 000 00 00" required /><Field label="Ünvan" name="address" placeholder="Bakı, Nizami küçəsi 12" required /><div className="sm:col-span-2"><Button type="submit" disabled={createBusiness.isPending}>{createBusiness.isPending && <LoaderCircle size={16} className="animate-spin" />} İş məkanını yarat <ArrowRight size={16} /></Button>{createBusiness.isError && <p className="mt-3 text-sm text-rose-600">Biznes yaradıla bilmədi. Məlumatları yoxlayıb yenidən sınayın.</p>}</div></form></div></div>;
}

function DashboardHome() {
  const biz = useGetDashboardBusiness();
  const overview = useGetDashboardOverview({ query: { enabled: !!biz.data, queryKey: getGetDashboardOverviewQueryKey() } });
  if (biz.isLoading) return <DashboardShell title="İcmal"><LoadingBlock rows={4} /></DashboardShell>;
  if (!biz.data) return <DashboardShell title="İcmal"><SetupBusiness /></DashboardShell>;
  return <DashboardShell title="İcmal"><div className="animate-in">
    <PageTitle title={`Salam, ${biz.data.name}`} subtitle="Bu gün biznesinizdə nələr baş verir." action={<Link className="btn-primary" href="/dashboard/appointments"><CalendarDays size={16} /> Görüşlərə bax</Link>} />
    {overview.isLoading ? <LoadingBlock rows={4} /> : overview.isError || !overview.data ? <QueryError retry={() => overview.refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: 'Bugünkü görüşlər', value: String(overview.data.todayAppointments.length), change: 'Bu gün', icon: CalendarDays, accent: '#e8f6ee', color: '#05865e' }, { label: 'Aylıq gəlir', value: `${overview.data.monthlyRevenue.toLocaleString('az-AZ')} ₼`, change: 'Bu ay', icon: Activity, accent: '#eaf2fa', color: '#427ba9' }, { label: 'Müştərilər', value: String(overview.data.totalCustomers), change: 'Ümumi', icon: Users, accent: '#f8f0e7', color: '#a97435' }, { label: 'Doluluq', value: `${overview.data.occupancyPercent}%`, change: 'Bu ay', icon: ArrowUpRight, accent: '#f0ecf8', color: '#8062aa' }].map((stat) => <article key={stat.label} className="panel p-4 sm:p-5"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold text-[#82908a]">{stat.label}</div><div className="mt-2 font-serif text-[27px] font-extrabold tracking-[-.04em] text-[#1d2b3e]">{stat.value}</div></div><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: stat.accent, color: stat.color }}><stat.icon size={19} /></span></div><div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#8a9690]">{stat.change}</div></article>)}
    </div><div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf1ee] px-5 py-4"><div><h2 className="font-bold text-[#243649]">Bugünkü görüşlər</h2><p className="mt-1 text-xs text-[#89948f]">{new Date().toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><Link href="/dashboard/appointments" className="text-xs font-bold text-[#059669]">Hamısına bax <ArrowRight size={13} className="ml-1 inline" /></Link></div>{overview.data.todayAppointments.length === 0 ? <div className="p-4"><Empty title="Bu gün görüş yoxdur" copy="Yeni rezervasiyalar burada görünəcək." action={<Link href="/dashboard/settings" className="btn-secondary">Rezervasiya linkini qur</Link>} /></div> : <div className="divide-y divide-[#edf1ee]">{overview.data.todayAppointments.slice(0,5).map((a) => <AppointmentRow key={a.id} appointment={a} compact />)}</div>}</section><div className="space-y-5"><section className="panel p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Ən çox seçilən xidmət</h2><span className="rounded-lg bg-[#edf8f2] p-2 text-[#059669]"><Scissors size={17} /></span></div><div className="mt-5 font-serif text-xl font-extrabold">{overview.data.popularService || 'Hələ məlumat yoxdur'}</div><p className="mt-1 text-xs text-[#89948f]">Müştərilərinizin seçimi</p></section><section className="rounded-2xl bg-[#eaf6ef] p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#136b4c]"><Link2 size={17} /> Rezervasiya linkiniz</div><p className="mt-2 break-all text-xs text-[#698276]">{window.location.origin}/book/{biz.data.slug}</p><Link href="/dashboard/settings" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#087c59]">Linki idarə et <ArrowRight size={13} /></Link></section></div></div></>}</div></DashboardShell>;
}

function AppointmentRow({ appointment: a, compact = false }: { appointment: Appointment; compact?: boolean }) {
  const start = new Date(a.startTime);
  const statusText: Record<string,string> = { pending: 'Gözləyir', confirmed: 'Təsdiqlənib', cancelled: 'Ləğv edilib', completed: 'Tamamlanıb' };
  return <div className={`flex items-center gap-3 px-4 ${compact ? 'py-3.5' : 'py-4'}`} data-testid={`appointment-${a.id}`}><div className="w-12 shrink-0 text-center"><div className="font-bold text-[#334155]">{start.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</div><div className="mt-0.5 text-[10px] text-[#929c98]">{Math.max(0, Math.round((new Date(a.endTime).getTime() - start.getTime())/60000))} dəq</div></div><div className="h-9 w-[3px] shrink-0 rounded-full bg-[#0c9b6e]" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[#28394a]">{a.customerName}</div><div className="truncate text-xs text-[#89948f]">{a.serviceName} · {a.staffName}</div></div><div className="hidden text-right sm:block"><div className="text-xs font-semibold text-[#596879]">{a.customerPhone}</div><div className="mt-1 text-[10px] text-[#89948f]">{a.status === 'pending' ? 'Cavab gözləyir' : statusText[a.status]}</div></div><StatusPill status={a.status} /></div>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string,string> = { pending: 'bg-amber-50 text-amber-700', confirmed: 'bg-[#eaf8ef] text-[#087c59]', cancelled: 'bg-rose-50 text-rose-700', completed: 'bg-slate-100 text-slate-600' };
  const label: Record<string,string> = { pending: 'Gözləyir', confirmed: 'Təsdiq', cancelled: 'Ləğv', completed: 'Bitib' };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${map[status] ?? map.pending}`}>{label[status] ?? status}</span>;
}

function AppointmentsPage() {
  const [date, setDate] = useState(bakuDateString());
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'day' | 'week'>('day');
  const query = useGetDashboardAppointments({ date });
  const update = useUpdateAppointmentStatus();
  const qc = useQueryClient();
  const filtered = (query.data ?? []).filter(a => filter === 'all' || a.status === filter);
  const shift = (n: number) => { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + n * (view === 'week' ? 7 : 1)); setDate(next.toISOString().slice(0,10)); };
  return <DashboardShell title="Görüşlər"><PageTitle title="Görüşlər" subtitle="Gündəlik və həftəlik cədvəlinizi, rezervasiya statuslarını idarə edin." action={<button onClick={() => setDate(bakuDateString())} className="btn-secondary"><CalendarDays size={15} /> Bu gün</button>} /><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><button className="btn-secondary h-10 w-10 p-0" aria-label={view === 'week' ? 'Əvvəlki həftə' : 'Əvvəlki gün'} onClick={() => shift(-1)}><ChevronLeft size={17} /></button><label className="relative"><input className="field h-10 w-[170px] py-2 text-sm font-semibold" type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-appointment-date" /></label><button className="btn-secondary h-10 w-10 p-0" aria-label={view === 'week' ? 'Növbəti həftə' : 'Növbəti gün'} onClick={() => shift(1)}><ChevronRight size={17} /></button><span className="ml-1 hidden text-sm font-bold text-[#536273] sm:block">{new Date(`${date}T12:00:00Z`).toLocaleDateString('az-AZ',{weekday:'long',day:'numeric',month:'long'})}</span><div className="flex rounded-lg border border-[#dce7e1] bg-white p-1"><button className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === 'day' ? 'bg-[#eaf8ef] text-[#087c59]' : 'text-[#7b8982]'}`} onClick={() => setView('day')} data-testid="button-day-view">Gün</button><button className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === 'week' ? 'bg-[#eaf8ef] text-[#087c59]' : 'text-[#7b8982]'}`} onClick={() => setView('week')} data-testid="button-week-view">Həftə</button></div></div><label className="flex h-10 items-center gap-2 rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-[#64736b]"><ListFilter size={15} /><select className="bg-transparent outline-none" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-appointment-status"><option value="all">Bütün statuslar</option><option value="pending">Gözləyir</option><option value="confirmed">Təsdiqlənib</option><option value="completed">Tamamlanıb</option><option value="cancelled">Ləğv edilib</option></select></label></div>{view === 'week' ? <WeeklyAppointments anchorDate={date} filter={filter} onSelectDate={(selected) => { setDate(selected); setView('day'); }} /> : query.isLoading ? <LoadingBlock rows={5} /> : query.isError ? <QueryError retry={() => query.refetch()} /> : filtered.length === 0 ? <Empty title="Görüş tapılmadı" copy={filter === 'all' ? 'Bu tarix üçün rezervasiya yoxdur.' : 'Bu statusda görüş yoxdur. Filtri dəyişib yoxlayın.'} /> : <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf1ee] px-4 py-4 sm:px-5"><div className="font-bold">{filtered.length} görüş</div><div className="text-xs text-[#8a9690]">Vaxt sırası ilə</div></div><div className="divide-y divide-[#edf1ee]">{filtered.map(a => <div key={a.id} className="group"><AppointmentRow appointment={a} /><div className="flex flex-wrap gap-2 px-4 pb-3 pl-[75px] sm:invisible sm:group-hover:visible sm:group-focus-within:visible">{a.status === 'pending' && <button disabled={update.isPending} onClick={() => update.mutate({ id:a.id, data:{status:'confirmed'} }, {onSuccess:()=>qc.invalidateQueries({queryKey:getGetDashboardAppointmentsQueryKey({date})})})} className="text-[11px] font-bold text-[#087c59]" data-testid={`button-confirm-${a.id}`}>Təsdiqlə</button>}{a.status !== 'cancelled' && a.status !== 'completed' && <button disabled={update.isPending} onClick={() => update.mutate({ id:a.id, data:{status:'cancelled'} }, {onSuccess:()=>qc.invalidateQueries({queryKey:getGetDashboardAppointmentsQueryKey({date})})})} className="text-[11px] font-bold text-rose-600" data-testid={`button-cancel-${a.id}`}>Ləğv et</button>}{a.status === 'confirmed' && <button disabled={update.isPending} onClick={() => update.mutate({ id:a.id, data:{status:'completed'} }, {onSuccess:()=>qc.invalidateQueries({queryKey:getGetDashboardAppointmentsQueryKey({date})})})} className="text-[11px] font-bold text-[#637184]" data-testid={`button-complete-${a.id}`}>Tamamlandı</button>}</div></div>)}</div></section>}</DashboardShell>;
}

function weekDates(anchorDate: string) {
  const monday = new Date(`${anchorDate}T12:00:00Z`);
  const dayOffset = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - dayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setUTCDate(current.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

function WeeklyAppointments({ anchorDate, filter, onSelectDate }: { anchorDate: string; filter: string; onSelectDate: (date: string) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {weekDates(anchorDate).map((date) => <WeeklyDay key={date} date={date} filter={filter} onSelectDate={onSelectDate} />)}
  </div>;
}

function WeeklyDay({ date, filter, onSelectDate }: { date: string; filter: string; onSelectDate: (date: string) => void }) {
  const query = useGetDashboardAppointments({ date });
  const appointments = (query.data ?? []).filter((appointment) => filter === 'all' || appointment.status === filter);
  const day = new Date(`${date}T12:00:00Z`);
  return <section className="panel min-h-[190px] overflow-hidden">
    <button className="flex w-full items-center justify-between border-b border-[#edf1ee] px-4 py-3 text-left hover:bg-[#f8fbf9]" onClick={() => onSelectDate(date)} aria-label={`${date} gününün görüşlərinə bax`}>
      <span className="text-xs font-bold capitalize text-[#344658]">{day.toLocaleDateString('az-AZ', { weekday: 'long' })}</span>
      <span className="text-[11px] text-[#89948f]">{day.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' })}</span>
    </button>
    {query.isLoading ? <div className="space-y-2 p-3"><div className="skeleton h-12" /><div className="skeleton h-12" /></div> : query.isError ? <p className="p-3 text-xs text-rose-600">Yüklənmədi.</p> : !appointments.length ? <p className="p-4 text-xs text-[#9aa59f]">Görüş yoxdur</p> : <div className="divide-y divide-[#edf1ee]">{appointments.slice(0, 4).map((appointment) => <div key={appointment.id} className="py-1"><AppointmentRow appointment={appointment} compact /></div>)}{appointments.length > 4 && <button className="w-full px-4 py-2 text-left text-[11px] font-bold text-[#087c59]" onClick={() => onSelectDate(date)}>Daha {appointments.length - 4} görüşə bax</button>}</div>}
  </section>;
}
function ServicesPage() {
  const q = useGetDashboardServices();
  const qc = useQueryClient();
  const create = useCreateService(); const update = useUpdateService(); const del = useDeleteService();
  const [editing, setEditing] = useState<Service | null | false>(false);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = { name: String(fd.get('name')), durationMinutes: Number(fd.get('duration')), price: Number(fd.get('price')) }; const onSuccess = () => { qc.invalidateQueries({queryKey:getGetDashboardServicesQueryKey()}); setEditing(false); }; if (editing) update.mutate({id:editing.id,data}, {onSuccess}); else create.mutate({data},{onSuccess}); };
  const busy = create.isPending || update.isPending;
  return <DashboardShell title="Xidmətlər"><PageTitle title="Xidmətlər" subtitle="Müştərilərinizə təqdim etdiyiniz xidmətləri idarə edin." action={<Button onClick={() => setEditing(null)}><Plus size={16} /> Xidmət əlavə et</Button>} />{q.isLoading ? <LoadingBlock rows={4} /> : q.isError ? <QueryError retry={() => q.refetch()} /> : !q.data?.length ? <Empty title="İlk xidmətinizi əlavə edin" copy="Müddət və qiyməti qeyd edin. Xidmətlər rezervasiya səhifənizdə görünəcək." action={<Button onClick={() => setEditing(null)}><Plus size={15} /> Xidmət yarat</Button>} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{q.data.map(s => <article key={s.id} className="panel p-5 transition hover:-translate-y-0.5 hover:shadow-md" data-testid={`card-service-${s.id}`}><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf8ef] text-[#059669]"><Scissors size={18} /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.active ? 'bg-[#eaf8ef] text-[#087c59]' : 'bg-slate-100 text-slate-500'}`}>{s.active ? 'Aktiv' : 'Passiv'}</span></div><h3 className="mt-4 font-bold text-[#26394b]">{s.name}</h3><div className="mt-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs text-[#718073]"><Clock3 size={14} /> {s.durationMinutes} dəqiqə</span><strong className="font-serif text-lg text-[#087c59]">{s.price.toLocaleString('az-AZ')} ₼</strong></div><div className="mt-4 flex items-center justify-between border-t border-[#edf1ee] pt-3"><button className="inline-flex items-center gap-1.5 text-xs font-bold text-[#596879] hover:text-[#059669]" onClick={() => setEditing(s)} data-testid={`button-edit-service-${s.id}`}><Pencil size={14} /> Redaktə et</button><div className="flex gap-2"><button onClick={() => update.mutate({id:s.id,data:{active:!s.active}}, {onSuccess:()=>qc.invalidateQueries({queryKey:getGetDashboardServicesQueryKey()})})} className="text-xs font-semibold text-[#65756c]" data-testid={`button-toggle-service-${s.id}`}>{s.active ? 'Dayandır' : 'Aktiv et'}</button><button onClick={() => setConfirmDelete(s)} className="grid h-8 w-8 place-items-center rounded-lg text-[#a0aaa5] hover:bg-rose-50 hover:text-rose-600" aria-label={`${s.name} xidmətini sil`} data-testid={`button-delete-service-${s.id}`}><Trash2 size={15} /></button></div></div></article>)}</div>}
    {editing !== false && <Modal title={editing ? 'Xidməti redaktə et' : 'Yeni xidmət'} close={() => setEditing(false)}><form onSubmit={submit} className="space-y-4"><Field label="Xidmətin adı" name="name" placeholder="Məsələn, Saç kəsimi" defaultValue={editing ? editing.name : ''} required /><div className="grid grid-cols-2 gap-3"><Field label="Müddət (dəqiqə)" name="duration" type="number" defaultValue={editing ? editing.durationMinutes : 30} required /><Field label="Qiymət (₼)" name="price" type="number" defaultValue={editing ? editing.price : ''} required /></div>{(create.isError || update.isError) && <p className="text-sm text-rose-600">Əməliyyat baş tutmadı. Bir az sonra yenidən cəhd edin.</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Ləğv et</button><Button type="submit" disabled={busy}>{busy && <LoaderCircle size={15} className="animate-spin" />} Yadda saxla</Button></div></form></Modal>}
    {confirmDelete && <Modal title="Xidməti silmək?" close={() => setConfirmDelete(null)}><p className="text-sm leading-6 text-[#718073]"><strong>{confirmDelete.name}</strong> xidməti silinsin? Bu əməliyyat geri qaytarılmır.</p><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Geri</button><button className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700" onClick={() => del.mutate({id:confirmDelete.id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getGetDashboardServicesQueryKey()});setConfirmDelete(null);}})} disabled={del.isPending} data-testid="button-confirm-delete-service">{del.isPending ? 'Silinir...' : 'Xidməti sil'}</button></div></Modal>}
  </DashboardShell>;
}

function StaffPage() {
  const q = useGetDashboardStaff(); const services = useGetDashboardServices(); const qc = useQueryClient();
  const create = useCreateStaff(); const update = useUpdateStaff(); const del = useDeleteStaff();
  const [editing, setEditing] = useState<Staff | null | false>(false); const [remove, setRemove] = useState<Staff | null>(null);
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const fd=new FormData(e.currentTarget);const serviceIds=fd.getAll('services').map(Number);const workingHours=Object.fromEntries(Object.entries(DEFAULT_STAFF_HOURS).map(([day,hour])=>[day,{open:String(fd.get(`staff-${day}-open`)??hour.open),close:String(fd.get(`staff-${day}-close`)??hour.close),closed:fd.get(`staff-${day}-closed`)==='on'}]));const data={name:String(fd.get('name')),serviceIds,workingHours};const onSuccess=()=>{qc.invalidateQueries({queryKey:getGetDashboardStaffQueryKey()});setEditing(false);};if(editing)update.mutate({id:editing.id,data},{onSuccess});else create.mutate({data},{onSuccess});};
  return <DashboardShell title="Komanda"><PageTitle title="Komanda" subtitle="Mütəxəssisləri və təqdim etdikləri xidmətləri tənzimləyin." action={<Button onClick={()=>setEditing(null)}><Plus size={16}/> Komanda üzvü əlavə et</Button>}/>{q.isLoading ? <LoadingBlock rows={3}/> : q.isError ? <QueryError retry={()=>q.refetch()}/> : !q.data?.length ? <Empty title="Komandanıza ilk üzvü əlavə edin" copy="Müştərilər rezervasiya zamanı uyğun mütəxəssisi seçə biləcəklər." action={<Button onClick={()=>setEditing(null)}><Plus size={15}/> Üzv əlavə et</Button>}/> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{q.data.map((member,i)=><article key={member.id} className="panel p-5" data-testid={`card-staff-${member.id}`}><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${['bg-[#e9f5ed] text-[#19724f]','bg-[#edf1f8] text-[#4b6385]','bg-[#f6eee5] text-[#8b633d]'][i%3]}`}>{member.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><div><h3 className="font-bold text-[#26394b]">{member.name}</h3><p className="mt-0.5 text-xs text-[#87938d]">{member.active?'Aktiv üzv':'Passiv üzv'}</p></div></div><button onClick={()=>update.mutate({id:member.id,data:{active:!member.active}},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetDashboardStaffQueryKey()})})} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${member.active?'bg-[#eaf8ef] text-[#087c59]':'bg-slate-100 text-slate-500'}`} data-testid={`button-toggle-staff-${member.id}`}>{member.active?'Aktiv':'Passiv'}</button></div><div className="mt-5 border-t border-[#edf1ee] pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#93a098]">Xidmətlər</p><div className="flex flex-wrap gap-1.5">{member.serviceIds.map(id=>{const svc=services.data?.find(s=>s.id===id);return svc?<span key={id} className="rounded-md bg-[#f3f7f4] px-2 py-1 text-[11px] font-medium text-[#627368]">{svc.name}</span>:null})}{!member.serviceIds.length&&<span className="text-xs text-[#9aa59f]">Xidmət seçilməyib</span>}</div></div><div className="mt-4 flex justify-between"><button onClick={()=>setEditing(member)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#596879]" data-testid={`button-edit-staff-${member.id}`}><Pencil size={14}/> Redaktə et</button><button onClick={()=>setRemove(member)} className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600" data-testid={`button-delete-staff-${member.id}`}><Trash2 size={14}/> Sil</button></div></article>)}</div>}
    {editing!==false&&<Modal title={editing?'Üzvü redaktə et':'Yeni komanda üzvü'} close={()=>setEditing(false)}><form onSubmit={submit} className="space-y-4"><Field label="Ad və soyad" name="name" placeholder="Məsələn, Aysel Məmmədova" defaultValue={editing?editing.name:''} required/><div><div className="field-label">Təqdim etdiyi xidmətlər</div><div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[#dce6e1] p-3">{services.data?.map(s=><label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-[#536273]"><input type="checkbox" className="accent-[#059669]" name="services" value={s.id} defaultChecked={editing !== null && editing.serviceIds.includes(s.id)}/>{s.name}</label>)}{!services.data?.length&&<span className="text-xs text-[#89948f]">Əvvəlcə xidmət əlavə edin.</span>}</div></div><StaffHoursFields hours={editing && typeof editing === 'object' ? editing.workingHours : DEFAULT_STAFF_HOURS}/>{(create.isError||update.isError)&&<p className="text-sm text-rose-600">Üzv yadda saxlanılmadı. Yenidən cəhd edin.</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={()=>setEditing(false)}>Ləğv et</button><Button type="submit" disabled={create.isPending||update.isPending}>Yadda saxla</Button></div></form></Modal>}
    {remove&&<Modal title="Komanda üzvünü silmək?" close={()=>setRemove(null)}><p className="text-sm leading-6 text-[#718073]"><strong>{remove.name}</strong> komanda siyahısından silinsin?</p><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={()=>setRemove(null)}>Geri</button><button className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white" onClick={()=>del.mutate({id:remove.id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getGetDashboardStaffQueryKey()});setRemove(null);}})} disabled={del.isPending}>Sil</button></div></Modal>}
  </DashboardShell>;
}

function StaffHoursFields({ hours }: { hours: Staff['workingHours'] }) {
  return <div className="border-t border-[#edf1ee] pt-4">
    <h3 className="text-sm font-bold">İş saatları</h3>
    <p className="mt-1 text-xs text-[#89948f]">Rezervasiyalar yalnız bu saatlarda göstərilir.</p>
    <div className="mt-3 space-y-2">
      {Object.entries(hours).map(([day, hour]) => <div key={day} className="grid grid-cols-[1fr_72px_72px_auto] items-center gap-2 rounded-lg bg-[#f8faf9] px-3 py-2">
        <span className="text-xs font-semibold text-[#526273]">{dayLabel(day)}</span>
        <input className="field h-8 px-2 py-1 text-xs" type="time" name={`staff-${day}-open`} defaultValue={hour.open} disabled={hour.closed} aria-label={`${dayLabel(day)} açılış`} />
        <input className="field h-8 px-2 py-1 text-xs" type="time" name={`staff-${day}-close`} defaultValue={hour.close} disabled={hour.closed} aria-label={`${dayLabel(day)} bağlanış`} />
        <label className="flex items-center gap-1 text-[10px] text-[#738078]"><input type="checkbox" name={`staff-${day}-closed`} defaultChecked={hour.closed} className="accent-[#059669}" />Bağlı</label>
      </div>)}
    </div>
  </div>;
}

function HolidaysPage() {
  const query = useGetDashboardHolidays();
  const create = useCreateDashboardHoliday();
  const remove = useDeleteDashboardHoliday();
  const queryClient = useQueryClient();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    create.mutate({
      data: {
        date: String(values.get('date')),
        label: String(values.get('label') ?? ''),
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardHolidaysQueryKey() });
        form.reset();
      },
    });
  };

  return <DashboardShell title="Bağlı günlər">
    <PageTitle title="Bağlı günlər" subtitle="Bayram və məzuniyyət günlərində yeni rezervasiyaları dayandırın." />
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section className="panel h-fit p-5 sm:p-6">
        <h2 className="font-bold">Bağlı gün əlavə et</h2>
        <p className="mt-1 text-xs text-[#89948f]">Bu tarix üçün müştərilərə boş vaxt göstərilməyəcək.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Tarix" name="date" type="date" required />
          <Field label="Qeyd (istəyə görə)" name="label" placeholder="Məsələn, Novruz bayramı" />
          {create.isError && <p className="text-sm text-rose-600">Tarix əlavə edilmədi. Eyni tarixin siyahıda olmadığını yoxlayın.</p>}
          <Button type="submit" disabled={create.isPending}>{create.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Tarixi əlavə et</Button>
        </form>
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-[#edf1ee] px-5 py-4">
          <h2 className="font-bold">Rezervasiya qəbul edilməyən tarixlər</h2>
          <p className="mt-1 text-xs text-[#89948f]">Siyahı avtomatik olaraq yeni rezervasiya vaxtlarından çıxarılır.</p>
        </div>
        {query.isLoading ? <div className="p-4"><LoadingBlock rows={3} /></div> : query.isError ? <div className="p-4"><QueryError retry={() => query.refetch()} /></div> : !query.data?.length ? <Empty title="Bağlı gün yoxdur" copy="İstirahət və bayram tarixlərini əlavə etdikdə onlar burada görünəcək." /> : <div className="divide-y divide-[#edf1ee]">
          {query.data.map((holiday) => <div key={holiday.id} className="flex items-center gap-3 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff4e8] text-[#b37428]"><CalendarDays size={17} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#344658]">{new Date(`${holiday.date}T12:00:00`).toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="mt-0.5 text-xs text-[#89948f]">{holiday.label || 'Bağlı gün'}</div>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-lg text-[#9aa59f] hover:bg-rose-50 hover:text-rose-600" aria-label="Bağlı günü sil" onClick={() => remove.mutate({ id: holiday.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetDashboardHolidaysQueryKey() }) })} disabled={remove.isPending}><Trash2 size={15} /></button>
          </div>)}
        </div>}
        {remove.isError && <p className="px-5 pb-4 text-sm text-rose-600">Bağlı gün silinmədi. Yenidən cəhd edin.</p>}
      </section>
    </div>
  </DashboardShell>;
}

function CustomersPage() {
  const q = useGetDashboardCustomers(); const [search,setSearch]=useState('');
  const customers = useMemo(()=> (q.data??[]).filter(c=>`${c.name} ${c.phone} ${c.email??''}`.toLowerCase().includes(search.toLowerCase())),[q.data,search]);
  return <DashboardShell title="Müştərilər"><PageTitle title="Müştərilər" subtitle="Müştərilərin ziyarət tarixçəsi və əlaqə məlumatları."/><div className="mb-4 flex items-center gap-2 rounded-xl border border-[#dce7e1] bg-white px-3.5"><Search size={16} className="text-[#97a39d]"/><input value={search} onChange={e=>setSearch(e.target.value)} className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#a0aaa5]" placeholder="Ad, telefon və ya e-poçt ilə axtar" data-testid="input-customer-search"/></div>{q.isLoading?<LoadingBlock rows={5}/>:q.isError?<QueryError retry={()=>q.refetch()}/>:!customers.length?<Empty title={search?'Nəticə tapılmadı':'Müştəri tarixçəniz hələ boşdur'} copy={search?'Axtarış sözünü dəyişib yenidən yoxlayın.':'Rezervasiya edən müştərilər burada ziyarət tarixçəsi ilə görünəcək.'}/>:<section className="panel overflow-hidden"><div className="hidden grid-cols-[1.4fr_1fr_.8fr_.6fr_.8fr] gap-3 border-b border-[#edf1ee] bg-[#fafcfb] px-5 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-[#93a098] sm:grid"><span>Müştəri</span><span>Əlaqə</span><span>Ziyarətlər</span><span>Son ziyarət</span><span /></div><div className="divide-y divide-[#edf1ee]">{customers.map(c=><CustomerRow customer={c} key={c.id}/>)}</div></section>}</DashboardShell>;
}
function CustomerRow({customer:c}:{customer:Customer}) { return <div className="grid gap-2 px-4 py-4 sm:grid-cols-[1.4fr_1fr_.8fr_.6fr_.8fr] sm:items-center sm:gap-3 sm:px-5" data-testid={`row-customer-${c.id}`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf6ef] text-xs font-bold text-[#087c59]">{c.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><div><div className="text-sm font-bold text-[#2c3d4e]">{c.name}</div><div className="text-xs text-[#8a9690] sm:hidden">{c.phone}</div></div></div><div className="hidden text-xs text-[#65756c] sm:block">{c.email||c.phone}<div className="mt-1 text-[10px] text-[#9aa59f]">{c.email?c.phone:''}</div></div><div className="flex items-center justify-between text-xs sm:block"><span className="text-[#98a39e] sm:hidden">Ziyarət sayı</span><span className="font-bold text-[#425366]">{c.totalVisits} dəfə</span></div><div className="flex items-center justify-between text-xs sm:block"><span className="text-[#98a39e] sm:hidden">Son ziyarət</span><span className="text-[#65756c]">{c.lastVisit?new Date(c.lastVisit).toLocaleDateString('az-AZ'):'—'}</span></div><div className="hidden justify-end sm:flex"><a href={`tel:${c.phone}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#059669] hover:bg-[#eff9f3]" aria-label={`${c.name} ilə əlaqə`}><Phone size={15}/></a></div></div>;}

function SettingsPage() {
  const q = useGetDashboardBusiness();
  const update = useUpdateDashboardBusiness();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const link = q.data ? `${window.location.origin}/book/${q.data.slug}` : '';
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!q.data) return;
    const fd = new FormData(e.currentTarget);
    const workingHours = Object.fromEntries(Object.entries(q.data.workingHours ?? {}).map(([day, hour]) => [day, {
      open: String(fd.get(`${day}-open`) ?? hour.open),
      close: String(fd.get(`${day}-close`) ?? hour.close),
      closed: fd.get(`${day}-closed`) === 'on',
    }]));
    update.mutate({ data: {
      name: String(fd.get('name')), category: String(fd.get('category')),
      phone: String(fd.get('phone')), address: String(fd.get('address')),
      workingHours,
    } }, { onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetDashboardBusinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardOverviewQueryKey() });
    } });
  };
  return <DashboardShell title="Tənzimləmələr"><PageTitle title="Tənzimləmələr" subtitle="Biznes profilinizi, iş saatlarınızı və rezervasiya linkinizi yeniləyin."/><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">{q.isLoading?<LoadingBlock rows={4}/>:q.isError||!q.data?<QueryError retry={()=>q.refetch()}/>:<><section className="panel p-5 sm:p-6"><div className="mb-5"><h2 className="font-bold">Biznes məlumatları</h2><p className="mt-1 text-xs text-[#89948f]">Profiliniz rezervasiya səhifəsində görünür.</p></div><form onSubmit={submit} className="space-y-4"><Field label="Biznesin adı" name="name" defaultValue={q.data.name} required/><Field label="Kateqoriya" name="category" defaultValue={q.data.category} required/><div className="grid gap-4 sm:grid-cols-2"><Field label="Telefon" name="phone" defaultValue={q.data.phone} required/><Field label="Ünvan" name="address" defaultValue={q.data.address}/></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Saat qurşağı" name="timezone" defaultValue={q.data.timezone}/><Field label="Valyuta" name="currency" defaultValue={q.data.currency}/></div><div className="border-t border-[#edf1ee] pt-4"><h3 className="text-sm font-bold">İş saatları</h3><p className="mt-1 text-xs text-[#89948f]">Müştərilərinizin rezervasiya edə biləcəyi vaxt.</p><div className="mt-3 space-y-2">{Object.entries(q.data.workingHours??{}).map(([day,hour])=><div key={day} className="grid grid-cols-[1fr_78px_78px_auto] items-center gap-2 rounded-lg bg-[#f8faf9] px-3 py-2"><span className="text-xs font-semibold text-[#526273]">{dayLabel(day)}</span><input className="field h-8 px-2 py-1 text-xs" type="time" name={`${day}-open`} defaultValue={hour.open} disabled={hour.closed} aria-label={`${dayLabel(day)} açılış`}/><input className="field h-8 px-2 py-1 text-xs" type="time" name={`${day}-close`} defaultValue={hour.close} disabled={hour.closed} aria-label={`${dayLabel(day)} bağlanış`}/><label className="flex items-center gap-1 text-[10px] text-[#738078]"><input type="checkbox" name={`${day}-closed`} defaultChecked={hour.closed} className="accent-[#059669]"/>Bağlı</label></div>)}</div></div>{update.isSuccess&&<p className="flex items-center gap-1.5 text-sm font-semibold text-[#087c59]"><CheckCircle2 size={16}/> Dəyişikliklər yadda saxlanıldı.</p>}{update.isError&&<p className="text-sm text-rose-600">Dəyişikliklər yadda saxlanılmadı.</p>}<Button type="submit" disabled={update.isPending}>{update.isPending&&<LoaderCircle size={15} className="animate-spin"/>} Məlumatları yadda saxla</Button></form></section><div className="space-y-5"><section className="rounded-2xl bg-[#172638] p-5 text-white"><div className="flex items-center gap-2 font-bold"><Link2 size={17} className="text-[#8fe1b9]"/> Rezervasiya linki</div><p className="mt-2 text-xs leading-5 text-white/55">Linki paylaşın, müştərilər özləri uyğun vaxtı seçsin.</p><div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.06] px-3 py-2.5"><span className="min-w-0 flex-1 truncate text-xs text-white/80">{link}</span><button className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#a6edc9] hover:bg-white/10" aria-label="Linki kopyala" onClick={()=>{navigator.clipboard?.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),1800)}} data-testid="button-copy-booking-link">{copied?<Check size={15}/>:<Copy size={15}/>}</button></div><a href={link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#a6edc9]">Səhifəyə bax <ExternalLink size={13}/></a><p className="mt-5 flex items-center gap-2 text-xs text-white/55"><Globe2 size={14}/> Bakı · AZN</p></section><section className="panel p-5"><div className="flex items-center gap-2 font-bold"><Clock3 size={17} className="text-[#059669]"/> Biznes məlumatı</div><div className="mt-4 space-y-3 text-xs text-[#6e7d75]"><p className="flex gap-2"><Phone size={14} className="shrink-0 text-[#94a29a]"/>{q.data.phone}</p><p className="flex gap-2"><MapPin size={14} className="shrink-0 text-[#94a29a]"/>{q.data.address}</p></div></section></div></>}</div></DashboardShell>;
}
function dayLabel(day:string) { const map:Record<string,string>={monday:'Bazar ertəsi',tuesday:'Çərşənbə axşamı',wednesday:'Çərşənbə',thursday:'Cümə axşamı',friday:'Cümə',saturday:'Şənbə',sunday:'Bazar'};return map[day.toLowerCase()]??day; }

function BookingPage({ slug }: { slug: string }) {
  const q=useGetPublicBookingPage(slug); const [serviceId,setServiceId]=useState<number|null>(null); const [staffId,setStaffId]=useState<number|null>(null); const [date,setDate]=useState(bakuDateString()); const [time,setTime]=useState(''); const [success,setSuccess]=useState(false);
  const create=useCreatePublicAppointment(); const svc=q.data?.services.find(s=>s.id===serviceId); const staff=q.data?.staff.find(s=>s.id===staffId);
  const slotQuery=useGetAvailableSlots(slug,serviceId??0,staffId??0,date,{query:{enabled:!!serviceId&&!!staffId,queryKey:getGetAvailableSlotsQueryKey(slug,serviceId??0,staffId??0,date)}});
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!serviceId||!staffId||!time)return;const fd=new FormData(e.currentTarget);create.mutate({slug,data:{serviceId,staffId,startTime:`${date}T${time}:00`,customerName:String(fd.get('name')),customerPhone:String(fd.get('phone')),customerEmail:String(fd.get('email'))||null,notes:String(fd.get('notes'))||null}},{onSuccess:()=>setSuccess(true)});};
  if(q.isLoading)return <div className="min-h-[100dvh] bg-[#f5f8f6] p-5"><div className="mx-auto max-w-xl"><div className="skeleton h-8 w-28"/><div className="panel mt-8 p-7"><div className="skeleton h-6 w-1/2"/><div className="mt-5 space-y-3"><div className="skeleton h-14"/><div className="skeleton h-14"/><div className="skeleton h-14"/></div></div></div></div>;
  if(q.isError||!q.data)return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f8f6] p-5"><div className="panel max-w-md p-8 text-center"><Brand/><h1 className="mt-6 font-serif text-2xl font-extrabold">Səhifə tapılmadı</h1><p className="mt-2 text-sm text-[#758294]">Bu rezervasiya səhifəsi mövcud deyil və ya artıq aktiv deyil.</p><button className="btn-secondary mt-5" onClick={()=>q.refetch()}>Yenidən yoxla</button></div></div>;
  if(success)return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f8f6] p-5"><div className="panel max-w-md p-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eaf8ef] text-[#059669]"><CheckCircle2 size={27}/></span><h1 className="mt-5 font-serif text-2xl font-extrabold">Rezervasiyanız qeydə alındı</h1><p className="mt-2 text-sm leading-6 text-[#758294]">{q.data.business.name} sizinlə əlaqə saxlayaraq görüşü təsdiqləyəcək.</p><div className="mt-5 rounded-xl bg-[#f5f8f6] p-4 text-left text-sm"><div className="font-bold">{svc?.name} · {staff?.name}</div><div className="mt-1 text-[#758294]">{new Date(`${date}T${time}`).toLocaleDateString('az-AZ')} · {time}</div></div><div className="mt-5"><Brand/></div></div></div>;
  const activeServices=q.data.services.filter(s=>s.active);
  const activeStaff=q.data.staff.filter(s=>s.active&&(!serviceId||s.serviceIds.includes(serviceId)));
  return <main className="min-h-[100dvh] bg-[#f5f8f6] px-4 py-6 sm:py-10"><div className="mx-auto max-w-2xl"><header className="mb-6 flex items-center justify-between"><Brand/><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#89948f]"><LockKeyhole size={13}/> Təhlükəsiz rezervasiya</span></header><section className="panel overflow-hidden"><div className="bg-[#172638] px-5 py-6 text-white sm:px-8"><span className="text-[11px] font-bold uppercase tracking-[.13em] text-[#8fe1b9]">{q.data.business.category}</span><h1 className="mt-2 font-serif text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">{q.data.business.name}</h1><p className="mt-2 flex items-center gap-1.5 text-xs text-white/60"><MapPin size={13}/>{q.data.business.address}</p></div><form onSubmit={submit} className="space-y-7 p-5 sm:p-8"><div><StepHeading number="1" title="Xidmət seçin"/>{!activeServices.length?<p className="mt-3 text-sm text-[#89948f]">Hazırda rezervasiya üçün xidmət yoxdur.</p>:<div className="mt-3 grid gap-2 sm:grid-cols-2">{activeServices.map(s=><button type="button" key={s.id} onClick={()=>{setServiceId(s.id);setStaffId(null);setTime('')}} className={`rounded-xl border p-3.5 text-left transition ${serviceId===s.id?'border-[#059669] bg-[#eff9f3] ring-2 ring-[#059669]/10':'border-[#e1e9e4] hover:border-[#b6d9c7]'}`} data-testid={`booking-service-${s.id}`}><div className="flex items-center justify-between gap-3"><span className="font-bold text-[#344658]">{s.name}</span>{serviceId===s.id&&<Check size={16} className="text-[#059669]"/>}</div><div className="mt-1.5 flex justify-between text-xs text-[#83918b]"><span>{s.durationMinutes} dəq</span><strong className="text-[#087c59]">{s.price} ₼</strong></div></button>)}</div>}</div>
    <div className={!serviceId?'opacity-45':''}><StepHeading number="2" title="Mütəxəssis seçin"/><div className="mt-3 grid gap-2 sm:grid-cols-2">{activeStaff.map(m=><button type="button" disabled={!serviceId} key={m.id} onClick={()=>{setStaffId(m.id);setTime('')}} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${staffId===m.id?'border-[#059669] bg-[#eff9f3] ring-2 ring-[#059669]/10':'border-[#e1e9e4] hover:border-[#b6d9c7]'}`}><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e2f3e9] text-xs font-bold text-[#087c59]">{m.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span className="flex-1 text-sm font-bold text-[#344658]">{m.name}</span>{staffId===m.id&&<Check size={16} className="text-[#059669]"/>}</button>)}{serviceId&&!activeStaff.length&&<p className="text-sm text-[#89948f]">Bu xidmət üçün aktiv mütəxəssis yoxdur.</p>}</div></div>
    <div className={!staffId?'opacity-45':''}><StepHeading number="3" title="Gün və saat seçin"/><div className="mt-3"><label className="field-label">Tarix</label><input className="field max-w-[240px]" type="date" min={bakuDateString()} value={date} onChange={e=>{setDate(e.target.value);setTime('')}} disabled={!staffId} data-testid="input-booking-date"/></div>{staffId&&<div className="mt-4">{slotQuery.isLoading?<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({length:8},(_,i)=><div key={i} className="skeleton h-10"/> )}</div>:slotQuery.isError?<div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">Vaxtları yükləmək mümkün olmadı. <button type="button" className="font-bold underline" onClick={()=>slotQuery.refetch()}>Yenidən yoxla</button></div>:!slotQuery.data?.length?<p className="rounded-xl bg-[#f5f8f6] p-4 text-sm text-[#758294]">Bu tarixdə boş vaxt yoxdur. Başqa gün seçin.</p>:<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slotQuery.data.map(slot=><button type="button" key={slot.time} onClick={()=>setTime(slot.time)} className={`rounded-lg border py-2.5 text-sm font-bold transition ${time===slot.time?'border-[#059669] bg-[#059669] text-white':'border-[#dce7e1] text-[#536273] hover:border-[#059669] hover:text-[#087c59]'}`} data-testid={`booking-slot-${slot.time}`}>{slot.time}</button>)}</div>}</div>}</div>
    <div className={!time?'opacity-45':''}><StepHeading number="4" title="Əlaqə məlumatları"/><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Ad və soyad" name="name" placeholder="Adınız" required/><Field label="Telefon" name="phone" placeholder="+994 50 000 00 00" required/><label className="sm:col-span-2"><span className="field-label">E-poçt (istəyə görə)</span><input className="field" name="email" type="email" placeholder="name@example.com"/></label><label className="sm:col-span-2"><span className="field-label">Qeyd (istəyə görə)</span><textarea className="field min-h-[76px] resize-y" name="notes" placeholder="Əlavə məlumatınız varsa yazın"/></label></div></div>
    {create.isError&&<div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Rezervasiya göndərilmədi. Məlumatları yoxlayıb yenidən cəhd edin.</div>}<Button type="submit" disabled={!serviceId||!staffId||!time||create.isPending} className="btn-primary w-full py-3">{create.isPending?<LoaderCircle size={16} className="animate-spin"/>:'Rezervasiyanı təsdiqlə'} {!create.isPending&&<ArrowRight size={16}/>}</Button><p className="text-center text-[10px] text-[#9aa59f]">Rezervasiyanı göndərməklə biznesin sizinlə əlaqə saxlamasına razılıq verirsiniz.</p></form></section><p className="mt-5 text-center text-xs text-[#9aa59f]">Rezervasiya Bookly ilə asanlaşır</p></div></main>;
}
function StepHeading({number,title}:{number:string;title:string}) { return <h2 className="flex items-center gap-2.5 font-bold text-[#26394b]"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#eaf8ef] text-[11px] font-extrabold text-[#087c59]">{number}</span>{title}</h2>; }

function AuthPages() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f2f8f4] px-4 py-8"><div className="w-full max-w-lg"><div className="mb-5 text-center"><Link href="/" className="inline-flex"><Brand/></Link><p className="mt-2 text-sm text-[#758294]">Biznesinizi Bookly ilə daha rahat idarə edin.</p></div><Route path="/sign-in/*?">{()=><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={appearance} />}</Route><Route path="/sign-up/*?">{()=><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={appearance} />}</Route></div></div>;
}
function Protected({ children }: { children: ReactNode }) { return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/sign-in"/></Show></>; }
function BookingRoute() { const [,params]=useRoute('/book/:slug'); return params?.slug?<BookingPage slug={params.slug}/>:<NotFound/>; }
function Router() {
  return <Switch>
    <Route path="/" component={LandingRoute}/>
    <Route path="/sign-in/*?" component={AuthPages}/>
    <Route path="/sign-up/*?" component={AuthPages}/>
    <Route path="/book/:slug" component={BookingRoute}/>
    <Route path="/dashboard"><Protected><DashboardHome/></Protected></Route>
    <Route path="/dashboard/appointments"><Protected><AppointmentsPage/></Protected></Route>
    <Route path="/dashboard/services"><Protected><ServicesPage/></Protected></Route>
    <Route path="/dashboard/staff"><Protected><StaffPage/></Protected></Route>
    <Route path="/dashboard/customers"><Protected><CustomersPage/></Protected></Route>
    <Route path="/dashboard/holidays"><Protected><HolidaysPage/></Protected></Route>
    <Route path="/dashboard/settings"><Protected><SettingsPage/></Protected></Route>
    <Route component={NotFound}/>
  </Switch>;
}
function App() {
  return <QueryClientProvider client={queryClient}><ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={appearance}><WouterRouter base={basePath}><Router/></WouterRouter></ClerkProvider></QueryClientProvider>;
}

export default App;
