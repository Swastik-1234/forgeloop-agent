"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/app/lib/api";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      // Redirect to home page after successful login
      router.push("/");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <section className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="max-w-md mx-auto flex flex-col items-center gap-6 sm:gap-8 lg:gap-10">
          <div className="w-full flex flex-col items-center gap-4 sm:gap-5">
            <h1 className="w-full text-center text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight tracking-[-2px]">
              Welcome back
            </h1>

            <p className="w-full text-center text-neutral-800 text-base sm:text-lg font-normal font-['Indie_Flower']">
              Sign in to continue your journey
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 sm:gap-5">
            {error && (
              <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="w-full">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-800 mb-2"
              >
                Email
              </label>
              <div className="w-full min-h-[56px] p-3 sm:p-4 bg-white rounded-2xl shadow-[0px_6px_24px_0px_rgba(0,0,0,0.08),0px_2.5px_4px_-1px_rgba(0,0,0,0.08),0px_1.5px_1px_-1px_rgba(0,0,0,0.16),0px_1.5px_4px_-1px_rgba(0,0,0,0.12)] border border-neutral-200 flex items-center">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent text-neutral-800 text-sm sm:text-base font-normal placeholder:text-neutral-500 outline-none border-none focus:outline-none"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="w-full">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-800 mb-2"
              >
                Password
              </label>
              <div className="w-full min-h-[56px] p-3 sm:p-4 bg-white rounded-2xl shadow-[0px_6px_24px_0px_rgba(0,0,0,0.08),0px_2.5px_4px_-1px_rgba(0,0,0,0.08),0px_1.5px_1px_-1px_rgba(0,0,0,0.16),0px_1.5px_4px_-1px_rgba(0,0,0,0.12)] border border-neutral-200 flex items-center">
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex-1 bg-transparent text-neutral-800 text-sm sm:text-base font-normal placeholder:text-neutral-500 outline-none border-none focus:outline-none"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="w-full flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-800 focus:ring-2 focus:ring-neutral-400"
                />
                <span className="text-neutral-700">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-neutral-800 hover:text-neutral-600 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[56px] px-4 py-3 bg-neutral-800 text-white rounded-2xl font-medium text-sm sm:text-base hover:bg-neutral-700 transition-colors shadow-[0px_6px_24px_0px_rgba(0,0,0,0.08),0px_2.5px_4px_-1px_rgba(0,0,0,0.08)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="w-full text-center">
            <p className="text-neutral-700 text-sm">
              Don't have an account?{" "}
              <Link
                href="/sign-up"
                className="text-neutral-800 font-medium hover:text-neutral-600 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
