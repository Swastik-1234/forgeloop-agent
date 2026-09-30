import HeroBanner from "./HeroBanner";
import PromptInput from "./PromptInput";

export default function HeroSection() {
  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 sm:gap-8 lg:gap-10">
        <div className="w-full flex flex-col items-center gap-4 sm:gap-5">
          <HeroBanner />

          <h1 className="w-full max-w-2xl text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-[-2px]">
            Build beautiful websites in a single prompt
          </h1>

          <p className="w-full text-center text-neutral-800 text-base sm:text-lg font-normal font-['Indie_Flower']">
            Learn smarter, faster, and more interactively.
          </p>
        </div>

        <PromptInput />
      </div>
    </section>
  );
}

