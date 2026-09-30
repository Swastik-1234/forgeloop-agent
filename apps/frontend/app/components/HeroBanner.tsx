export default function HeroBanner() {
  return (
    <div className="w-full max-w-fit px-3 sm:px-4 py-1.5 sm:py-2 bg-neutral-100 rounded-lg border border-neutral-200 flex items-start gap-2.5">
      <div className="flex-shrink-0 mt-0.5"></div>
      <p className="flex-1 text-neutral-800 text-xs sm:text-sm font-normal leading-relaxed">
        Our custom AI model self-trains and improves with every question you
        ask!
      </p>
    </div>
  );
}

