"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductTour } from "@/components/ProductTour";
import {
  TOURS,
  isTourId,
  markTourDone,
  parseTourStep,
  readTourProgress,
  stripTourParams,
  tourHref,
  withTourParams,
  type TourId,
} from "@/lib/onboardingTour";

type Props = {
  userId: string;
  role: string;
  alsoDesigner?: boolean;
};

function canUseCad(role: string, alsoDesigner?: boolean): boolean {
  return role === "designer" || Boolean(alsoDesigner);
}

function isCadPath(pathname: string): boolean {
  return /^\/app\/projects\/[^/]+$/.test(pathname);
}

function isAppHome(pathname: string): boolean {
  return pathname === "/app" || pathname === "/app/";
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/app/admin");
}

function isSetupPath(pathname: string): boolean {
  return pathname.startsWith("/app/setup");
}

function pickAutoTour(opts: {
  pathname: string;
  role: string;
  alsoDesigner?: boolean;
  progress: ReturnType<typeof readTourProgress>;
}): TourId | null {
  const { pathname, role, alsoDesigner, progress } = opts;
  if (isSetupPath(pathname) || role === "platform_owner") return null;
  if (isCadPath(pathname) && canUseCad(role, alsoDesigner) && !progress.cad) {
    return "cad";
  }
  if (role === "company_admin" && !progress.admin) {
    if (isAppHome(pathname) || isAdminPath(pathname)) return "admin";
    return null;
  }
  if (role !== "company_admin" && !progress.staff && isAppHome(pathname)) {
    return "staff";
  }
  return null;
}

export function OnboardingTour({ userId, role, alsoDesigner }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<ReturnType<typeof readTourProgress>>(
    {},
  );

  const urlTourRaw = searchParams.get("tour");
  const urlTour = isTourId(urlTourRaw) ? urlTourRaw : null;
  const search = searchParams.toString();

  useEffect(() => {
    setProgress(readTourProgress(userId));
    setReady(true);
  }, [userId]);

  const autoTour = ready
    ? pickAutoTour({ pathname, role, alsoDesigner, progress })
    : null;
  const tourId = urlTour ?? autoTour;
  const steps = tourId ? TOURS[tourId] : [];
  const stepIndex = parseTourStep(searchParams.get("step"), steps.length);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!ready || urlTour || !autoTour) return;
    const startStep =
      autoTour === "admin" && isAdminPath(pathname) ? 2 : 0;
    const href =
      autoTour === "cad"
        ? withTourParams(`${pathname}${search ? `?${search}` : ""}`, "cad", 0)
        : tourHref(autoTour, startStep, pathname);
    router.replace(href, { scroll: false });
  }, [autoTour, pathname, ready, router, search, urlTour]);

  useEffect(() => {
    if (!urlTour || !step?.href || typeof window === "undefined") return;
    const want = new URL(step.href, window.location.origin);
    if (want.pathname !== pathname) {
      router.replace(step.href, { scroll: false });
    }
  }, [pathname, router, step, urlTour]);

  const finish = useCallback(
    (done: boolean) => {
      if (tourId && done) markTourDone(userId, tourId);
      setProgress(readTourProgress(userId));
      const next = stripTourParams(`${pathname}${search ? `?${search}` : ""}`);
      router.replace(next, { scroll: false });
    },
    [pathname, router, search, tourId, userId],
  );

  const go = useCallback(
    (nextIndex: number) => {
      if (!tourId) return;
      if (nextIndex >= steps.length) {
        finish(true);
        return;
      }
      if (nextIndex < 0) return;
      router.push(tourHref(tourId, nextIndex, `${pathname}${search ? `?${search}` : ""}`), {
        scroll: false,
      });
    },
    [finish, pathname, router, search, steps.length, tourId],
  );

  if (!ready || !urlTour || !step) return null;
  if (tourId === "cad" && !isCadPath(pathname)) return null;
  if ((tourId === "admin" || tourId === "staff") && isCadPath(pathname)) {
    return null;
  }

  return (
    <ProductTour
      title={step.title}
      body={step.body}
      stepIndex={stepIndex}
      stepCount={steps.length}
      target={step.target}
      reveal={step.reveal}
      onNext={() => go(stepIndex + 1)}
      onBack={() => go(stepIndex - 1)}
      onSkip={() => finish(true)}
    />
  );
}
