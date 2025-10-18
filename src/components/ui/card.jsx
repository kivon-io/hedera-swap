"use client";

import React from "react";

export const Card = ({ children, className = "" }) => (
  <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = "" }) => (
  <div className={`mb-4 border-b border-zinc-800 pb-2 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = "" }) => (
  <h2 className={`text-lg font-semibold text-white ${className}`}>{children}</h2>
);

export const CardContent = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

export const CardFooter = ({ children, className = "" }) => (
  <div className={`mt-4 border-t border-zinc-800 pt-2 text-sm text-zinc-400 ${className}`}>
    {children}
  </div>
);
