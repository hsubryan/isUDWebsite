import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative mt-16 w-full overflow-hidden bg-primary text-white">
      <div
        className="absolute inset-x-0 top-0 h-16 bg-white"
        style={{ clipPath: 'polygon(0 0, 84% 0, 100% 34px, 100% 0, 0 0)' }}
      />
      <div
        className="absolute inset-x-0 top-0 h-16 bg-primary"
        style={{ clipPath: 'polygon(0 34px, 84% 2px, 100% 34px, 100% 100%, 0 100%)' }}
      />

      <div className="relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-24 pb-10">
        <div className="grid gap-12 md:grid-cols-2">
          <section>
            <h2 className="text-xl font-extrabold">Connect!</h2>
            <div className="mt-6 flex items-center gap-3">
              <Link href="https://www.facebook.com/ideacenterUB/" aria-label="Facebook" className="flex h-14 w-14 items-center justify-center bg-[#4161a3] text-white transition-colors hover:bg-[#36528b]">
                <span className="text-3xl font-extrabold leading-none">f</span>
              </Link>
              <Link href="https://www.instagram.com/idea_center_ubuffalo/" aria-label="Instagram" className="flex h-14 w-14 items-center justify-center bg-secondary text-white transition-colors hover:bg-[#db7f14]">
                <span className="text-2xl font-extrabold leading-none">ig</span>
              </Link>
              <Link href="https://www.linkedin.com/company/idea-center-university-at-buffalo" aria-label="LinkedIn" className="flex h-14 w-14 items-center justify-center bg-[#047bb4] text-white transition-colors hover:bg-[#056a9b]">
                <span className="text-xl font-extrabold leading-none">in</span>
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-extrabold">Contact</h2>
            <div className="mt-6 space-y-2 text-base sm:text-lg">
              <p>
                Telephone:{' '}
                <Link href="tel:+17168295903" className="hover:text-secondary">
                  +1.716.829.5903
                </Link>
              </p>
              <p>
                E-mail:{' '}
                <Link href="mailto:ap-idea@buffalo.edu" className="hover:text-secondary">
                  ap-idea@buffalo.edu
                </Link>
              </p>
            </div>
          </section>

        </div>

        <div className="mt-12 border-t border-dashed border-white/50 pt-6">
          <div className="flex flex-col gap-4 text-xs text-white/75 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-bold text-white">University at Buffalo</p>
              <p>Center for Inclusive Design and Environmental Access</p>
              <p>School of Architecture and Planning</p>
            </div>
            <p>Copyright {new Date().getFullYear()}. All rights reserved.</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 uppercase tracking-wider">
              <Link href="/accessibility" className="hover:text-secondary">Accessibility</Link>
              <Link href="/terms" className="hover:text-secondary">Terms of Use</Link>
              <Link href="/privacy" className="hover:text-secondary">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
