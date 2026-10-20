"use client";

import { useEffect } from "react";

export default function FrameOpsBootstrap() {
  useEffect(() => {
    void import("../src/scripts/app");
  }, []);
  return null;
}
