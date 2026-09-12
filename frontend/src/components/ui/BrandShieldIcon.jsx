import React from 'react';

/**
 * The official RECShield logo mark (user-provided source artwork) - a shield with a solar
 * sun and an audit checkmark. Drop-in replacement for lucide's Shield / ShieldCheck wherever
 * this app uses "shield with a checkmark" for its own identity or a verified/trusted result.
 * Fixed two-tone colors (teal shield/check, amber sun), not currentColor - this is a logomark,
 * not a monochrome utility icon, so only `className` (for sizing) should be passed in. Callers
 * placing this over a dark/brand-colored fill should give it a light backing (see Sidebar,
 * LoginPage, LandingPage, PublicVerifyPage) since the shield's own stroke is a dark teal and
 * disappears against a similarly dark background otherwise.
 */
export default function BrandShieldIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M64 10 L112 27 V70 C112 99 91 118 64 128 C37 118 16 99 16 70 V27 Z" stroke="#0F766E" strokeWidth="7" />
        <circle cx="64" cy="48" r="13" stroke="#EF9F27" strokeWidth="5" />
        <path d="M64 24 V17 M40 48 H33 M95 48 H88 M45 29 L40 24 M83 29 L88 24" stroke="#EF9F27" strokeWidth="4.5" />
        <path d="M45 84 L58 97 L84 68" stroke="#0F766E" strokeWidth="9" />
      </g>
    </svg>
  );
}
