import Link from 'next/link';
import {
  Building2,
  Users,
  BarChart3,
  Shield,
  Brain,
  Calendar,
  ClipboardList,
  GraduationCap,
  ArrowRight,
  Check,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { NegeLogo } from '@/components/icons/nege-logo';

const FEATURES = [
  { icon: Users, title: 'Ажилтны удирдлага', desc: 'Ажилтны бүртгэл, анкет, хувийн мэдээллийг нэг дороос удирдана' },
  { icon: Building2, title: 'Байгууллагын бүтэц', desc: 'Алба, хэлтэс, нэгж, албан тушаалын бүтэц зохион байгуулалт' },
  { icon: ClipboardList, title: 'Төсөл & Даалгавар', desc: 'Төсөл удирдлага, Gantt chart, AI даалгавар автомат үүсгэх' },
  { icon: Calendar, title: 'Ирц & Амралт', desc: 'GPS-тэй ирц бүртгэл, амралт чөлөөний менежмент' },
  { icon: GraduationCap, title: 'Сургалт & Ур чадвар', desc: 'Сургалтын төлөвлөгөө, ур чадварын gap шинжилгээ' },
  { icon: Brain, title: 'AI Туслах', desc: 'Gemini AI-р тайлан, даалгавар, судалгаа автомат боловсруулах' },
  { icon: Shield, title: 'Хөдөлмөрийн харилцаа', desc: 'Гэрээ, тушаал, загвар, цахим баримт бичиг' },
  { icon: BarChart3, title: 'Бизнес төлөвлөгөө', desc: 'KPI, зорилго, шагнал урамшуулал, гүйцэтгэлийн үнэлгээ' },
];

const PLANS = [
  { id: 'free', name: 'Үнэгүй', price: '0', period: '', desc: '5 ажилтан хүртэл', highlight: false, features: ['5 ажилтан', '3 төсөл', 'Байгууллагын бүтэц', 'Үндсэн модулууд'] },
  { id: 'starter', name: 'Эхлэл', price: '29,000', period: '/сар', desc: '25 ажилтан хүртэл', highlight: false, features: ['25 ажилтан', '20 төсөл', 'Ирц бүртгэл', 'Амралт & Чөлөө', 'Onboarding/Offboarding'] },
  { id: 'pro', name: 'Мэргэжлийн', price: '79,000', period: '/сар', desc: '100 ажилтан хүртэл', highlight: true, features: ['100 ажилтан', 'Бүх модуль', 'AI Туслах', 'Сургалт & Ур чадвар', 'Хөдөлмөрийн харилцаа'] },
  { id: 'enterprise', name: 'Аж ахуйн нэгж', price: '199,000', period: '/сар', desc: 'Хязгааргүй', highlight: false, features: ['Хязгааргүй ажилтан', 'Бүх модуль + AI', 'Бизнес төлөвлөгөө', 'Хурал & Календарь', 'Тусгай тохиргоо'] },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <NegeLogo className="h-8 w-auto" />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Боломжууд</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Үнийн санал</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Нэвтрэх
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Бүртгүүлэх
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-50/50 via-white to-white" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 text-center sm:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm text-red-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI-тай хүний нөөцийн систем
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Жижиг компаниудын
            <br />
            <span className="text-red-600">хүний нөөцийн</span> шийдэл
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
            Ажилтны бүртгэл, ирц, амралт, сургалт, төсөл удирдлага, гэрээ тушаал зэрэг бүгдийг нэг системээс удирдана. AI туслахтай.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
            >
              Үнэгүй эхлэх
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Нэвтрэх
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Үнэгүй эхлэх</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Картын мэдээлэл шаардахгүй</span>
            <span className="hidden sm:flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-emerald-500" /> Гар утсанд ажиллана</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Бүх хэрэгтэй зүйлс нэг дор
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              16+ модуль, AI туслах, гар утсанд ажиллах PWA
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
                  <f.icon className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Үнийн санал
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Таны бизнесийн хэмжээнд тохирсон төлөвлөгөө сонгоно уу
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-red-300 bg-red-50/30 ring-2 ring-red-200'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-3 py-0.5 text-xs font-medium text-white">
                    Хамгийн их сонгогддог
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">₮{plan.period}</span>
                </div>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.highlight
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Эхлэх
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Өнөөдрөөс эхлэх бэлэн үү?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Үнэгүй бүртгүүлж, байгууллагаа минутын дотор тохируулаарай.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Үнэгүй бүртгүүлэх
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <NegeLogo className="h-6 w-auto" />
          </div>
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Nege Systems. Бүх эрх хуулиар хамгаалагдсан.</p>
        </div>
      </footer>
    </div>
  );
}
